// pages/api/auth/login.js
import { validateCredentials, createSessionCookie } from '../../../lib/auth';

export default function handler(req, res) {
  if (req.method === 'DELETE') {
    // logout
    res.setHeader(
      'Set-Cookie',
      'chess_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
    );
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing credentials' });
  }

  const user = validateCredentials(username.trim(), password.trim());

  if (!user) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }

  const cookie = createSessionCookie(user);
  res.setHeader('Set-Cookie', cookie);

  return res.status(200).json({ ok: true, user });
}
