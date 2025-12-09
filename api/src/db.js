const Database = require('better-sqlite3');
const db = new Database('orbit.db');

module.exports = db;
