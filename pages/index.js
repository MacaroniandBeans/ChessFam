// pages/index.js
import Link from 'next/link';
import { getSessionUser } from '../lib/auth';
import { getActiveGameForPlayer } from '../lib/gameService';

export async function getServerSideProps(context) {
  const { req } = context;
  const user = getSessionUser(req);

  if (!user) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  const activeGame = (await getActiveGameForPlayer(user.username)) || null;

  return {
    props: {
      user,
      activeGame,
    },
  };
}


export default function HomePage({ user, activeGame }) {
  const hasActive = !!activeGame;

  const myColor = hasActive
    ? activeGame.whitePlayer === user.username
      ? 'white'
      : 'black'
    : null;

  const isMyTurn =
    hasActive &&
    activeGame.status === 'ongoing' &&
    activeGame.turn === myColor;

  async function startGame(color) {
    if (hasActive) {
      // safety: just go to the existing game
      window.location.href = `/game/${activeGame.id}`;
      return;
    }

    const res = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    });

    if (!res.ok) {
      alert('Error creating game');
      return;
    }

    const data = await res.json();
    window.location.href = `/game/${data.game.id}`;
  }

  async function logout() {
    await fetch('/api/auth/login', { method: 'DELETE' });
    window.location.href = '/login';
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, #151b3b 0, #05060a 55%, #020308 100%)',
        color: '#f9fafb',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 640,
        margin: '0 auto',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Signed in as</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            {user.displayName} ({user.username})
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            borderRadius: 999,
            border: '1px solid #4b5563',
            background: 'transparent',
            color: '#e5e7eb',
            padding: '6px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Logout
        </button>
      </header>

      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
        ChessFam Arena
      </h1>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
        Async battles between Grandpa and Jackson.
      </p>

      {/* Start game section – only visible when NO game exists */}
      {!hasActive && (
        <section
          style={{
            background: 'rgba(15,23,42,0.85)',
            borderRadius: 18,
            padding: 16,
            border: '1px solid rgba(148,163,184,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            Start a new game
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => startGame('white')}
              style={{
                flex: 1,
                borderRadius: 999,
                border: 'none',
                background:
                  'linear-gradient(135deg, #e5e7eb, #f9fafb)',
                color: '#111827',
                fontWeight: 700,
                fontSize: 13,
                padding: '10px 0',
                cursor: 'pointer',
              }}
            >
              Play as White
            </button>
            <button
              onClick={() => startGame('black')}
              style={{
                flex: 1,
                borderRadius: 999,
                border: 'none',
                background:
                  'linear-gradient(135deg, #0f172a, #020617)',
                color: '#f9fafb',
                fontWeight: 700,
                fontSize: 13,
                padding: '10px 0',
                cursor: 'pointer',
              }}
            >
              Play as Black
            </button>
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            Only one game can exist at a time. Once it&apos;s started, both
            of you will see the same match.
          </div>
        </section>
      )}

      {/* Active game section – always visible, but changes text */}
      <section
        style={{
          background: 'rgba(15,23,42,0.85)',
          borderRadius: 18,
          padding: 16,
          border: '1px solid rgba(148,163,184,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          Current game
        </div>
        {hasActive ? (
          <>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              Game ID: <code>{activeGame.id}</code>
              <br />
              You are{' '}
              <strong>
                {myColor === 'white' ? 'White' : 'Black'}
              </strong>
              <br />
              Status:{' '}
              {activeGame.status !== 'ongoing' ? (
                <strong>Finished</strong>
              ) : isMyTurn ? (
                <strong>Your turn</strong>
              ) : (
                <strong>Their turn</strong>
              )}
            </div>
            <button
              onClick={() =>
                (window.location.href = `/game/${activeGame.id}`)
              }
              style={{
                marginTop: 6,
                borderRadius: 999,
                border: 'none',
                background: isMyTurn
                  ? 'linear-gradient(135deg, #22c55e, #38bdf8)'
                  : 'linear-gradient(135deg, #6b7280, #4b5563)',
                color: '#020617',
                fontWeight: 700,
                fontSize: 13,
                padding: '9px 0',
                cursor: 'pointer',
              }}
            >
              {isMyTurn ? 'Open game (your move)' : 'Open game'}
            </button>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            No game in progress. Start one above.
          </div>
        )}
      </section>
    </div>
  );
}
