// pages/api/game/[id]/move.js
import { getSessionUser } from '../../../../lib/auth';
import { getGameById, makeMove } from '../../../../lib/gameService';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ ok: false, error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { from, to } = req.body || {};

  if (!from || !to) {
    return res
      .status(400)
      .json({ ok: false, error: 'Missing from/to' });
  }

  const user = getSessionUser(req);
  if (!user) {
    return res
      .status(401)
      .json({ ok: false, error: 'Not authenticated' });
  }

  const game = getGameById(id);
  if (!game) {
    return res
      .status(404)
      .json({ ok: false, error: 'Game not found' });
  }

  const isWhite = game.whitePlayer === user.username;
  const isBlack = game.blackPlayer === user.username;
  const myColor = isWhite ? 'white' : isBlack ? 'black' : null;

  if (!myColor) {
    return res
      .status(403)
      .json({ ok: false, error: 'You are not part of this game' });
  }

  if (game.status !== 'ongoing') {
    return res
      .status(400)
      .json({ ok: false, error: 'Game is already finished' });
  }

  if ((game.turn || 'white') !== myColor) {
    return res
      .status(403)
      .json({ ok: false, error: 'Not your turn' });
  }

  try {
    const updated = makeMove(id, from, to);

    if (!updated) {
      return res
        .status(400)
        .json({ ok: false, error: 'Illegal move' });
    }

    return res.status(200).json({ ok: true, game: updated });
  } catch (err) {
    console.error('Move error', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Server error while making move' });
  }
}
