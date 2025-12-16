import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupDatabase(dbPath = 'orbit.db') {
  const db = new Database(dbPath);

  // Read and execute migrations in order
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = [
    '001_initial_schema.sql',
    '002_mood_enhancements.sql'
  ];

  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf8');
      db.exec(migration);
    }
  }

  return db;
}

export function setupTestDatabase() {
  // Use in-memory database for tests
  const db = new Database(':memory:');

  // Read and execute migrations in order
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = [
    '001_initial_schema.sql',
    '002_mood_enhancements.sql'
  ];

  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf8');
      db.exec(migration);
    }
  }

  return db;
}