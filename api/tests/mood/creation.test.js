import test from "ava";
import request from "supertest";
import { createApp } from "../../src/create-app.js";
import { setupTestDb, cleanupTestDb } from "../test-helper.js";

let app;
let db;
let userId;

test.before(() => {
  db = setupTestDb();
  app = createApp(db);
});

test.beforeEach(async () => {
  cleanupTestDb();

  // Create a test user with unique email
  const uniqueEmail = `mood_${Date.now()}_${Math.random()}@example.com`;
  const res = await request(app)
    .post("/users")
    .send({
      email: uniqueEmail,
      password: "senha123",
      first_name: "Mood",
      last_name: "Tester"
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create test user: ${JSON.stringify(res.body)}`);
  }

  userId = res.body.id;
});

test("Criar registro de humor com todos os campos obrigatórios", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now
    });

  t.is(res.status, 201);
  t.truthy(res.body.id);
});

test("Criar registro de humor com avaliação e descrição", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      rating: 8,
      stress_level: 2,
      anxiety_level: 3,
      energy_level: 9,
      title: "Dia produtivo",
      description: "Consegui terminar todas as tarefas",
      recorded_at: now
    });

  t.is(res.status, 201);

  // Verify data was saved correctly
  const mood = db.prepare("SELECT * FROM mood WHERE id = ?").get(res.body.id);
  t.is(mood.rating, 8);
  t.is(mood.stress_level, 2);
  t.is(mood.title, "Dia produtivo");
});

test("Criar registro de humor com componentes emocionais", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 5,
      anxiety_level: 6,
      energy_level: 4,
      recorded_at: now,
      mood_components: [
        { emotion: "joy", intensity: 7 },
        { emotion: "anxiety", intensity: 6 },
        { emotion: "trust", intensity: 8 }
      ]
    });

  t.is(res.status, 201);

  // Verify components were saved
  const components = db.prepare("SELECT * FROM mood_components WHERE mood_id = ?").all(res.body.id);
  t.is(components.length, 3);

  const emotions = components.map(c => c.emotion);
  t.true(emotions.includes('joy'));
  t.true(emotions.includes('anxiety'));
  t.true(emotions.includes('trust'));
});

test("Componentes emocionais devem aceitar maiúsculas e converter para minúsculas", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 5,
      anxiety_level: 6,
      energy_level: 4,
      recorded_at: now,
      mood_components: [
        { emotion: "JOY", intensity: 7 },
        { emotion: "AnXiEtY", intensity: 6 }
      ]
    });

  t.is(res.status, 201);

  // Verify emotions were lowercased
  const components = db.prepare("SELECT emotion FROM mood_components WHERE mood_id = ? ORDER BY emotion ASC").all(res.body.id);
  t.is(components[0].emotion, 'anxiety');
  t.is(components[1].emotion, 'joy');
});

test("Falha ao criar registro de humor sem ID de usuário", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
  t.true(res.body.missing.includes('user_id'));
});

test("Falha ao criar registro de humor sem nível de stress", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
  t.true(res.body.missing.includes('stress_level'));
});

test("Falha ao criar registro de humor sem nível de ansiedade", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      energy_level: 7,
      recorded_at: now
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
  t.true(res.body.missing.includes('anxiety_level'));
});

test("Falha ao criar registro de humor sem nível de energia", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      recorded_at: now
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
  t.true(res.body.missing.includes('energy_level'));
});

test("Falha ao criar registro de humor sem data de registro", async (t) => {
  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
  t.true(res.body.missing.includes('recorded_at'));
});

test("Falha ao criar registro de humor com nível de estresse inválido (menor que 1)", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 0,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now
    });

  t.is(res.status, 400);
  t.is(res.body.error, "stress_level deve ser entre 1 e 10");
});

test("Falha ao criar registro de humor com nível de estresse inválido (maior que 10)", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 11,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now
    });

  t.is(res.status, 400);
  t.is(res.body.error, "stress_level deve ser entre 1 e 10");
});

test("Falha ao criar registro de humor com nível de ansiedade inválido", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 15,
      energy_level: 7,
      recorded_at: now
    });

  t.is(res.status, 400);
  t.is(res.body.error, "anxiety_level deve ser entre 1 e 10");
});

test("Falha ao criar registro de humor com nível de energia inválido", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: -5,
      recorded_at: now
    });

  t.is(res.status, 400);
  t.is(res.body.error, "energy_level deve ser entre 1 e 10");
});

test("Falha ao criar registro de humor com avaliação inválido", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      rating: 20,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now
    });

  t.is(res.status, 400);
  t.is(res.body.error, "rating deve ser entre 1 e 10");
});

test("Falha ao criar registro de humor com data inválida", async (t) => {
  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: "data-invalida"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "recorded_at deve ser uma data válida");
});

test("Falha ao criar registro de humor com data no futuro", async (t) => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: futureDate.toISOString()
    });

  t.is(res.status, 400);
  t.is(res.body.error, "recorded_at não pode ser no futuro");
});

test("Falha ao criar registro de humor com emoção inválida", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now,
      mood_components: [
        { emotion: "invalid_emotion", intensity: 5 }
      ]
    });

  t.is(res.status, 400);
  t.regex(res.body.error, /Invalid emotion/);
});

test("Falha ao criar registro de humor com intensidade inválida (menor que 1)", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now,
      mood_components: [
        { emotion: "joy", intensity: 0 }
      ]
    });

  t.is(res.status, 400);
  t.regex(res.body.error, /Invalid intensity/);
});

test("Falha ao criar registro de humor com intensidade inválida (maior que 10)", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now,
      mood_components: [
        { emotion: "sad", intensity: 11 }
      ]
    });

  t.is(res.status, 400);
  t.regex(res.body.error, /Invalid intensity/);
});

test("Falha ao criar registro de humor com emoções duplicadas", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now,
      mood_components: [
        { emotion: "joy", intensity: 7 },
        { emotion: "joy", intensity: 5 }
      ]
    });

  t.is(res.status, 400);
  t.regex(res.body.error, /Duplicate emotion/);
});

test("Falha ao criar registro de humor com componente sem emoção de referencia", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now,
      mood_components: [
        { intensity: 5 }
      ]
    });

  t.is(res.status, 400);
  t.regex(res.body.error, /must have emotion and intensity/);
});

test("Falha ao criar registro de humor com componente sem intensidade", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now,
      mood_components: [
        { emotion: "joy" }
      ]
    });

  t.is(res.status, 400);
  t.regex(res.body.error, /must have emotion and intensity/);
});

test("Criar registro de humor com lista vazia de componentes deve funcionar", async (t) => {
  const now = new Date().toISOString();

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now,
      mood_components: []
    });

  t.is(res.status, 201);

  // Verify no components were created
  const components = db.prepare("SELECT * FROM mood_components WHERE mood_id = ?").all(res.body.id);
  t.is(components.length, 0);
});

test("Descrição e título devem ser sanitizados (truncados em 500 caracteres)", async (t) => {
  const now = new Date().toISOString();
  const longText = "A".repeat(600);

  const res = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      stress_level: 3,
      anxiety_level: 4,
      energy_level: 7,
      recorded_at: now,
      title: longText,
      description: longText
    });

  t.is(res.status, 201);

  const mood = db.prepare("SELECT title, description FROM mood WHERE id = ?").get(res.body.id);
  t.is(mood.title.length, 500);
  t.is(mood.description.length, 500);
});
