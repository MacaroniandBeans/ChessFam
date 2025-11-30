// pages/api/game/index.js
import { getSessionUser } from '../../../lib/auth';
import { createGame, getActiveGameForPlayer } from '../../../lib/gameService';

export default async function handler(req, res) {
  try {
    const user = getSessionUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'POST') {
      const { preferredColor } = req.body || {};

      // only allow 1 active game per player
      const existing = await getActiveGameForPlayer(user.username);
      if (existing) {
        return res
          .status(400)
          .json({ error: 'Game already in progress', gameId: existing.id });
      }

      const color =
        preferredColor === 'black' || preferredColor === 'white'
          ? preferredColor
          : 'white';

      const game = await createGame(user.username, color);
      return res.status(201).json({ game });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/game:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
