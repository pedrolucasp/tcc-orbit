import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupDatabase(dbPath = 'orbit.db') {
  const db = new Database(dbPath);

  // Read and execute migrations
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFile = path.join(migrationsDir, '001_initial_schema.sql');

  if (fs.existsSync(migrationFile)) {
    const migration = fs.readFileSync(migrationFile, 'utf8');
    db.exec(migration);
  }

  return db;
}

export function setupTestDatabase() {
  // Use in-memory database for tests
  const db = new Database(':memory:');

  // Read and execute migrations
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFile = path.join(migrationsDir, '001_initial_schema.sql');

  if (fs.existsSync(migrationFile)) {
    const migration = fs.readFileSync(migrationFile, 'utf8');
    db.exec(migration);
  }

  return db;
}