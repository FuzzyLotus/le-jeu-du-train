import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/game.db');
const dataDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    total_earned INTEGER DEFAULT 0,
    trip_count INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    has_lost BOOLEAN DEFAULT 0,
    longest_trip_km REAL DEFAULT 0,
    total_distance_km REAL DEFAULT 0,
    max_crossings_in_trip INTEGER DEFAULT 0,
    highest_score INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    is_admin BOOLEAN DEFAULT 0,
    recovery_phrase TEXT,
    email TEXT,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    distance_km REAL NOT NULL,
    crossings INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    has_bridge BOOLEAN DEFAULT 0,
    has_tunnel BOOLEAN DEFAULT 0,
    max_elevation REAL DEFAULT 0,
    min_elevation REAL DEFAULT 0,
    max_bridge_length REAL DEFAULT 0,
    start_country TEXT,
    end_country TEXT,
    start_island TEXT,
    end_island TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS password_reset_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    contact_method TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    UNIQUE(sender_id, receiver_id)
  );
  
  CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    replies TEXT, -- JSON string
    github_issue_number INTEGER,
    github_issue_url TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, achievement_id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Add recovery_phrase column to existing tables if it doesn't exist
try {
  db.exec('ALTER TABLE game_sessions ADD COLUMN max_elevation REAL DEFAULT 0');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE game_sessions ADD COLUMN min_elevation REAL DEFAULT 0');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE game_sessions ADD COLUMN max_bridge_length REAL DEFAULT 0');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE game_sessions ADD COLUMN start_country TEXT');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE game_sessions ADD COLUMN end_country TEXT');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE game_sessions ADD COLUMN start_island TEXT');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE game_sessions ADD COLUMN end_island TEXT');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE users ADD COLUMN recovery_phrase TEXT');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE users ADD COLUMN email TEXT');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE users ADD COLUMN preferences TEXT');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE users ADD COLUMN home_location TEXT');
} catch (e) {
  // Column already exists
}
try {
  db.exec('ALTER TABLE users ADD COLUMN highest_score INTEGER DEFAULT 0');
} catch (e) {
  // Column already exists
}
try {
  // Initialize highest_score to at least current points for existing users
  db.exec('UPDATE users SET highest_score = points WHERE highest_score < points');
} catch (e) {
  // Ignore
}

export { db };
