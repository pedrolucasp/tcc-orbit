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

let testEmail;

test.serial.beforeEach(async () => {
  cleanupTestDb();

  // Create a test user with unique email
  testEmail = `perfil_${Date.now()}_${Math.random()}@example.com`;
  const res = await request(app)
    .post("/users")
    .send({
      email: testEmail,
      password: "senha123",
      first_name: "Perfil",
      last_name: "Teste",
      timezone: "America/Sao_Paulo"
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create test user: ${JSON.stringify(res.body)}`);
  }

  userId = res.body.id;
});

test.serial("Obter perfil de usuário existente", async (t) => {
  const res = await request(app).get(`/users/${userId}`);

  t.is(res.status, 200);
  t.is(Number(res.body.id), Number(userId));
  t.is(res.body.email, testEmail);
  t.is(res.body.first_name, "Perfil");
  t.is(res.body.last_name, "Teste");
  t.is(res.body.timezone, "America/Sao_Paulo");
  t.truthy(res.body.created_at);
  t.truthy(res.body.updated_at);
  t.is(typeof res.body.total_moods, 'number');
  t.falsy(res.body.password); // Should not include password
});

test.serial("Perfil deve incluir contagem de registros de humor", async (t) => {
  // Add some moods
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO mood (user_id, rating, stress_level, anxiety_level, energy_level, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, 7, 3, 4, 8, now);

  await db.prepare(`
    INSERT INTO mood (user_id, rating, stress_level, anxiety_level, energy_level, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, 5, 6, 7, 4, now);

  const res = await request(app).get(`/users/${userId}`);

  t.is(res.status, 200);
  t.is(res.body.total_moods, 2);
});

test.serial("Falha ao obter perfil de usuário inexistente", async (t) => {
  const res = await request(app).get("/users/99999");

  t.is(res.status, 404);
  t.is(res.body.error, "Usuário não encontrado");
});

test.serial("Atualizar email do usuário", async (t) => {
  const res = await request(app)
    .put(`/users/${userId}`)
    .send({
      email: "novoemail@example.com"
    });

  t.is(res.status, 200);
  t.true(res.body.success);

  // Verify update
  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId);
  t.is(user.email, "novoemail@example.com");
});

test.serial("Atualizar senha do usuário", async (t) => {
  const res = await request(app)
    .put(`/users/${userId}`)
    .send({
      password: "novasenha123"
    });

  t.is(res.status, 200);
  t.true(res.body.success);

  // Verify can login with new password
  const loginRes = await request(app)
    .post("/users/login")
    .send({
      email: testEmail,
      password: "novasenha123"
    });

  t.is(loginRes.status, 200);
});

test.serial("Atualizar múltiplos campos do usuário", async (t) => {
  const res = await request(app)
    .put(`/users/${userId}`)
    .send({
      first_name: "NovoNome",
      last_name: "NovoSobrenome",
      timezone: "Europe/London"
    });

  t.is(res.status, 200);
  t.true(res.body.success);

  // Verify updates
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  t.is(user.first_name, "NovoNome");
  t.is(user.last_name, "NovoSobrenome");
  t.is(user.timezone, "Europe/London");
});

test.serial("Falha ao atualizar com email inválido", async (t) => {
  const res = await request(app)
    .put(`/users/${userId}`)
    .send({
      email: "emailinvalido"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Email inválido");
});

test.serial("Falha ao atualizar com senha muito curta", async (t) => {
  const res = await request(app)
    .put(`/users/${userId}`)
    .send({
      password: "123"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Senha deve ter pelo menos 6 caracteres");
});

test.serial("Falha ao atualizar email para um já existente", async (t) => {
  // Create another user
  await request(app)
    .post("/users")
    .send({
      email: "outro@example.com",
      password: "senha123",
      first_name: "Outro",
      last_name: "Usuario"
    });

  // Try to update to existing email
  const res = await request(app)
    .put(`/users/${userId}`)
    .send({
      email: "outro@example.com"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Email já está em uso");
});

test.serial("Falha ao atualizar usuário inexistente", async (t) => {
  const res = await request(app)
    .put("/users/99999")
    .send({
      first_name: "Novo"
    });

  t.is(res.status, 404);
  t.is(res.body.error, "Usuário não encontrado");
});

test.serial("Falha ao atualizar sem campos", async (t) => {
  const res = await request(app)
    .put(`/users/${userId}`)
    .send({});

  t.is(res.status, 400);
  t.is(res.body.error, "Nenhum campo para atualizar");
});

test.serial("Deletar usuário existente", async (t) => {
  const res = await request(app).delete(`/users/${userId}`);

  t.is(res.status, 200);
  t.true(res.body.success);
  t.is(Number(res.body.deleted), Number(userId));

  // Verify user is deleted
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  t.falsy(user);
});

test.serial("Deletar usuário deve deletar seus registros de humores (em cascata)", async (t) => {
  // Add a mood
  const now = new Date().toISOString();
  const moodResult = db.prepare(`
    INSERT INTO mood (user_id, rating, stress_level, anxiety_level, energy_level, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, 7, 3, 4, 8, now);

  const moodId = moodResult.lastInsertRowid;

  // Add mood components
  db.prepare(`
    INSERT INTO mood_components (mood_id, emotion, intensity)
    VALUES (?, ?, ?)
  `).run(moodId, 'joy', 8);

  // Delete user
  const res = await request(app).delete(`/users/${userId}`);
  t.is(res.status, 200);

  // Verify moods are deleted
  const mood = db.prepare("SELECT * FROM mood WHERE user_id = ?").get(userId);
  t.falsy(mood);

  // Verify mood components are deleted
  const component = db.prepare("SELECT * FROM mood_components WHERE mood_id = ?").get(moodId);
  t.falsy(component);
});

test.serial("Falha ao deletar usuário inexistente", async (t) => {
  const res = await request(app).delete("/users/99999");

  t.is(res.status, 404);
  t.is(res.body.error, "Usuário não encontrado");
});
