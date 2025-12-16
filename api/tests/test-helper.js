import { setupTestDatabase } from '../src/setup-db.js';

// Store a single test database instance
let globalTestDb = null;

// Setup the test database
export function setupTestDb() {
  if (!globalTestDb) {
    globalTestDb = setupTestDatabase();
  }
  return globalTestDb;
}

// Get the test database
export function getTestDb() {
  return globalTestDb;
}

// Cleanup test database
export function cleanupTestDb() {
  if (globalTestDb) {
    try {
      // Delete in correct order due to foreign keys
      globalTestDb.exec(`
        DELETE FROM mood_components;
        DELETE FROM mood;
        DELETE FROM users;
      `);
    } catch (err) {
      console.error('Error cleaning test DB:', err);
    }
  }
}
