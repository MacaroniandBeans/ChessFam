
# ChessFam

Two-player async chess for Grandpa and Grandson.

## Setup

### Prerequisites
- Node.js 18+
- A Turso account ([sign up here](https://turso.tech))

### Database Setup

1. **Create a Turso database:**
   ```bash
   turso db create chessfam
   ```

2. **Get your database URL:**
   ```bash
   turso db show chessfam --url
   ```

3. **Create an auth token:**
   ```bash
   turso db tokens create chessfam
   ```

4. **Set environment variables:**
   - Copy `.env.example` to `.env.local`
   - Add your Turso credentials to `.env.local`

### Local Development

```bash
npm install
npm run dev
```

Visit http://localhost:3000

### Deployment to Vercel

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel project settings:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `SESSION_SECRET`
4. Deploy!

The database schema will be automatically initialized on first run.

