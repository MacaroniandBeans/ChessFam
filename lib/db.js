
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let db;

function getDb() {
  if (db) return db;

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'chess.db'); // game file = chess
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      whitePlayer TEXT NOT NULL,
      blackPlayer TEXT NOT NULL,
      fen TEXT NOT NULL,
      pgn TEXT NOT NULL,
      turn TEXT NOT NULL,
      status TEXT NOT NULL,
      winner TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameId TEXT NOT NULL,
      moveNumber INTEGER NOT NULL,
      san TEXT NOT NULL,
      fromSquare TEXT NOT NULL,
      toSquare TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (gameId) REFERENCES games(id)
    );

    CREATE TABLE IF NOT EXISTS player_stats (
      player TEXT PRIMARY KEY,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0
    );
  `);

  const ensurePlayer = db.prepare(`
    INSERT OR IGNORE INTO player_stats (player, wins, losses, draws)
    VALUES (@player, 0, 0, 0)
  `);
  ensurePlayer.run({ player: 'grandpa' });
  ensurePlayer.run({ player: 'grandson' });

  return db;
}

module.exports = getDb;
