import test from "ava";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../../src/create-app.js";
import { setupTestDb, cleanupTestDb } from "../test-helper.js";

let app;
let db;

test.before(() => {
  db = setupTestDb();
  app = createApp(db);
});

test.beforeEach(() => {
  cleanupTestDb();

  // Create a test user for login tests
  const hashedPassword = bcrypt.hashSync("senha123", 10);
  db.prepare(`
    INSERT INTO users (email, password, first_name, last_name, timezone)
    VALUES (?, ?, ?, ?, ?)
  `).run("teste@example.com", hashedPassword, "Teste", "User", "UTC");
});

test("Login bem-sucedido com credenciais corretas", async (t) => {
  const res = await request(app)
    .post("/users/login")
    .send({
      email: "teste@example.com",
      password: "senha123"
    });

  t.is(res.status, 200);
  t.true(res.body.success);
  t.truthy(res.body.user);
  t.is(res.body.user.email, "teste@example.com");
  t.is(res.body.user.first_name, "Teste");
  t.is(res.body.user.last_name, "User");
  t.falsy(res.body.user.password); // Password should not be in response
});

test("Login com email em maiúsculas deve funcionar", async (t) => {
  const res = await request(app)
    .post("/users/login")
    .send({
      email: "TESTE@EXAMPLE.COM",
      password: "senha123"
    });

  t.is(res.status, 200);
  t.true(res.body.success);
});

test("Falha no login com senha incorreta", async (t) => {
  const res = await request(app)
    .post("/users/login")
    .send({
      email: "teste@example.com",
      password: "senhaerrada"
    });

  t.is(res.status, 401);
  t.is(res.body.error, "Credenciais inválidas");
});

test("Falha no login com email não cadastrado", async (t) => {
  const res = await request(app)
    .post("/users/login")
    .send({
      email: "naocadastrado@example.com",
      password: "senha123"
    });

  t.is(res.status, 401);
  t.is(res.body.error, "Credenciais inválidas");
});

test("Falha no login sem email", async (t) => {
  const res = await request(app)
    .post("/users/login")
    .send({
      password: "senha123"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Email e senha são obrigatórios");
});

test("Falha no login sem senha", async (t) => {
  const res = await request(app)
    .post("/users/login")
    .send({
      email: "teste@example.com"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Email e senha são obrigatórios");
});

test("Falha no login sem credenciais", async (t) => {
  const res = await request(app)
    .post("/users/login")
    .send({});

  t.is(res.status, 400);
  t.is(res.body.error, "Email e senha são obrigatórios");
});

test("Login não deve retornar a senha do usuário", async (t) => {
  const res = await request(app)
    .post("/users/login")
    .send({
      email: "teste@example.com",
      password: "senha123"
    });

  t.is(res.status, 200);
  t.falsy(res.body.user.password);
  t.is(typeof res.body.user.password, 'undefined');
});

test("Login deve retornar informações completas do usuário", async (t) => {
  const res = await request(app)
    .post("/users/login")
    .send({
      email: "teste@example.com",
      password: "senha123"
    });

  t.is(res.status, 200);
  t.truthy(res.body.user.id);
  t.is(res.body.user.email, "teste@example.com");
  t.is(res.body.user.first_name, "Teste");
  t.is(res.body.user.last_name, "User");
  t.is(res.body.user.timezone, "UTC");
});

test("Login com espaços em branco deve ser tratado corretamente", async (t) => {
  const res = await request(app)
    .post("/users/login")
    .send({
      email: "  teste@example.com  ",
      password: "senha123"
    });

  t.is(res.status, 401); // Should fail as email with spaces doesn't match
});