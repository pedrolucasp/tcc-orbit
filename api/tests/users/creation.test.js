import test from "ava";
import request from "supertest";
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
});

test("Criar usuário com todos os campos válidos", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "usuario@example.com",
      password: "senha123",
      first_name: "João",
      last_name: "Silva",
      timezone: "America/Sao_Paulo"
    });

  t.is(res.status, 201);
  t.truthy(res.body.id);
});

test("Criar usuário com timezone padrão (UTC)", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "utc@example.com",
      password: "senha123",
      first_name: "Maria",
      last_name: "Santos"
    });

  t.is(res.status, 201);

  // Verify timezone was set to UTC
  const user = db.prepare("SELECT timezone FROM users WHERE id = ?").get(res.body.id);
  t.is(user.timezone, 'UTC');
});

test("Falha ao criar usuário sem email", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      password: "senha123",
      first_name: "João",
      last_name: "Silva"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
  t.true(res.body.missing.includes('email'));
});

test("Falha ao criar usuário sem senha", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "usuario@example.com",
      first_name: "João",
      last_name: "Silva"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
  t.true(res.body.missing.includes('password'));
});

test("Falha ao criar usuário sem primeiro nome", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "usuario@example.com",
      password: "senha123",
      last_name: "Silva"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
  t.true(res.body.missing.includes('first_name'));
});

test("Falha ao criar usuário sem último nome", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "usuario@example.com",
      password: "senha123",
      first_name: "João"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
  t.true(res.body.missing.includes('last_name'));
});

test("Falha ao criar usuário com múltiplos campos faltantes", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      first_name: "João"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
  t.true(res.body.missing.includes('email'));
  t.true(res.body.missing.includes('password'));
  t.true(res.body.missing.includes('last_name'));
});

test("Falha ao criar usuário com email inválido (sem @)", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "emailinvalido",
      password: "senha123",
      first_name: "João",
      last_name: "Silva"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Email inválido");
});

test("Falha ao criar usuário com email inválido (sem domínio)", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "usuario@",
      password: "senha123",
      first_name: "João",
      last_name: "Silva"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Email inválido");
});

test("Falha ao criar usuário com email inválido (formato incorreto)", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "@example.com",
      password: "senha123",
      first_name: "João",
      last_name: "Silva"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Email inválido");
});

test("Falha ao criar usuário com senha muito curta (menos de 6 caracteres)", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "usuario@example.com",
      password: "123",
      first_name: "João",
      last_name: "Silva"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Senha deve ter pelo menos 6 caracteres");
});

test("Falha ao criar usuário com senha vazia", async (t) => {
  const res = await request(app)
    .post("/users")
    .send({
      email: "usuario@example.com",
      password: "",
      first_name: "João",
      last_name: "Silva"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Campos faltantes");
});

test("Falha ao criar usuário com email duplicado", async (t) => {
  // Create first user
  await request(app)
    .post("/users")
    .send({
      email: "duplicado@example.com",
      password: "senha123",
      first_name: "João",
      last_name: "Silva"
    });

  // Try to create with same email
  const res = await request(app)
    .post("/users")
    .send({
      email: "duplicado@example.com",
      password: "outrasenha",
      first_name: "Maria",
      last_name: "Santos"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Email já cadastrado");
});

test("Email deve ser case-insensitive para duplicação", async (t) => {
  // Create with lowercase
  await request(app)
    .post("/users")
    .send({
      email: "usuario@example.com",
      password: "senha123",
      first_name: "João",
      last_name: "Silva"
    });

  // Try with uppercase
  const res = await request(app)
    .post("/users")
    .send({
      email: "USUARIO@EXAMPLE.COM",
      password: "senha123",
      first_name: "Maria",
      last_name: "Santos"
    });

  t.is(res.status, 400);
  t.is(res.body.error, "Email já cadastrado");
});

test("Sanitização de strings longas no nome", async (t) => {
  const longName = "A".repeat(600); // 600 characters

  const res = await request(app)
    .post("/users")
    .send({
      email: "longname@example.com",
      password: "senha123",
      first_name: longName,
      last_name: longName
    });

  t.is(res.status, 201);

  // Check that name was truncated to 500 chars
  const user = db.prepare("SELECT first_name, last_name FROM users WHERE id = ?").get(res.body.id);
  t.is(user.first_name.length, 500);
  t.is(user.last_name.length, 500);
});