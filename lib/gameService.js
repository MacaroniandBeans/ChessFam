// lib/gameService.js
import { Chess } from 'chess.js';
import { getDbClient, initializeSchema } from './turso.js';

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

export async function createGame(creatorUsername, preferredColor) {
  await ensureSchema();
  const db = getDbClient();

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

  // Delete any existing ongoing games (only one at a time)
  await db.execute(`DELETE FROM active_games WHERE status = 'ongoing'`);

  // Insert new game
  await db.execute({
    sql: `INSERT INTO active_games (id, white_player, black_player, fen, pgn, turn, status, winner, created_at, updated_at, moves)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      game.id,
      game.whitePlayer,
      game.blackPlayer,
      game.fen,
      game.pgn,
      game.turn,
      game.status,
      game.winner,
      game.createdAt,
      game.updatedAt,
      JSON.stringify(game.moves),
    ],
  });

  return game;
}

export async function getGameById(id) {
  await ensureSchema();
  const db = getDbClient();

  const result = await db.execute({
    sql: `SELECT * FROM active_games WHERE id = ?`,
    args: [id],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    whitePlayer: row.white_player,
    blackPlayer: row.black_player,
    fen: row.fen,
    pgn: row.pgn,
    turn: row.turn,
    status: row.status,
    winner: row.winner,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    moves: JSON.parse(row.moves),
  };
}

export async function getActiveGameForPlayer(username) {
  await ensureSchema();
  const db = getDbClient();

  const result = await db.execute({
    sql: `SELECT * FROM active_games WHERE status = 'ongoing' AND (white_player = ? OR black_player = ?)`,
    args: [username, username],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    whitePlayer: row.white_player,
    blackPlayer: row.black_player,
    fen: row.fen,
    pgn: row.pgn,
    turn: row.turn,
    status: row.status,
    winner: row.winner,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    moves: JSON.parse(row.moves),
  };
}

export async function makeMove(id, from, to) {
  await ensureSchema();
  const db = getDbClient();

  // Get game from database
  const game = await getGameById(id);
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

  // Update game in database
  await db.execute({
    sql: `UPDATE active_games
          SET fen = ?, pgn = ?, turn = ?, status = ?, winner = ?, updated_at = ?, moves = ?
          WHERE id = ?`,
    args: [
      game.fen,
      game.pgn,
      game.turn,
      game.status,
      game.winner,
      game.updatedAt,
      JSON.stringify(game.moves),
      id,
    ],
  });

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
