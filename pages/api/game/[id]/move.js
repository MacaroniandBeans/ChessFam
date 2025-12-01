// pages/api/game/[id]/move.js
import { getSessionUser } from '../../../../lib/auth';
import { makeMove, getGameById } from '../../../../lib/gameService';

export default async function handler(req, res) {
  const user = getSessionUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    query: { id },
    method,
  } = req;

  if (method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { from, to } = req.body || {};
  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from/to' });
  }

  const game = await getGameById(id);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Make sure this user is part of the game
  if (
    game.whitePlayer !== user.username &&
    game.blackPlayer !== user.username
  ) {
    return res.status(403).json({ error: 'Not your game' });
  }

  const updated = await makeMove(id, from, to);
  if (!updated) {
    return res.status(400).json({ error: 'Illegal move or game finished' });
  }

  return res.status(200).json({ game: updated });
}
