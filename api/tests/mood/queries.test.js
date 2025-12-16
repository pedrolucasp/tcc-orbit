import test from "ava";
import request from "supertest";
import { createApp } from "../../src/create-app.js";
import { setupTestDb, cleanupTestDb } from "../test-helper.js";

let app;
let db;
let userId;
let moodIds = [];

test.before(() => {
  db = setupTestDb();
  app = createApp(db);
});

test.beforeEach(async () => {
  cleanupTestDb();
  moodIds = [];

  // Create a test user with unique email
  const uniqueEmail = `mood_${Date.now()}_${Math.random()}@example.com`;
  const userRes = await request(app)
    .post("/users")
    .send({
      email: uniqueEmail,
      password: "senha123",
      first_name: "Mood",
      last_name: "Tester"
    });

  if (userRes.status !== 201) {
    throw new Error(`Failed to create test user: ${JSON.stringify(userRes.body)}`);
  }

  userId = userRes.body.id;

  // Create multiple moods for testing
  const dates = [
    new Date('2024-01-15T10:00:00Z'),
    new Date('2024-01-20T14:30:00Z'),
    new Date('2024-02-01T08:00:00Z'),
    new Date('2024-02-15T16:45:00Z'),
    new Date('2024-03-01T12:00:00Z')
  ];

  for (let i = 0; i < dates.length; i++) {
    const moodRes = await request(app)
      .post("/mood")
      .send({
        user_id: userId,
        rating: 5 + i,
        stress_level: 3 + i,
        anxiety_level: 2 + i,
        energy_level: 6 - i,
        title: `Mood ${i + 1}`,
        recorded_at: dates[i].toISOString(),
        mood_components: i % 2 === 0 ? [
          { emotion: "joy", intensity: 5 + i },
          { emotion: "trust", intensity: 4 + i }
        ] : []
      });
    moodIds.push(moodRes.body.id);
  }
});

test.serial("Obter mood específico por ID", async (t) => {
  const res = await request(app).get(`/mood/${moodIds[0]}`);

  t.is(res.status, 200);
  t.is(Number(res.body.id), Number(moodIds[0]));
  t.is(Number(res.body.user_id), Number(userId));
  t.is(res.body.title, "Mood 1");
  t.truthy(res.body.first_name);
  t.truthy(res.body.last_name);
  t.true(Array.isArray(res.body.mood_components));
});

test.serial("Mood deve incluir componentes emocionais", async (t) => {
  const res = await request(app).get(`/mood/${moodIds[0]}`);

  t.is(res.status, 200);
  t.is(res.body.mood_components.length, 2);

  const emotions = res.body.mood_components.map(c => c.emotion);
  t.true(emotions.includes('joy'));
  t.true(emotions.includes('trust'));
});

test.serial("Mood deve incluir estatísticas emocionais quando houver componentes", async (t) => {
  const res = await request(app).get(`/mood/${moodIds[0]}`);

  t.is(res.status, 200);
  t.truthy(res.body.emotion_stats);
  t.truthy(res.body.emotion_stats.dominant);
  t.truthy(res.body.emotion_stats.average);
  t.truthy(res.body.emotion_stats.breakdown);
});

test.serial("Falha ao obter mood inexistente", async (t) => {
  const res = await request(app).get("/mood/99999");

  t.is(res.status, 404);
  t.is(res.body.error, "Humor não encontrado");
});

test.serial("Obter todos os moods de um usuário", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`);

  t.is(res.status, 200);
  t.truthy(res.body.moods);
  t.is(res.body.moods.length, 5);
  t.truthy(res.body.pagination);
  t.is(res.body.pagination.total, 5);
});

test.serial("Moods devem estar ordenados por data (mais recente primeiro)", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`);

  t.is(res.status, 200);

  const dates = res.body.moods.map(m => new Date(m.recorded_at));
  for (let i = 1; i < dates.length; i++) {
    t.true(dates[i - 1] >= dates[i]);
  }
});

