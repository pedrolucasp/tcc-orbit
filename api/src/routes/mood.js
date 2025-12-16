import express from "express";

const router = express.Router();

router.post("/", (req, res) => {
  const { user_id, stress_level, anxiety_level, title, description } = req.body;

  if (!user_id || !stress_level || !anxiety_level)
    return res.status(400).json({ error: "Campos faltantes" });

  const stmt = req.db.prepare(
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
  const stmt = req.db.prepare("SELECT * FROM mood WHERE user_id = ?");
  const rows = stmt.all(req.params.user_id);

  res.json(rows);
});

export default router;

