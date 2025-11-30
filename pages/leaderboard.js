// pages/leaderboard.js
import { getSessionUser } from '../lib/auth';
import {
  getPlayerStats,
  getRecentGames,
} from '../lib/gameService';

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

  const stats = getPlayerStats();
  const recentGames = getRecentGames(5);

  return {
    props: {
      user,
      stats,
      recentGames,
    },
  };
}

export default function LeaderboardPage({ user, stats, recentGames }) {
  const players = ['grandpa', 'jackson'];

  const niceName = (username) => {
    if (username === 'grandpa') return 'Grandpa';
    if (username === 'jackson') return 'Jackson';
    return username;
  };

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
          <div style={{ fontSize: 12, opacity: 0.7 }}>Leaderboard</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>
            ChessFam Arena
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            Signed in as {user.displayName} ({user.username})
          </div>
        </div>
        <button
          onClick={() => (window.location.href = '/')}
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
          Home
        </button>
      </header>

      {/* Total stats */}
      <section
        style={{
          background: 'rgba(15,23,42,0.9)',
          borderRadius: 18,
          padding: 16,
          border: '1px solid rgba(148,163,184,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>Total record</div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {players.map((p) => {
            const s = stats[p] || {
              wins: 0,
              losses: 0,
              draws: 0,
            };
            const total = s.wins + s.losses + s.draws || 0;

            return (
              <div
                key={p}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: 12,
                  background: 'rgba(15,23,42,0.9)',
                  border: '1px solid rgba(55,65,81,0.8)',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {niceName(p)}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: '#9ca3af',
                      marginTop: 2,
                    }}
                  >
                    {total} game{total === 1 ? '' : 's'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: 12 }}>
                  <div>
                    W:{' '}
                    <span style={{ color: '#22c55e', fontWeight: 600 }}>
                      {s.wins}
                    </span>
                  </div>
                  <div>
                    L:{' '}
                    <span style={{ color: '#f97373', fontWeight: 600 }}>
                      {s.losses}
                    </span>
                  </div>
                  <div>
                    D:{' '}
                    <span style={{ color: '#e5e7eb', fontWeight: 600 }}>
                      {s.draws}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Last 5 games */}
      <section
        style={{
          background: 'rgba(15,23,42,0.9)',
          borderRadius: 18,
          padding: 16,
          border: '1px solid rgba(148,163,184,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          Last 5 games
        </div>

        {recentGames.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
            No completed games yet. Finish a game to see it here.
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              marginTop: 4,
            }}
          >
            {recentGames.map((g) => {
              const resultLabel =
                g.status === 'white_won'
                  ? `${niceName(g.whitePlayer)} won`
                  : g.status === 'black_won'
                  ? `${niceName(g.blackPlayer)} won`
                  : 'Draw';

              const resultColor =
                g.status === 'draw'
                  ? '#e5e7eb'
                  : '#22c55e';

              return (
                <div
                  key={g.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 12,
                    background: 'rgba(15,23,42,0.9)',
                    border: '1px solid rgba(55,65,81,0.8)',
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 2,
                    }}
                  >
                    <div>
                      {niceName(g.whitePlayer)} (White) vs{' '}
                      {niceName(g.blackPlayer)} (Black)
                    </div>
                    <div style={{ opacity: 0.6 }}>
                      #{g.id}
                    </div>
                  </div>
                  <div style={{ color: resultColor }}>
                    {resultLabel}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