test.serial("Filtrar registros de humor por intervalo de datas", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`)
    .query({
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    });

  t.is(res.status, 200);
  t.is(res.body.moods.length, 2); // Only January moods
});

test.serial("Filtrar registros de humor apenas por data de início", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`)
    .query({
      start_date: '2024-02-01'
    });

  t.is(res.status, 200);
  t.is(res.body.moods.length, 3); // Feb and March moods
});

test.serial("Filtrar registros de humor apenas por data de fim", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`)
    .query({
      end_date: '2024-01-31'
    });

  t.is(res.status, 200);
  t.is(res.body.moods.length, 2); // Only January moods
});

test.serial("Paginação de moods", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`)
    .query({
      page: 2,
      limit: 2
    });

  t.is(res.status, 200);
  t.is(res.body.moods.length, 2);
  t.is(res.body.pagination.page, 2);
  t.is(res.body.pagination.limit, 2);
  t.is(res.body.pagination.total_pages, 3);
});

test.serial("Paginação com limite máximo de 100", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`)
    .query({
      limit: 200
    });

  t.is(res.status, 200);
  t.is(res.body.pagination.limit, 100); // Should be capped at 100
});

test.serial("Falha ao filtrar com intervalo de datas inválido", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`)
    .query({
      start_date: '2024-02-01',
      end_date: '2024-01-01' // End before start
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Intervalo de datas inválido");
});

test.serial("Falha ao filtrar com data de início inválida", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`)
    .query({
      start_date: 'data-invalida'
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Data de início inválida");
});

test.serial("Falha ao filtrar com data de fim inválida", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`)
    .query({
      end_date: 'data-invalida'
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Data de fim inválida");
});

test.serial("Obter estatísticas de mood do usuário", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}/stats`);

  t.is(res.status, 200);
  t.truthy(res.body.overall);
  t.is(res.body.overall.total_entries, 5);
  t.truthy(res.body.overall.avg_rating);
  t.truthy(res.body.overall.avg_stress);
  t.truthy(res.body.overall.avg_anxiety);
  t.truthy(res.body.overall.avg_energy);
  t.truthy(res.body.emotions);
  t.truthy(res.body.trends);
});

test.serial("Estatísticas devem incluir frequência de emoções", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}/stats`);

  t.is(res.status, 200);
  t.true(Array.isArray(res.body.emotions));

  // We created 3 moods with components
  const joyStats = res.body.emotions.find(e => e.emotion === 'joy');
  t.truthy(joyStats);
  t.is(joyStats.frequency, 3);
});

test.serial("Estatísticas com filtro de data", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}/stats`)
    .query({
      start_date: '2024-01-01',
      end_date: '2024-01-31'
    });

  t.is(res.status, 200);
  t.is(res.body.overall.total_entries, 2); // Only January
  t.is(res.body.date_range.start, '2024-01-01');
  t.is(res.body.date_range.end, '2024-01-31');
});

test.serial("Estatísticas devem incluir tendências por dia da semana", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}/stats`);

  t.is(res.status, 200);
  t.true(Array.isArray(res.body.trends.by_day_of_week));

  const hasDay = res.body.trends.by_day_of_week.some(d =>
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].includes(d.day_of_week)
  );
  t.true(hasDay);
});

test.serial("Usuário sem moods deve retornar lista vazia", async (t) => {
  // Create another user without moods
  const newUserRes = await request(app)
    .post("/users")
    .send({
      email: "nomood@example.com",
      password: "senha123",
      first_name: "No",
      last_name: "Mood"
    });

  const res = await request(app).get(`/mood/user/${newUserRes.body.id}`);

  t.is(res.status, 200);
  t.is(res.body.moods.length, 0);
  t.is(res.body.pagination.total, 0);
});

test.serial("Estatísticas de usuário sem moods", async (t) => {
  // Create another user without moods
  const newUserRes = await request(app)
    .post("/users")
    .send({
      email: "nostats@example.com",
      password: "senha123",
      first_name: "No",
      last_name: "Stats"
    });

  const res = await request(app).get(`/mood/user/${newUserRes.body.id}/stats`);

  t.is(res.status, 200);
  t.is(res.body.overall.total_entries, 0);
  t.is(res.body.emotions.length, 0);
});
