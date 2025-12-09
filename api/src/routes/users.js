const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const router = express.Router();

// XXX: Needs translations
router.post("/", (req, res) => {
  const { email, password, first_name, last_name } = req.body;
  if (!email || !password || !first_name || !last_name)
    return res.status(400).json({ error: "Campos faltantes" });

  const hashed = bcrypt.hashSync(password, 10);

  try {
    const stmt = db.prepare(
      `
        INSERT INTO users (email, password, first_name, last_name)
        VALUES (?, ?, ?, ?)
      `
    );

    const result = stmt.run(email, hashed, first_name, last_name);

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: "Email já cadastrado" });
  }
});

module.exports = router;

