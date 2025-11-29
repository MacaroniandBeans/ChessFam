import { getSessionUser } from '../lib/auth';
import { useState } from 'react';
import { useRouter } from 'next/router';

export async function getServerSideProps(context) {
  const { req } = context;
  const user = getSessionUser(req);

  if (user) {
    return {
      redirect: {
        destination: '/',
        permanent: false
      }
    };
  }

  return { props: {} };
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('grandpa');
  const [password, setPassword] = useState('grandpa123');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        throw new Error('Invalid credentials');
      }

      await res.json();
      router.push('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  }

  function handlePresetChange(e) {
    const value = e.target.value;
    if (value === 'grandpa') {
      setUsername('grandpa');
      setPassword('grandpa123');
    } else if (value === 'grandson') {
      setUsername('grandson');
      setPassword('grandson123');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="login-card">
        <h1 className="title">ChessFam</h1>
        <p className="subtitle">Grandpa vs Grandson, forever.</p>
        <form onSubmit={handleSubmit} className="form">
          <label className="label">
            Who&apos;s playing?
            <select className="input" value={username} onChange={handlePresetChange}>
              <option value="grandpa">Grandpa</option>
              <option value="grandson">Grandson</option>
            </select>
          </label>

          <label className="label">
            Username
            <input
              className="input"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </label>

          <label className="label">
            Password
            <input
              type="password"
              className="input"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="button primary">
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}

