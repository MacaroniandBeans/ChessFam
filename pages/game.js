// pages/game.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { getSessionUser } from '../lib/auth';
import { getActiveGameForPlayer, getGameById } from '../lib/gameService';

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

  // Single-game model: just get the active game for this player
  const active = await getActiveGameForPlayer(user.username);

  if (!active) {
    // No game yet → back home, they can start one
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  // Fetch full game with moves
  const game = await getGameById(active.id);
  if (!game) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const isWhite = game.whitePlayer === user.username;
  const myColor = isWhite ? 'white' : 'black';

  return {
    props: {
      user,
      serverGame: game,
      myColor,
    },
  };
}

export default function GamePage({ user, serverGame, myColor }) {
  const router = useRouter();

  const [fen, setFen] = useState(serverGame.fen);
  const [turn, setTurn] = useState(serverGame.turn || 'white');
  const [status, setStatus] = useState(serverGame.status);
  const [remoteGame, setRemoteGame] = useState(serverGame);

  const isFinished = status !== 'ongoing';
  const isMyTurn = !isFinished && turn === myColor;

  const opponentName =
    myColor === 'white' ? remoteGame.blackPlayer : remoteGame.whitePlayer;

  const statusText = (() => {
    if (status === 'white_won') return 'White wins';
    if (status === 'black_won') return 'Black wins';
    if (status === 'draw') return 'Draw';
    return isMyTurn ? 'Your move' : `Waiting on ${opponentName}…`;
  })();

  const handleDrop = async (sourceSquare, targetSquare) => {
    if (!isMyTurn || isFinished) return false;

    let chess;
    try {
      chess = new Chess(fen);
    } catch {
      chess = new Chess();
    }

    const move = chess.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    if (!move) return false;

    const newFen = chess.fen();
    const newTurn = chess.turn() === 'w' ? 'white' : 'black';

    setFen(newFen);
    setTurn(newTurn);

    try {
      const res = await fetch(`/api/game/${remoteGame.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: sourceSquare, to: targetSquare }),
      });

      if (!res.ok) {
        console.error('Move API failed', res.status);
        router.replace(router.asPath);
        return true;
      }

      const data = await res.json();
      if (data.game) {
        const g = data.game;
        setRemoteGame(g);
        setStatus(g.status);
        setTurn(g.turn || 'white');

        try {
          const serverChess = new Chess(g.fen);
          setFen(serverChess.fen());
        } catch (e) {
          console.error('Bad FEN from server, keeping local', e);
        }
      }
    } catch (err) {
      console.error('Network error sending move', err);
    }

    return true;
  };

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
          Home
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
            {turn}
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
          position={fen}
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
