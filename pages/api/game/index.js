// pages/api/game/index.js
import { getSessionUser } from '../../../lib/auth';
import { createGame } from '../../../lib/gameService';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res
      .status(405)
      .json({ ok: false, error: 'Method not allowed' });
  }

  const user = getSessionUser(req);

  if (!user) {
    // If this happens, you're not actually logged in
    return res
      .status(401)
      .json({ ok: false, error: 'Not authenticated' });
  }

  const { color } = req.body || {};
  const preferredColor = color === 'black' ? 'black' : 'white';

  try {
    // createGame enforces: only ONE ongoing game total.
    const game = createGame(user.username, preferredColor);
    return res.status(201).json({ ok: true, game });
  } catch (err) {
    console.error('Error creating game:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Server error creating game' });
  }
}
