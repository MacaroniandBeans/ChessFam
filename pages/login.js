// pages/login.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Login.module.css';

const PRESETS = {
  grandpa: { username: 'grandpa', password: 'grandpa123', label: 'Grandpa' },
  jackson: { username: 'jackson', password: 'Jackson123', label: 'Jackson' },
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState('grandpa'); // 'grandpa' | 'jackson'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError('Invalid username or password.');
        } else {
          setError('Something went wrong. Try again.');
        }
        return;
      }

      router.push('/');
    } catch (err) {
      setError('Network error. Check the server and try again.');
    } finally {
      setLoading(false);
    }
  }

  function selectPreset(key) {
    setSelected(key);
    setUsername(PRESETS[key].username);
    setPassword(PRESETS[key].password);
  }

  return (
    <>
      <Head>
        <title>ChessFam Login</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.glowOrb} />
        <div className={styles.glowOrbSecondary} />
        <div className={styles.card}>
          <h1 className={styles.title}>ChessFam</h1>
          <p className={styles.subtitle}>Grandpa vs Jackson battle hub</p>

          <div className={styles.profileToggle}>
            <button
              type="button"
              className={`${styles.profileButton} ${
                selected === 'grandpa' ? styles.profileButtonActive : ''
              }`}
              onClick={() => selectPreset('grandpa')}
            >
              👴 Grandpa
            </button>
            <button
              type="button"
              className={`${styles.profileButton} ${
                selected === 'jackson' ? styles.profileButtonActive : ''
              }`}
              onClick={() => selectPreset('jackson')}
            >
              🎮 Jackson
            </button>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.label}>
              Username
              <input
                className={styles.input}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </label>

            <label className={styles.label}>
              Password
              <input
                className={styles.input}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            {error && <div className={styles.error}>{error}</div>}

            <button
              type="submit"
              className={styles.submit}
              disabled={loading}
            >
              {loading ? 'Logging in…' : 'Enter the Arena'}
            </button>

            <p className={styles.hint}>
              Tip: tap a profile above to auto-fill the right password.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
