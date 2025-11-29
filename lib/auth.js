const crypto = require('crypto');
const cookie = require('cookie');

const SESSION_COOKIE_NAME = 'chessfam_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

const USERS = {
  grandpa: {
    username: 'grandpa',
    password: 'grandpa123',
    displayName: 'Grandpa'
  },
  grandson: {
    username: 'grandson',
    password: 'grandson123',
    displayName: 'Grandson'
  }
};

function signPayload(payload) {
  const json = JSON.stringify(payload);
  const base = Buffer.from(json, 'utf8').toString('base64url');
  const hmac = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base)
    .digest('base64url');
  return `${base}.${hmac}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [base, sig] = parts;

  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base)
    .digest('base64url');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const json = Buffer.from(base, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function setSessionCookie(res, payload) {
  const token = signPayload(payload);
  const serialized = cookie.serialize(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  res.setHeader('Set-Cookie', serialized);
}

function clearSessionCookie(res) {
  const serialized = cookie.serialize(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  res.setHeader('Set-Cookie', serialized);
}

function getSessionUser(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE_NAME];
  const payload = verifyToken(token);
  if (!payload || !payload.username) return null;

  const user = USERS[payload.username];
  if (!user) return null;

  return {
    username: user.username,
    displayName: user.displayName
  };
}

function validateLogin(username, password) {
  const user = USERS[username];
  if (!user) return null;
  if (user.password !== password) return null;
  return {
    username: user.username,
    displayName: user.displayName
  };
}

module.exports = {
  SESSION_COOKIE_NAME,
  USERS,
  getSessionUser,
  setSessionCookie,
  clearSessionCookie,
  validateLogin
};

