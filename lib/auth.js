// lib/auth.js
import crypto from 'crypto';

// Hard-coded users
const USERS = {
  grandpa: {
    password: 'grandpa123',
    displayName: 'Grandpa',
  },
  jackson: {
    password: 'Jackson123',
    displayName: 'Jackson',
  },
};

const COOKIE_NAME = 'chess_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-dev-dev-secret';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

export function validateCredentials(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return null;
  }

  const key = username.trim().toLowerCase();
  const user = USERS[key];

  if (!user) return null;
  if (user.password !== password.trim()) return null;

  return {
    username: key,
    displayName: user.displayName,
  };
}

export function createSessionCookie(user) {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64url');
  const signature = sign(payload);
  const value = `${payload}.${signature}`;

  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function clearSessionCookie() {
  return [
    `${COOKIE_NAME}=;`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ].join(' ');
}

export function parseSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const raw = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return null;

  const value = raw.substring(COOKIE_NAME.length + 1);
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;

  const expectedSignature = sign(payload);

  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8');
    const data = JSON.parse(json);

    if (data.username !== 'grandpa' && data.username !== 'jackson') {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function getSessionUser(req) {
  const header = req && req.headers ? req.headers.cookie : undefined;
  return parseSessionCookie(header);
}
