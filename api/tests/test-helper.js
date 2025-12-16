import { setupTestDatabase } from '../src/setup-db.js';

// Store the test database globally
let testDb;

// Replace the default db connection with test database
export function setupTestDb() {
  testDb = setupTestDatabase();
  return testDb;
}

// Get the test database
export function getTestDb() {
  return testDb;
}

export function cleanupTestDb() {
  // Clear all tables
  if (testDb) {
    testDb.exec(`
      DELETE FROM mood;
      DELETE FROM users;
    `);
  }
}