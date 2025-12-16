import test from "ava";
import request from "supertest";
import { createApp } from "../src/create-app.js";
import { setupTestDb, cleanupTestDb } from "./test-helper.js";

let app;
let db;
let userId;

test.before(() => {
  db = setupTestDb();
  app = createApp(db);
});

test.beforeEach(async () => {
  cleanupTestDb();

  // Create a user for the mood tests
  const res = await request(app)
    .post("/users")
    .send({
      email: "maria@example.com",
      password: "123456",
      first_name: "Maria",
      last_name: "Silva",
    });

  userId = res.body.id;
});

test.serial("Registrar humor", async (t) => {
  const res = await request(app).post("/mood").send({
    user_id: userId,
    stress_level: 3,
    anxiety_level: 4,
    energy_level: 5,
    title: "Bad day",
    description: "Stressado com a faculdade",
    recorded_at: new Date().toISOString()
  });

  t.is(res.status, 201);
  t.truthy(res.body.id);
});

test.serial("Listar humores do usuário", async (t) => {
  const res = await request(app).get(`/mood/user/${userId}`);
  t.is(res.status, 200);
  t.true(Array.isArray(res.body.moods));
});

test.serial("Falha ao registrar humor sem stress_level", async (t) => {
  const res = await request(app).post("/mood").send({
    user_id: userId,
    anxiety_level: 4,
    energy_level: 5,
    title: "Test",
    recorded_at: new Date().toISOString()
  });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
});

test.serial("Listar múltiplos humores do usuário", async (t) => {
  // Ensure we have a valid userId
  t.truthy(userId, "userId should be defined");

  // Create first mood entry
  const res1 = await request(app).post("/mood").send({
    user_id: userId,
    stress_level: 3,
    anxiety_level: 4,
    energy_level: 6,
    title: "Morning",
    description: "Morning mood",
    recorded_at: new Date().toISOString()
  });
  t.is(res1.status, 201);

  // Create second mood entry
  const res2 = await request(app).post("/mood").send({
    user_id: userId,
    stress_level: 2,
    anxiety_level: 2,
    energy_level: 8,
    title: "Evening",
    description: "Evening mood",
    recorded_at: new Date().toISOString()
  });
  t.is(res2.status, 201);

  const res = await request(app).get(`/mood/user/${userId}`);
  t.is(res.status, 200);
  t.true(Array.isArray(res.body.moods));
  t.is(res.body.moods.length, 2);
});

