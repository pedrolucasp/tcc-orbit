import express from "express";
import bcrypt from "bcryptjs";
import {
  isValidEmail,
  isValidPassword,
  sanitizeString,
  validateRequiredFields
} from "../utils/validators.js";

const router = express.Router();

// Create user
router.post("/", (req, res) => {
  const { email, password, first_name, last_name, timezone } = req.body;

  // Validate required fields
  const requiredValidation = validateRequiredFields(req.body, [
    'email', 'password', 'first_name', 'last_name'
  ]);

  if (!requiredValidation.valid) {
    return res.status(400).json({
      error: "Campos faltantes",
      missing: requiredValidation.missing
    });
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Email inválido" });
  }

  // Validate password strength
  if (!isValidPassword(password)) {
    return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const db = req.db;

  try {
    const stmt = db.prepare(`
      INSERT INTO users (email, password, first_name, last_name, timezone)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      email.toLowerCase(),
      hashed,
      sanitizeString(first_name),
      sanitizeString(last_name),
      timezone || 'UTC'
    );

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      res.status(400).json({ error: "Email já cadastrado" });
    } else {
      console.error('Error creating user:', err);
      res.status(500).json({ error: "Erro ao criar usuário" });
    }
  }
});

// User login
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({ error: "Email e senha são obrigatórios" });
  }

  const db = req.db;

  const user = db.prepare(`
    SELECT id, email, password, first_name, last_name, timezone
    FROM users
    WHERE email = ?
  `).get(email.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const passwordMatch = bcrypt.compareSync(password, user.password);

  if (!passwordMatch) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  // Don't send password in response
  delete user.password;

  res.json({
    success: true,
    user
  });
});

// Get user profile
router.get("/:user_id", (req, res) => {
  const userId = req.params.user_id;
  const db = req.db;

  const user = db.prepare(`
    SELECT id, email, first_name, last_name, timezone, created_at, updated_at
    FROM users
    WHERE id = ?
  `).get(userId);

  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  // Get user's mood count
  const moodStats = db.prepare(`
    SELECT COUNT(*) as total_moods
    FROM mood
    WHERE user_id = ?
  `).get(userId);

  user.total_moods = moodStats.total_moods;

  res.json(user);
});

// Update user
router.put("/:user_id", (req, res) => {
  const userId = req.params.user_id;
  const { email, password, first_name, last_name, timezone } = req.body;
  const db = req.db;

  // Check if user exists
  const existingUser = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!existingUser) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  const updates = [];
  const values = [];

  if (email !== undefined) {
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }

    // Check if email is already taken by another user
    const emailCheck = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?")
      .get(email.toLowerCase(), userId);

    if (emailCheck) {
      return res.status(400).json({ error: "Email já está em uso" });
    }

    updates.push("email = ?");
    values.push(email.toLowerCase());
  }

  if (password !== undefined) {
    if (!isValidPassword(password)) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres" });
    }
    updates.push("password = ?");
    values.push(bcrypt.hashSync(password, 10));
  }

  if (first_name !== undefined) {
    updates.push("first_name = ?");
    values.push(sanitizeString(first_name));
  }

  if (last_name !== undefined) {
    updates.push("last_name = ?");
    values.push(sanitizeString(last_name));
  }

  if (timezone !== undefined) {
    updates.push("timezone = ?");
    values.push(timezone);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: "Nenhum campo para atualizar" });
  }

  updates.push("updated_at = CURRENT_TIMESTAMP");

  try {
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    values.push(userId);

    db.prepare(updateQuery).run(...values);

    res.json({ success: true, id: userId });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

// Delete user
router.delete("/:user_id", (req, res) => {
  const userId = req.params.user_id;
  const db = req.db;

  // This will cascade delete all moods and mood_components
  const result = db.prepare("DELETE FROM users WHERE id = ?").run(userId);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Usuário não encontrado" });
  }

  res.json({ success: true, deleted: userId });
});

export default router;