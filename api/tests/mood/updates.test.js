import test from "ava";
import request from "supertest";
import { createApp } from "../../src/create-app.js";
import { setupTestDb, cleanupTestDb } from "../test-helper.js";

let app;
let db;
let userId;
let moodId;

test.before(() => {
  db = setupTestDb();
  app = createApp(db);
});

test.beforeEach(async () => {
  cleanupTestDb();

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

  // Create a mood to update
  const moodRes = await request(app)
    .post("/mood")
    .send({
      user_id: userId,
      rating: 5,
      stress_level: 4,
      anxiety_level: 3,
      energy_level: 7,
      title: "Original mood",
      description: "Original description",
      recorded_at: new Date().toISOString(),
      mood_components: [
        { emotion: "joy", intensity: 6 },
        { emotion: "trust", intensity: 7 }
      ]
    });

  moodId = moodRes.body.id;
});

test.serial("Atualizar rating do mood", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      rating: 8
    });

  t.is(res.status, 200);
  t.true(res.body.success);

  // Verify update
  const mood = db.prepare("SELECT rating FROM mood WHERE id = ?").get(moodId);
  t.is(mood.rating, 8);
});

test.serial("Atualizar múltiplos níveis do mood", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      stress_level: 2,
      anxiety_level: 1,
      energy_level: 9
    });

  t.is(res.status, 200);
  t.true(res.body.success);

  // Verify updates
  const mood = db.prepare("SELECT stress_level, anxiety_level, energy_level FROM mood WHERE id = ?").get(moodId);
  t.is(mood.stress_level, 2);
  t.is(mood.anxiety_level, 1);
  t.is(mood.energy_level, 9);
});

test.serial("Atualizar título e descrição do mood", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      title: "Novo título",
      description: "Nova descrição detalhada"
    });

  t.is(res.status, 200);
  t.true(res.body.success);

  // Verify updates
  const mood = db.prepare("SELECT title, description FROM mood WHERE id = ?").get(moodId);
  t.is(mood.title, "Novo título");
  t.is(mood.description, "Nova descrição detalhada");
});

test.serial("Atualizar data do mood", async (t) => {
  const newDate = new Date('2024-01-15T10:00:00Z');

  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      recorded_at: newDate.toISOString()
    });

  t.is(res.status, 200);
  t.true(res.body.success);

  // Verify update
  const mood = db.prepare("SELECT recorded_at FROM mood WHERE id = ?").get(moodId);
  t.truthy(mood.recorded_at.includes('2024-01-15'));
});

test.serial("Atualizar componentes emocionais do mood", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      mood_components: [
        { emotion: "sad", intensity: 4 },
        { emotion: "fear", intensity: 3 },
        { emotion: "angry", intensity: 2 }
      ]
    });

  t.is(res.status, 200);
  t.true(res.body.success);

  // Verify old components were replaced
  const components = db.prepare("SELECT emotion, intensity FROM mood_components WHERE mood_id = ? ORDER BY emotion").all(moodId);
  t.is(components.length, 3);

  const emotions = components.map(c => c.emotion);
  t.true(emotions.includes('sad'));
  t.true(emotions.includes('fear'));
  t.true(emotions.includes('angry'));
  t.false(emotions.includes('joy')); // Old emotion should be gone
  t.false(emotions.includes('trust')); // Old emotion should be gone
});

test.serial("Remover todos os componentes emocionais enviando array vazio", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      mood_components: []
    });

  t.is(res.status, 200);
  t.true(res.body.success);

  // Verify components were deleted
  const components = db.prepare("SELECT * FROM mood_components WHERE mood_id = ?").all(moodId);
  t.is(components.length, 0);
});

test.serial("Atualização deve modificar a coluna de atualização", async (t) => {
  // Get original updated_at
  const originalMood = db.prepare("SELECT updated_at FROM mood WHERE id = ?")
    .get(moodId);

  // Wait a bit to ensure timestamp difference
  await new Promise(resolve => setTimeout(resolve, 1100));

  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      rating: 9
    });

  t.is(res.status, 200);

  // Verify updated_at changed
  const updatedMood = db.prepare("SELECT updated_at FROM mood WHERE id = ?")
    .get(moodId);

  t.not(updatedMood.updated_at, originalMood.updated_at);
});

