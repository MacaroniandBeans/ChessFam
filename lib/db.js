// lib/db.js
// Render-safe stub. We are no longer using a real SQLite DB.
// This exists only so old `getDb()` imports don't blow up immediately.

function getDb() {
  // Return an object with the methods that old code *might* call,
  // but have them fail loudly if actually used.
  return {
    exec() {
      throw new Error('DB exec() called, but database is disabled. Migrate this code to in-memory storage.');
    },
    prepare() {
      throw new Error('DB prepare() called, but database is disabled. Migrate this code to in-memory storage.');
    }
  };
}

module.exports = getDb;
