// lib/db.js
import { createClient } from '@libsql/client';

let client = null;

export function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error(
        'Turso env vars missing: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN'
      );
    }

    client = createClient({ url, authToken });
  }
  return client;
}

let schemaInitialized = false;

export async function ensureSchema() {
  if (schemaInitialized) return;
  const db = getDb();

  // games table: one row per game
  await db.execute(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      whitePlayer TEXT NOT NULL,
      blackPlayer TEXT NOT NULL,
      fen TEXT NOT NULL,
      pgn TEXT NOT NULL,
      turn TEXT NOT NULL, -- 'white' | 'black'
      status TEXT NOT NULL, -- 'ongoing' | 'white_won' | 'black_won' | 'draw'
      winner TEXT, -- username or NULL
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // moves table: history per game
  await db.execute(`
    CREATE TABLE IF NOT EXISTS moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameId TEXT NOT NULL,
      san TEXT NOT NULL,
      fromSq TEXT NOT NULL,
      toSq TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  schemaInitialized = true;
}
