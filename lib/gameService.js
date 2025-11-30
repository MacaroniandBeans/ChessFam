// lib/gameService.js
import { Chess } from 'chess.js';
import { getDbClient, initializeSchema } from './turso.js';

const games = new Map(); // only one ongoing game at a time

// Initialize database schema on first import
let schemaInitialized = false;
async function ensureSchema() {
  if (!schemaInitialized) {
    try {
      await initializeSchema();
      schemaInitialized = true;
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
    }
  }
}

// ---------- Database persistence for stats + history ----------

async function ensurePlayerStats(username) {
  await ensureSchema();
  const db = getDbClient();

  await db.execute({
    sql: `INSERT OR IGNORE INTO player_stats (username, wins, losses, draws) VALUES (?, 0, 0, 0)`,
    args: [username],
  });
}

async function recordResult(game) {
  await ensureSchema();
  const db = getDbClient();

  const white = game.whitePlayer;
  const black = game.blackPlayer;

  await ensurePlayerStats(white);
  await ensurePlayerStats(black);

  // Update stats
  if (game.status === 'white_won') {
    await db.execute({
      sql: `UPDATE player_stats SET wins = wins + 1 WHERE username = ?`,
      args: [white],
    });
    await db.execute({
      sql: `UPDATE player_stats SET losses = losses + 1 WHERE username = ?`,
      args: [black],
    });
  } else if (game.status === 'black_won') {
    await db.execute({
      sql: `UPDATE player_stats SET wins = wins + 1 WHERE username = ?`,
      args: [black],
    });
    await db.execute({
      sql: `UPDATE player_stats SET losses = losses + 1 WHERE username = ?`,
      args: [white],
    });
  } else if (game.status === 'draw') {
    await db.execute({
      sql: `UPDATE player_stats SET draws = draws + 1 WHERE username = ?`,
      args: [white],
    });
    await db.execute({
      sql: `UPDATE player_stats SET draws = draws + 1 WHERE username = ?`,
      args: [black],
    });
  }

  // Record game in history
  await db.execute({
    sql: `INSERT INTO game_history (id, white_player, black_player, winner, status, created_at, finished_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      game.id,
      game.whitePlayer,
      game.blackPlayer,
      game.winner || null,
      game.status,
      game.createdAt,
      new Date().toISOString(),
    ],
  });
}

// ---------- core game helpers used by API/pages ----------

function generateGameId() {
  return Math.random().toString(36).slice(2, 8);
}

export function createGame(creatorUsername, preferredColor) {
  // hard-coded 2-player logic: grandpa vs jackson
  const opponent =
    creatorUsername === 'grandpa'
      ? 'jackson'
      : creatorUsername === 'jackson'
      ? 'grandpa'
      : 'grandpa'; // fallback, but you really only use the two

  const whitePlayer =
    preferredColor === 'black' ? opponent : creatorUsername;
  const blackPlayer =
    preferredColor === 'black' ? creatorUsername : opponent;

  const chess = new Chess();
  const now = new Date().toISOString();
  const id = generateGameId();

  const game = {
    id,
    whitePlayer,
    blackPlayer,
    fen: chess.fen(),
    pgn: '',
    turn: 'white',
    status: 'ongoing',
    winner: null,
    createdAt: now,
    updatedAt: now,
    moves: [],
  };

  // Only one live game at a time: clear any old one
  games.clear();
  games.set(id, game);

  return game;
}

export function getGameById(id) {
  return games.get(id) || null;
}

export function getActiveGameForPlayer(username) {
  for (const game of games.values()) {
    if (
      game.status === 'ongoing' &&
      (game.whitePlayer === username || game.blackPlayer === username)
    ) {
      return game;
    }
  }
  return null;
}

export async function makeMove(id, from, to) {
  const game = games.get(id);
  if (!game) return null;
  if (game.status !== 'ongoing') return null;

  const chess = new Chess(game.fen);

  const move = chess.move({
    from,
    to,
    promotion: 'q',
  });

  if (!move) {
    return null; // illegal move
  }

  game.fen = chess.fen();
  game.pgn = chess.pgn();
  game.turn = chess.turn() === 'w' ? 'white' : 'black';
  game.updatedAt = new Date().toISOString();
  game.moves.push({
    san: move.san,
    from,
    to,
    createdAt: game.updatedAt,
  });

  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      // Side who *just moved* is the opposite of chess.turn()
      const winnerColor = chess.turn() === 'w' ? 'black' : 'white';
      game.status =
        winnerColor === 'white' ? 'white_won' : 'black_won';
      game.winner =
        winnerColor === 'white'
          ? game.whitePlayer
          : game.blackPlayer;
    } else {
      game.status = 'draw';
      game.winner = null;
    }

    await recordResult(game);
  }

  return { ...game };
}

// ---------- leaderboard helpers ----------

export async function getPlayerStats() {
  await ensureSchema();
  const db = getDbClient();

  const result = await db.execute('SELECT username, wins, losses, draws FROM player_stats');

  const stats = {};
  for (const row of result.rows) {
    stats[row.username] = {
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
    };
  }

  return stats;
}

export async function getRecentGames(limit = 5) {
  await ensureSchema();
  const db = getDbClient();

  const result = await db.execute({
    sql: `SELECT id, white_player as whitePlayer, black_player as blackPlayer,
                 winner, status, created_at as createdAt, finished_at as finishedAt
          FROM game_history
          ORDER BY finished_at DESC
          LIMIT ?`,
    args: [limit],
  });

  return result.rows;
}

export async function getLeaderboard() {
  return {
    stats: await getPlayerStats(),
    recentGames: await getRecentGames(5),
  };
}
