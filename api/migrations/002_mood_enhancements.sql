-- Drop and recreate mood table with enhanced fields
DROP TABLE IF EXISTS mood;

CREATE TABLE IF NOT EXISTS mood (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 10),
  stress_level INTEGER NOT NULL CHECK (stress_level BETWEEN 1 AND 10),
  anxiety_level INTEGER NOT NULL CHECK (anxiety_level BETWEEN 1 AND 10),
  energy_level INTEGER NOT NULL CHECK (energy_level BETWEEN 1 AND 10),
  title TEXT,
  description TEXT,
  recorded_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Mood components table for emotional breakdown
CREATE TABLE IF NOT EXISTS mood_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mood_id INTEGER NOT NULL,
  emotion TEXT NOT NULL CHECK (emotion IN ('joy', 'trust', 'fear', 'surprise', 'sad', 'disgust', 'angry', 'anxiety')),
  intensity INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 10),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mood_id) REFERENCES mood(id) ON DELETE CASCADE,
  UNIQUE(mood_id, emotion)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mood_user_id ON mood(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_recorded_at ON mood(recorded_at);
CREATE INDEX IF NOT EXISTS idx_mood_user_date ON mood(user_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_mood_components_mood_id ON mood_components(mood_id);

-- Recreate users table with new fields (SQLite doesn't support ALTER TABLE ADD COLUMN well)
CREATE TABLE IF NOT EXISTS users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy existing data
INSERT OR IGNORE INTO users_new (id, email, password, first_name, last_name, created_at)
SELECT id, email, password, first_name, last_name, created_at FROM users;

-- Drop old table and rename new one
DROP TABLE IF EXISTS users;
ALTER TABLE users_new RENAME TO users;