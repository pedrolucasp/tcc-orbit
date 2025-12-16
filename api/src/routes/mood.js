import express from "express";
import {
  validateMoodComponents,
  isValidLevel,
  isValidRating,
  calculateEmotionStats
} from "../utils/emotions.js";
import {
  validateRequiredFields,
  isValidDate,
  isNotFutureDate,
  isValidDateRange,
  sanitizeString,
  validatePagination
} from "../utils/validators.js";

const router = express.Router();

// Create new mood entry with components
router.post("/", (req, res) => {
  const {
    user_id,
    rating,
    stress_level,
    anxiety_level,
    energy_level,
    title,
    description,
    recorded_at,
    mood_components
  } = req.body;

  // Validate required fields
  const requiredValidation = validateRequiredFields(req.body, [
    'user_id', 'stress_level', 'anxiety_level', 'energy_level', 'recorded_at'
  ]);

  if (!requiredValidation.valid) {
    return res.status(400).json({
      error: "Campos faltantes",
      missing: requiredValidation.missing
    });
  }

  // Validate levels
  if (!isValidLevel(stress_level)) {
    return res.status(400).json({ error: "stress_level deve ser entre 1 e 10" });
  }
  if (!isValidLevel(anxiety_level)) {
    return res.status(400).json({ error: "anxiety_level deve ser entre 1 e 10" });
  }
  if (!isValidLevel(energy_level)) {
    return res.status(400).json({ error: "energy_level deve ser entre 1 e 10" });
  }

  // Validate optional rating
  if (rating && !isValidRating(rating)) {
    return res.status(400).json({ error: "rating deve ser entre 1 e 10" });
  }

  // Validate date
  if (!isValidDate(recorded_at)) {
    return res.status(400).json({ error: "recorded_at deve ser uma data válida" });
  }

  if (!isNotFutureDate(recorded_at)) {
    return res.status(400).json({ error: "recorded_at não pode ser no futuro" });
  }

  // Validate mood components if provided
  if (mood_components) {
    const componentValidation = validateMoodComponents(mood_components);
    if (!componentValidation.valid) {
      return res.status(400).json({ error: componentValidation.error });
    }
  }

  const db = req.db;

  try {
    // Start transaction
    db.prepare("BEGIN").run();

    // Insert mood entry
    const moodStmt = db.prepare(`
      INSERT INTO mood (
        user_id, rating, stress_level, anxiety_level, energy_level,
        title, description, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const moodResult = moodStmt.run(
      user_id,
      rating || null,
      stress_level,
      anxiety_level,
      energy_level,
      sanitizeString(title) || null,
      sanitizeString(description) || null,
      recorded_at
    );

    const moodId = moodResult.lastInsertRowid;

    // Insert mood components if provided
    if (mood_components && mood_components.length > 0) {
      const componentStmt = db.prepare(`
        INSERT INTO mood_components (mood_id, emotion, intensity)
        VALUES (?, ?, ?)
      `);

      for (const component of mood_components) {
        componentStmt.run(
          moodId,
          component.emotion.toLowerCase(),
          component.intensity
        );
      }
    }

    // Commit transaction
    db.prepare("COMMIT").run();

    res.status(201).json({ id: moodId });
  } catch (err) {
    // Rollback on error
    db.prepare("ROLLBACK").run();
    console.error('Error creating mood:', err);
    res.status(500).json({ error: "Erro ao criar registro de humor" });
  }
});

// Get single mood entry with components
router.get("/:mood_id", (req, res) => {
  const moodId = req.params.mood_id;
  const db = req.db;

  const moodStmt = db.prepare(`
    SELECT m.*, u.first_name, u.last_name
    FROM mood m
    JOIN users u ON m.user_id = u.id
    WHERE m.id = ?
  `);

  const mood = moodStmt.get(moodId);

  if (!mood) {
    return res.status(404).json({ error: "Humor não encontrado" });
  }

  // Get mood components
  const componentsStmt = db.prepare(`
    SELECT emotion, intensity
    FROM mood_components
    WHERE mood_id = ?
  `);

  const components = componentsStmt.all(moodId);
  mood.mood_components = components;

  // Calculate emotion stats
  if (components.length > 0) {
    mood.emotion_stats = calculateEmotionStats(components);
  }

  res.json(mood);
});

// Update mood entry
router.put("/:mood_id", (req, res) => {
  const moodId = req.params.mood_id;
  const {
    rating,
    stress_level,
    anxiety_level,
    energy_level,
    title,
    description,
    recorded_at,
    mood_components
  } = req.body;

  const db = req.db;

  // Check if mood exists
  const existingMood = db.prepare("SELECT id FROM mood WHERE id = ?").get(moodId);
  if (!existingMood) {
    return res.status(404).json({ error: "Humor não encontrado" });
  }

  // Build update query dynamically
  const updates = [];
  const values = [];

  if (rating !== undefined) {
    if (!isValidRating(rating)) {
      return res.status(400).json({ error: "rating deve ser entre 1 e 10" });
    }
    updates.push("rating = ?");
    values.push(rating);
  }

  if (stress_level !== undefined) {
    if (!isValidLevel(stress_level)) {
      return res.status(400).json({ error: "stress_level deve ser entre 1 e 10" });
    }
    updates.push("stress_level = ?");
    values.push(stress_level);
  }

  if (anxiety_level !== undefined) {
    if (!isValidLevel(anxiety_level)) {
      return res.status(400).json({ error: "anxiety_level deve ser entre 1 e 10" });
    }
    updates.push("anxiety_level = ?");
    values.push(anxiety_level);
  }

  if (energy_level !== undefined) {
    if (!isValidLevel(energy_level)) {
      return res.status(400).json({ error: "energy_level deve ser entre 1 e 10" });
    }
    updates.push("energy_level = ?");
    values.push(energy_level);
  }

  if (title !== undefined) {
    updates.push("title = ?");
    values.push(sanitizeString(title) || null);
  }

  if (description !== undefined) {
    updates.push("description = ?");
    values.push(sanitizeString(description) || null);
  }

  if (recorded_at !== undefined) {
    if (!isValidDate(recorded_at)) {
      return res.status(400).json({ error: "recorded_at deve ser uma data válida" });
    }
    if (!isNotFutureDate(recorded_at)) {
      return res.status(400).json({ error: "recorded_at não pode ser no futuro" });
    }
    updates.push("recorded_at = ?");
    values.push(recorded_at);
  }

  updates.push("updated_at = CURRENT_TIMESTAMP");

  try {
    db.prepare("BEGIN").run();

    // Update mood if there are changes
    if (updates.length > 0) {
      const updateQuery = `UPDATE mood SET ${updates.join(', ')} WHERE id = ?`;
      values.push(moodId);
      db.prepare(updateQuery).run(...values);
    }

    // Update mood components if provided
    if (mood_components !== undefined) {
      const componentValidation = validateMoodComponents(mood_components);
      if (!componentValidation.valid) {
        db.prepare("ROLLBACK").run();
        return res.status(400).json({ error: componentValidation.error });
      }

      // Delete existing components
      db.prepare("DELETE FROM mood_components WHERE mood_id = ?").run(moodId);

      // Insert new components
      if (mood_components.length > 0) {
        const componentStmt = db.prepare(`
          INSERT INTO mood_components (mood_id, emotion, intensity)
          VALUES (?, ?, ?)
        `);

        for (const component of mood_components) {
          componentStmt.run(
            moodId,
            component.emotion.toLowerCase(),
            component.intensity
          );
        }
      }
    }

    db.prepare("COMMIT").run();
    res.json({ success: true, id: moodId });
  } catch (err) {
    db.prepare("ROLLBACK").run();
    console.error('Error updating mood:', err);
    res.status(500).json({ error: "Erro ao atualizar humor" });
  }
});

// Delete mood entry
router.delete("/:mood_id", (req, res) => {
  const moodId = req.params.mood_id;
  const db = req.db;

  const result = db.prepare("DELETE FROM mood WHERE id = ?").run(moodId);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Humor não encontrado" });
  }

  res.json({ success: true, deleted: moodId });
});

// Get user's moods with optional date range
router.get("/user/:user_id", (req, res) => {
  const userId = req.params.user_id;
  const { start_date, end_date, page, limit } = req.query;
  const db = req.db;

  // Validate pagination
  const { page: validPage, limit: validLimit, offset } = validatePagination(page, limit);

  let query = `
    SELECT m.*,
           COUNT(mc.id) as component_count
    FROM mood m
    LEFT JOIN mood_components mc ON m.id = mc.mood_id
    WHERE m.user_id = ?
  `;
  const params = [userId];

  // Add date range filtering
  if (start_date && end_date) {
    if (!isValidDateRange(start_date, end_date)) {
      return res.status(400).json({ error: "Intervalo de datas inválido" });
    }
    query += " AND m.recorded_at BETWEEN ? AND ?";
    params.push(start_date, end_date);
  } else if (start_date) {
    if (!isValidDate(start_date)) {
      return res.status(400).json({ error: "Data de início inválida" });
    }
    query += " AND m.recorded_at >= ?";
    params.push(start_date);
  } else if (end_date) {
    if (!isValidDate(end_date)) {
      return res.status(400).json({ error: "Data de fim inválida" });
    }
    query += " AND m.recorded_at <= ?";
    params.push(end_date);
  }

  query += " GROUP BY m.id ORDER BY m.recorded_at DESC LIMIT ? OFFSET ?";
  params.push(validLimit, offset);

  const moods = db.prepare(query).all(...params);

  // Get components for each mood
  const moodIds = moods.map(m => m.id);
  if (moodIds.length > 0) {
    const componentsQuery = `
      SELECT mood_id, emotion, intensity
      FROM mood_components
      WHERE mood_id IN (${moodIds.map(() => '?').join(',')})
    `;

    const components = db.prepare(componentsQuery).all(...moodIds);

    // Group components by mood_id
    const componentsByMood = {};
    components.forEach(c => {
      if (!componentsByMood[c.mood_id]) {
        componentsByMood[c.mood_id] = [];
      }
      componentsByMood[c.mood_id].push({
        emotion: c.emotion,
        intensity: c.intensity
      });
    });

    // Attach components to moods
    moods.forEach(mood => {
      mood.mood_components = componentsByMood[mood.id] || [];
      if (mood.mood_components.length > 0) {
        mood.emotion_stats = calculateEmotionStats(mood.mood_components);
      }
    });
  }

  // Get total count for pagination
  let countQuery = "SELECT COUNT(*) as total FROM mood WHERE user_id = ?";
  const countParams = [userId];

  if (start_date && end_date) {
    countQuery += " AND recorded_at BETWEEN ? AND ?";
    countParams.push(start_date, end_date);
  } else if (start_date) {
    countQuery += " AND recorded_at >= ?";
    countParams.push(start_date);
  } else if (end_date) {
    countQuery += " AND recorded_at <= ?";
    countParams.push(end_date);
  }

  const { total } = db.prepare(countQuery).get(...countParams);

  res.json({
    moods,
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      total_pages: Math.ceil(total / validLimit)
    }
  });
});

// Get mood statistics for a user
router.get("/user/:user_id/stats", (req, res) => {
  const userId = req.params.user_id;
  const { start_date, end_date } = req.query;
  const db = req.db;

  let baseQuery = "FROM mood WHERE user_id = ?";
  const params = [userId];

  if (start_date && end_date) {
    if (!isValidDateRange(start_date, end_date)) {
      return res.status(400).json({ error: "Intervalo de datas inválido" });
    }
    baseQuery += " AND recorded_at BETWEEN ? AND ?";
    params.push(start_date, end_date);
  }

  // Get aggregated stats
  const statsQuery = `
    SELECT
      COUNT(*) as total_entries,
      AVG(rating) as avg_rating,
      AVG(stress_level) as avg_stress,
      AVG(anxiety_level) as avg_anxiety,
      AVG(energy_level) as avg_energy,
      MIN(stress_level) as min_stress,
      MAX(stress_level) as max_stress,
      MIN(anxiety_level) as min_anxiety,
      MAX(anxiety_level) as max_anxiety,
      MIN(energy_level) as min_energy,
      MAX(energy_level) as max_energy
    ${baseQuery}
  `;

  const stats = db.prepare(statsQuery).get(...params);

  // Get emotion frequency
  const emotionQuery = `
    SELECT
      mc.emotion,
      COUNT(*) as frequency,
      AVG(mc.intensity) as avg_intensity
    FROM mood_components mc
    JOIN mood m ON mc.mood_id = m.id
    WHERE m.user_id = ?
    ${start_date && end_date ? 'AND m.recorded_at BETWEEN ? AND ?' : ''}
    GROUP BY mc.emotion
    ORDER BY frequency DESC
  `;

  const emotionParams = [...params];
  const emotions = db.prepare(emotionQuery).all(...emotionParams);

  // Get mood trends by day of week
  const dayTrendsQuery = `
    SELECT
      CASE CAST(strftime('%w', recorded_at) AS INTEGER)
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
      END as day_of_week,
      AVG(stress_level) as avg_stress,
      AVG(anxiety_level) as avg_anxiety,
      AVG(energy_level) as avg_energy,
      COUNT(*) as entries
    ${baseQuery}
    GROUP BY strftime('%w', recorded_at)
  `;

  const dayTrends = db.prepare(dayTrendsQuery).all(...params);

  res.json({
    overall: stats,
    emotions: emotions,
    trends: {
      by_day_of_week: dayTrends
    },
    date_range: {
      start: start_date || 'all time',
      end: end_date || 'all time'
    }
  });
});

export default router;
