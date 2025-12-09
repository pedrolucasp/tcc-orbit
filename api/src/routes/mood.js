const express = require("express");
const db = require("../db");
const router = express.Router();

router.post("/", (req, res) => {
  const { user_id, stress_level, anxiety_level, title, description } = req.body;

  if (!user_id || !stress_level || !anxiety_level)
    return res.status(400).json({ error: "Campos fatlantes" });

  const stmt = db.prepare(
    `
      INSERT INTO mood (user_id, stress_level, anxiety_level, title, description)
      VALUES (?, ?, ?, ?, ?)
    `
  );

  const result = stmt.run(
    user_id, stress_level, anxiety_level, title || null, description || null
  );

  res.status(201).json({ id: result.lastInsertRowid });
});

router.get("/:user_id", (req, res) => {
  const stmt = db.prepare("SELECT * FROM mood WHERE user_id = ?");
  const rows = stmt.all(req.params.user_id);

  res.json(rows);
});

module.exports = router;

