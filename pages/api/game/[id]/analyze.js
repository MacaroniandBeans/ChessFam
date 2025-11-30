// pages/api/game/[id]/analyze.js
import { getSessionUser } from '../../../../lib/auth';
import { getGameById } from '../../../../lib/gameService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const user = getSessionUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    query: { id },
  } = req;

  const game = getGameById(id);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (game.whitePlayer !== user.username && game.blackPlayer !== user.username) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const bloomUrl = process.env.BLOOM_ANALYZE_URL;
  const bloomKey = process.env.BLOOM_ANALYZE_KEY;

  if (!bloomUrl || !bloomKey) {
    return res.status(500).json({
      error:
        'Bloom analysis is not configured. Set BLOOM_ANALYZE_URL and BLOOM_ANALYZE_KEY.',
    });
  }

  const payload = {
    game_id: game.id,
    pgn: game.pgn,
    moves: game.moves || [],
  };

  try {
    const bloomRes = await fetch(bloomUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': bloomKey,
      },
      body: JSON.stringify(payload),
    });

    if (!bloomRes.ok) {
      const text = await bloomRes.text().catch(() => '');
      return res
        .status(502)
        .json({ error: `Bloom responded with ${bloomRes.status}: ${text}` });
    }

    const data = await bloomRes.json();

    return res.status(200).json({
      summary: data.summary ?? 'Bloom returned no summary.',
      keyMoments: Array.isArray(data.keyMoments) ? data.keyMoments : [],
    });
  } catch (err) {
    console.error('Bloom analyze error', err);
    return res
      .status(500)
      .json({ error: 'Failed to reach Bloom analysis service.' });
  }
}
