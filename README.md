
# ChessFam

Two-player async chess for Grandpa and Grandson.

Accounts:

- `grandpa` / `grandpa123`
- `grandson` / `grandson123`

Turn-based, board locks after each move, persisted in SQLite, with Bloom analysis and a simple leaderboard.

## Stack

- Next.js (Pages Router)
- React + `react-chessboard`
- `chess.js` for rules / PGN / FEN
- SQLite via `better-sqlite3` at `data/chess.db`

## Running locally

```bash
npm install
npm run dev
