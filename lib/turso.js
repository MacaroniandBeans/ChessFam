// lib/turso.js
import { createClient } from '@libsql/client';

let client = null;

export function getDbClient() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('TURSO_DATABASE_URL environment variable is not set');
  }

  client = createClient({
    url,
    authToken,
  });

  return client;
}

// Initialize database schema
export async function initializeSchema() {
  const db = getDbClient();

  // Create player_stats table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS player_stats (
      username TEXT PRIMARY KEY,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      draws INTEGER DEFAULT 0
    )
  `);

  // Create game_history table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS game_history (
      id TEXT PRIMARY KEY,
      white_player TEXT NOT NULL,
      black_player TEXT NOT NULL,
      winner TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      finished_at TEXT NOT NULL
    )
  `);

  // Create active_games table for ongoing games
  await db.execute(`
    CREATE TABLE IF NOT EXISTS active_games (
      id TEXT PRIMARY KEY,
      white_player TEXT NOT NULL,
      black_player TEXT NOT NULL,
      fen TEXT NOT NULL,
      pgn TEXT NOT NULL,
      turn TEXT NOT NULL,
      status TEXT NOT NULL,
      winner TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      moves TEXT NOT NULL
    )
  `);

  // Ensure default players exist
  await db.execute(`
    INSERT OR IGNORE INTO player_stats (username, wins, losses, draws)
    VALUES ('grandpa', 0, 0, 0)
  `);

  await db.execute(`
    INSERT OR IGNORE INTO player_stats (username, wins, losses, draws)
    VALUES ('jackson', 0, 0, 0)
  `);

  console.log('Database schema initialized');
}