test.serial("Falha ao atualizar humor inexistente", async (t) => {
  const res = await request(app)
    .put("/mood/99999")
    .send({
      rating: 8
    });

  t.is(res.status, 404);
  t.is(res.body.error, "Humor não encontrado");
});

test.serial("Falha ao atualizar com avaliação inválida", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      rating: 15
    });

  t.is(res.status, 400);
  t.is(res.body.error, "rating deve ser entre 1 e 10");
});

test.serial("Falha ao atualizar com nível de estresse inválido", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      stress_level: 0
    });

  t.is(res.status, 400);
  t.is(res.body.error, "stress_level deve ser entre 1 e 10");
});

test.serial("Falha ao atualizar com nível de ansiedade inválido", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      anxiety_level: 11
    });

  t.is(res.status, 400);
  t.is(res.body.error, "anxiety_level deve ser entre 1 e 10");
});

test.serial("Falha ao atualizar com nível de energia inválida", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      energy_level: -1
    });

  t.is(res.status, 400);
  t.is(res.body.error, "energy_level deve ser entre 1 e 10");
});

test.serial("Falha ao atualizar com data inválida", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      recorded_at: "data-invalida"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "recorded_at deve ser uma data válida");
});

test.serial("Falha ao atualizar com data no futuro", async (t) => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);

  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      recorded_at: futureDate.toISOString()
    });

  t.is(res.status, 400);
  t.is(res.body.error, "recorded_at não pode ser no futuro");
});

test.serial("Falha ao atualizar com emoção inválida nos componentes", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      mood_components: [
        { emotion: "invalid", intensity: 5 }
      ]
    });

  t.is(res.status, 400);
  t.regex(res.body.error, /Invalid emotion/);
});

test.serial("Falha ao atualizar com emoções duplicadas", async (t) => {
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      mood_components: [
        { emotion: "joy", intensity: 5 },
        { emotion: "joy", intensity: 7 }
      ]
    });

  t.is(res.status, 400);
  t.regex(res.body.error, /Duplicate emotion/);
});

test.serial("Deletar humor existente", async (t) => {
  const res = await request(app).delete(`/mood/${moodId}`);

  t.is(res.status, 200);
  t.true(res.body.success);
  t.is(Number(res.body.deleted), Number(moodId));

  // Verify mood is deleted
  const mood = db.prepare("SELECT * FROM mood WHERE id = ?").get(moodId);
  t.falsy(mood);
});

test.serial("Deletar humor deve deletar seus componentes (em cascata)", async (t) => {
  // Verify components exist
  const componentsBefore = db.prepare("SELECT * FROM mood_components WHERE mood_id = ?").all(moodId);
  t.true(componentsBefore.length > 0);

  const res = await request(app).delete(`/mood/${moodId}`);
  t.is(res.status, 200);

  // Verify components are deleted
  const componentsAfter = db.prepare("SELECT * FROM mood_components WHERE mood_id = ?").all(moodId);
  t.is(componentsAfter.length, 0);
});

test.serial("Falha ao deletar mood inexistente", async (t) => {
  const res = await request(app).delete("/mood/99999");

  t.is(res.status, 404);
  t.is(res.body.error, "Humor não encontrado");
});

test.serial("Atualização parcial mantém valores não alterados", async (t) => {
  // Get original values
  const originalMood = db.prepare("SELECT * FROM mood WHERE id = ?").get(moodId);

  // Update only rating
  const res = await request(app)
    .put(`/mood/${moodId}`)
    .send({
      rating: 10
    });

  t.is(res.status, 200);

  // Verify only rating changed, others remained
  const updatedMood = db.prepare("SELECT * FROM mood WHERE id = ?").get(moodId);
  t.is(updatedMood.rating, 10);
  t.is(updatedMood.stress_level, originalMood.stress_level);
  t.is(updatedMood.anxiety_level, originalMood.anxiety_level);
  t.is(updatedMood.energy_level, originalMood.energy_level);
  t.is(updatedMood.title, originalMood.title);
  t.is(updatedMood.description, originalMood.description);
});
