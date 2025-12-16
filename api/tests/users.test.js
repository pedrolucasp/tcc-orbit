import test from "ava";
import request from "supertest";
import { createApp } from "../src/create-app.js";
import { setupTestDb, cleanupTestDb } from "./test-helper.js";

let app;
let db;

test.before(() => {
  db = setupTestDb();
  app = createApp(db);
});

test.beforeEach(() => {
  cleanupTestDb();
});

test("Criar usuário", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "john@example.com",
      password: "123456",
      first_name: "John",
      last_name: "Doe",
    });

  t.is(res.status, 201);
  t.truthy(res.body.id);
});

test("Falha ao criar usuário sem email", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      password: "123456",
      first_name: "John",
      last_name: "Doe",
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
});

test("Falha ao criar usuário com email duplicado", async (t) => {
  // First user
  await request(app)
    .post("/users")
    .send({
      email: "duplicate@example.com",
      password: "123456",
      first_name: "John",
      last_name: "Doe",
    });

  // Duplicate email
  const res = await request(app)
    .post("/users")
    .send({
      email: "duplicate@example.com",
      password: "123456",
      first_name: "Jane",
      last_name: "Smith",
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Email já cadastrado");
});
