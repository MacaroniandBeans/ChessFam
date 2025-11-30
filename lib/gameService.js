// lib/gameService.js
import fs from 'fs';
import path from 'path';
import { Chess } from 'chess.js';

const games = new Map(); // only one ongoing game at a time

// ---------- JSON persistence for stats + history ----------

const dataDir = path.join(process.cwd(), 'data');
const statsFile = path.join(dataDir, 'chess-stats.json');
const historyFile = path.join(dataDir, 'chess-history.json');

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

let statsCache = null;
let historyCache = null;

function loadStats() {
  if (statsCache) return statsCache;
  ensureDataDir();

  if (fs.existsSync(statsFile)) {
    try {
      const raw = fs.readFileSync(statsFile, 'utf8');
      statsCache = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to read stats file, resetting:', e);
      statsCache = null;
    }
  }

  if (!statsCache || typeof statsCache !== 'object') {
    // default base stats for the two players
    statsCache = {
      grandpa: { wins: 0, losses: 0, draws: 0 },
      jackson: { wins: 0, losses: 0, draws: 0 },
    };
  }

  saveStats();
  return statsCache;
}

function saveStats() {
  ensureDataDir();
  fs.writeFileSync(statsFile, JSON.stringify(statsCache, null, 2), 'utf8');
}

function loadHistory() {
  if (historyCache) return historyCache;
  ensureDataDir();

  if (fs.existsSync(historyFile)) {
    try {
      const raw = fs.readFileSync(historyFile, 'utf8');
      historyCache = JSON.parse(raw);
    } catch (e) {
      console.error('Failed to read history file, resetting:', e);
      historyCache = null;
    }
  }

  if (!historyCache || !Array.isArray(historyCache)) {
    historyCache = [];
  }

  saveHistory();
  return historyCache;
}

function saveHistory() {
  ensureDataDir();
  fs.writeFileSync(historyFile, JSON.stringify(historyCache, null, 2), 'utf8');
}

function ensurePlayerStats(username) {
  const stats = loadStats();
  if (!stats[username]) {
    stats[username] = { wins: 0, losses: 0, draws: 0 };
  }
  return stats[username];
}

function recordResult(game) {
  const stats = loadStats();
  const history = loadHistory();

  const white = game.whitePlayer;
  const black = game.blackPlayer;

  ensurePlayerStats(white);
  ensurePlayerStats(black);

  if (game.status === 'white_won') {
    stats[white].wins += 1;
    stats[black].losses += 1;
  } else if (game.status === 'black_won') {
    stats[black].wins += 1;
    stats[white].losses += 1;
  } else if (game.status === 'draw') {
    stats[white].draws += 1;
    stats[black].draws += 1;
  }

  history.push({
    id: game.id,
    whitePlayer: game.whitePlayer,
    blackPlayer: game.blackPlayer,
    winner: game.winner || null,
    status: game.status, // 'white_won' | 'black_won' | 'draw'
    createdAt: game.createdAt,
    finishedAt: new Date().toISOString(),
  });

  saveStats();
  saveHistory();
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

export function makeMove(id, from, to) {
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

    recordResult(game);
  }

  return { ...game };
}

// ---------- leaderboard helpers ----------

export function getPlayerStats() {
  return loadStats();
}

export function getRecentGames(limit = 5) {
  const history = loadHistory();
  return history.slice(-limit).reverse();
}
