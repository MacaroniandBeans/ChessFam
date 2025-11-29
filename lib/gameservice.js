
const { Chess } = require('chess.js');
const getDb = require('./db');

function generateGameId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function getOtherPlayer(username) {
  return username === 'grandpa' ? 'grandson' : 'grandpa';
}

function createGame({ creatorUsername, startingPlayerSide }) {
  const db = getDb();
  const chess = new Chess();
  const now = new Date().toISOString();
  const id = generateGameId();
  const whitePlayer =
    startingPlayerSide === 'white' ? creatorUsername : getOtherPlayer(creatorUsername);
  const blackPlayer =
    startingPlayerSide === 'black' ? creatorUsername : getOtherPlayer(creatorUsername);

  const stmt = db.prepare(`
    INSERT INTO games (id, whitePlayer, blackPlayer, fen, pgn, turn, status, winner, createdAt, updatedAt)
    VALUES (@id, @whitePlayer, @blackPlayer, @fen, @pgn, @turn, @status, NULL, @createdAt, @updatedAt)
  `);

  const game = {
    id,
    whitePlayer,
    blackPlayer,
    fen: chess.fen(),
    pgn: '',
    turn: 'w',
    status: 'active',
    createdAt: now,
    updatedAt: now
  };

  stmt.run(game);

  return game;
}

function getGameById(id) {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM games WHERE id = ?`);
  return stmt.get(id);
}

function getActiveGameForPlayer(username) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM games
    WHERE status = 'active'
      AND (whitePlayer = @username OR blackPlayer = @username)
    ORDER BY updatedAt DESC
    LIMIT 1
  `);
  return stmt.get({ username });
}

function makeMove({ gameId, username, from, to, promotion }) {
  const db = getDb();
  const game = getGameById(gameId);
  if (!game) {
    const err = new Error('Game not found');
    err.statusCode = 404;
    throw err;
  }

  const isWhiteTurn = game.turn === 'w';
  const allowedUsername = isWhiteTurn ? game.whitePlayer : game.blackPlayer;

  if (username !== allowedUsername) {
    const err = new Error('Not your turn');
    err.statusCode = 403;
    throw err;
  }

  const chess = new Chess(game.fen);
  const move = chess.move({ from, to, promotion: promotion || undefined });

  if (!move) {
    const err = new Error('Illegal move');
    err.statusCode = 400;
    throw err;
  }

  const now = new Date().toISOString();
  const newFen = chess.fen();
  const newPgn = chess.pgn();
  const newTurn = chess.turn();
  let status = 'active';
  let winner = null;

  if (chess.isCheckmate()) {
    status = 'checkmate';
    winner = username;
  } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
    status = 'draw';
  }

  const updateGameStmt = db.prepare(`
    UPDATE games
    SET fen = @fen,
        pgn = @pgn,
        turn = @turn,
        status = @status,
        winner = @winner,
        updatedAt = @updatedAt
    WHERE id = @id
  `);

  updateGameStmt.run({
    id: gameId,
    fen: newFen,
    pgn: newPgn,
    turn: newTurn,
    status,
    winner,
    updatedAt: now
  });

  const movesCountStmt = db.prepare(`SELECT COUNT(*) as count FROM moves WHERE gameId = ?`);
  const { count } = movesCountStmt.get(gameId);
  const moveNumber = count + 1;

  const insertMoveStmt = db.prepare(`
    INSERT INTO moves (gameId, moveNumber, san, fromSquare, toSquare, createdAt)
    VALUES (@gameId, @moveNumber, @san, @fromSquare, @toSquare, @createdAt)
  `);

  insertMoveStmt.run({
    gameId,
    moveNumber,
    san: move.san,
    fromSquare: from,
    toSquare: to,
    createdAt: now
  });

  if (status === 'checkmate' || status === 'draw') {
    const statsStmt = db.prepare(`
      UPDATE player_stats
      SET wins = wins + @winsDelta,
          losses = losses + @lossesDelta,
          draws = draws + @drawsDelta
      WHERE player = @player
    `);

    if (status === 'checkmate') {
      const loser = username === game.whitePlayer ? game.blackPlayer : game.whitePlayer;
      statsStmt.run({ player: username, winsDelta: 1, lossesDelta: 0, drawsDelta: 0 });
      statsStmt.run({ player: loser, winsDelta: 0, lossesDelta: 1, drawsDelta: 0 });
    } else if (status === 'draw') {
      statsStmt.run({ player: game.whitePlayer, winsDelta: 0, lossesDelta: 0, drawsDelta: 1 });
      statsStmt.run({ player: game.blackPlayer, winsDelta: 0, lossesDelta: 0, drawsDelta: 1 });
    }
  }

  const updatedGame = getGameById(gameId);
  return updatedGame;
}

function getLeaderboard() {
  const db = getDb();
  const players = db
    .prepare(`SELECT player as username, wins, losses, draws FROM player_stats`)
    .all();

  const recentGames = db
    .prepare(`
      SELECT id, whitePlayer, blackPlayer, winner, status, updatedAt as finishedAt
      FROM games
      WHERE status IN ('checkmate', 'draw', 'resigned')
      ORDER BY updatedAt DESC
      LIMIT 5
    `)
    .all();

  return { players, recentGames };
}

module.exports = {
  createGame,
  getGameById,
  getActiveGameForPlayer,
  makeMove,
  getLeaderboard
};
