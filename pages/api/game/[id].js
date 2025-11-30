// pages/game/[id].js
import { useState } from 'react';
import { useRouter } from 'next/router';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { getSessionUser } from '../../lib/auth';
import { getGameById } from '../../lib/gameService';

export async function getServerSideProps(context) {
  const { req, params } = context;
  const user = getSessionUser(req);

  if (!user) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  const gameId = params.id;
  const game = getGameById(gameId);

  if (!game) {
    return {
      notFound: true,
    };
  }

  const isWhite = game.whitePlayer === user.username;
  const isBlack = game.blackPlayer === user.username;

  if (!isWhite && !isBlack) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    props: {
      user,
      serverGame: game,
      myColor: isWhite ? 'white' : 'black',
    },
  };
}

export default function GamePage({ user, serverGame, myColor }) {
  const router = useRouter();
  const [game, setGame] = useState(serverGame);

  const isFinished = game.status !== 'ongoing';
  const isMyTurn = !isFinished && game.turn === myColor;

  const handleDrop = async (sourceSquare, targetSquare) => {
    if (!isMyTurn || isFinished) return false;

    // Build a fresh Chess instance from the latest FEN
    let chess;
    try {
      chess = new Chess(game.fen);
    } catch (e) {
      console.error('Invalid FEN, resetting to start', game.fen, e);
      chess = new Chess();
    }

    const move = chess.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    if (!move) {
      // Illegal move, snap back
      return false;
    }

    // Optimistic local update so the piece moves immediately
    const optimisticFen = chess.fen();
    const optimisticTurn = chess.turn() === 'w' ? 'white' : 'black';

    setGame((prev) => ({
      ...prev,
      fen: optimisticFen,
      turn: optimisticTurn,
    }));

    try {
      const res = await fetch(`/api/game/${game.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: sourceSquare,
          to: targetSquare,
        }),
      });

      if (!res.ok) {
        console.error('Move API failed', res.status);
        // Reload from server to resync state if something went wrong
        router.replace(router.asPath);
        return true;
      }

      const data = await res.json();
      if (data.game) {
        setGame(data.game);
      }
    } catch (e) {
      console.error('Network error while sending move', e);
    }

    return true; // tell react-chessboard to keep the move
  };

  const statusText = (() => {
    if (game.status === 'white_won') return 'White wins';
    if (game.status === 'black_won') return 'Black wins';
    if (game.status === 'draw') return 'Draw';
    return isMyTurn ? 'Your move' : 'Waiting on opponent…';
  })();

  const opponentName =
    myColor === 'white' ? game.blackPlayer : game.whitePlayer;

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top, #111827 0, #020617 55%, #000 100%)',
        color: '#f9fafb',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <header
        style={{
          width: '100%',
          maxWidth: 420,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>Game</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {user.displayName} ·{' '}
            <span style={{ textTransform: 'capitalize' }}>{myColor}</span>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            vs {opponentName}
          </div>
        </div>
        <button
          onClick={() => router.push('/')}
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
          Back
        </button>
      </header>

      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(15,23,42,0.85)',
          borderRadius: 18,
          padding: 12,
          border: '1px solid rgba(148,163,184,0.4)',
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 12, marginBottom: 4 }}>
          Turn:{' '}
          <strong style={{ textTransform: 'capitalize' }}>
            {game.turn}
          </strong>
        </div>
        <div
          style={{
            fontSize: 12,
            color: isFinished ? '#facc15' : '#9ca3af',
          }}
        >
          {statusText}
        </div>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: 420,
        }}
      >
        <Chessboard
          position={game.fen}
          onPieceDrop={handleDrop}
          boardOrientation={myColor}
          customDarkSquareStyle={{ backgroundColor: '#1a2736' }}
          customLightSquareStyle={{ backgroundColor: '#f5f5f5' }}
          animationDuration={200}
        />
      </div>
    </div>
  );
}
