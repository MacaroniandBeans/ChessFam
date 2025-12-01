// lib/gameService.js
import { Chess } from 'chess.js';
import { getDb, ensureSchema } from './db';

function generateGameId() {
  return Math.random().toString(36).slice(2, 8);
}

function mapGameRow(row) {
  return {
    id: row.id,
    whitePlayer: row.whitePlayer,
    blackPlayer: row.blackPlayer,
    fen: row.fen,
    pgn: row.pgn,
    turn: row.turn,
    status: row.status,
    winner: row.winner,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    moves: [], // will be filled separately when needed
  };
}

// Create a new game, only one live game at a time
export async function createGame(creatorUsername, preferredColor) {
  await ensureSchema();
  const db = getDb();

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

  // Only one live game at a time: nuke existing games + moves
  await db.execute('DELETE FROM moves;');
  await db.execute('DELETE FROM games;');

  await db.execute({
    sql: `
      INSERT INTO games
        (id, whitePlayer, blackPlayer, fen, pgn, turn, status, winner, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      id,
      whitePlayer,
      blackPlayer,
      chess.fen(),
      '',
      'white',
      'ongoing',
      null,
      now,
      now,
    ],
  });

  return {
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
}

export async function getGameById(id) {
  await ensureSchema();
  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT * FROM games WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const game = mapGameRow(row);

  const movesRes = await db.execute({
    sql: `
      SELECT san, fromSq, toSq, createdAt
      FROM moves
      WHERE gameId = ?
      ORDER BY id ASC
    `,
    args: [id],
  });

  game.moves = movesRes.rows.map((m) => ({
    san: m.san,
    from: m.fromSq,
    to: m.toSq,
    createdAt: m.createdAt,
  }));

  return game;
}

export async function getActiveGameForPlayer(username) {
  await ensureSchema();
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT *
      FROM games
      WHERE status = 'ongoing'
        AND (whitePlayer = ? OR blackPlayer = ?)
      LIMIT 1
    `,
    args: [username, username],
  });

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  const game = mapGameRow(row);
  // We don't need full moves list for the home page
  return game;
}

export async function makeMove(id, from, to) {
  await ensureSchema();
  const db = getDb();

  const gameRes = await db.execute({
    sql: 'SELECT * FROM games WHERE id = ?',
    args: [id],
  });
  if (gameRes.rows.length === 0) return null;

  const row = gameRes.rows[0];

  const chess = new Chess(row.fen);
  const move = chess.move({
    from,
    to,
    promotion: 'q',
  });

  if (!move) {
    // illegal move
    return null;
  }

  const now = new Date().toISOString();
  let status = row.status;
  let winner = row.winner;
  let turn = chess.turn() === 'w' ? 'white' : 'black';

  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      // Side who *just moved* is the opposite of chess.turn()
      const winnerColor = chess.turn() === 'w' ? 'black' : 'white';
      status = winnerColor === 'white' ? 'white_won' : 'black_won';
      winner =
        winnerColor === 'white' ? row.whitePlayer : row.blackPlayer;
    } else {
      status = 'draw';
      winner = null;
    }
  }

  await db.execute({
    sql: `
      UPDATE games
      SET fen = ?, pgn = ?, turn = ?, status = ?, winner = ?, updatedAt = ?
      WHERE id = ?
    `,
    args: [
      chess.fen(),
      chess.pgn(),
      turn,
      status,
      winner,
      now,
      id,
    ],
  });

  await db.execute({
    sql: `
      INSERT INTO moves (gameId, san, fromSq, toSq, createdAt)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [id, move.san, from, to, now],
  });

  // Return fresh game with moves
  return await getGameById(id);
}
