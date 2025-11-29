import { getSessionUser } from '../lib/auth';
import { getActiveGameForPlayer } from '../lib/gameService';
import { useRouter } from 'next/router';
import { useState } from 'react';

export async function getServerSideProps(context) {
  const { req } = context;
  const user = getSessionUser(req);
  if (!user) {
    return {
      redirect: {
        destination: '/login',
        permanent: false
      }
    };
  }

  const activeGame = getActiveGameForPlayer(user.username) || null;

  return {
    props: {
      user,
      initialActiveGame: activeGame
    }
  };
}

export default function HomePage({ user, initialActiveGame }) {
  const router = useRouter();
  const [activeGame] = useState(initialActiveGame);

  async function startGame(startingPlayerSide) {
    const res = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startingPlayerSide })
    });

    if (!res.ok) return;

    const game = await res.json();
    router.push(`/game/${game.id}`);
  }

  async function continueGame() {
    if (!activeGame) return;
    router.push(`/game/${activeGame.id}`);
  }

  async function logout() {
    await fetch('/api/auth/login', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <h1 className="logo">ChessFam</h1>
          <p className="tagline">Grandpa vs Grandson showdown.</p>
        </div>
        <div className="user-info">
          <span className="pill">Logged in as {user.displayName}</span>
          <button className="button subtle" onClick={logout}>
            Log Out
          </button>
        </div>
      </header>

      <main className="main">
        <section className="card">
          <h2>Start a New Game</h2>
          <p className="muted">Pick your color and begin a fresh match.</p>
          <div className="button-row">
            <button className="button primary" onClick={() => startGame('white')}>
              Play as White
            </button>
            <button className="button primary" onClick={() => startGame('black')}>
              Play as Black
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Current Game</h2>
          {activeGame ? (
            <>
              <p className="muted">
                Game <code>{activeGame.id}</code> ·{' '}
                <strong>
                  {activeGame.whitePlayer} (White) vs {activeGame.blackPlayer} (Black)
                </strong>
              </p>
              <button className="button secondary" onClick={continueGame}>
                Continue Game
              </button>
            </>
          ) : (
            <p className="muted">No active game right now.</p>
          )}
        </section>

        <section className="card">
          <h2>Stats</h2>
          <p className="muted">
            Check out the running score between Grandpa and Grandson.
          </p>
          <button className="button secondary" onClick={() => router.push('/leaderboard')}>
            View Leaderboard
          </button>
        </section>
      </main>
    </div>
  );
}

