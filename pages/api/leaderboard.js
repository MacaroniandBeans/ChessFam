import { getSessionUser } from '../../lib/auth';
import { getLeaderboard } from '../../lib/gameService';

export default function handler(req, res) {
  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  const data = getLeaderboard();
  return res.status(200).json(data);
}
