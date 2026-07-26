// File location: lib/db.js
//
// Direct Postgres connection (via node-postgres / "pg" library) -
// replaces the old Supabase lib/supabase.js which talked to Supabase's
// REST API (PostgREST) over HTTP. Here we run real SQL directly
// against our own Render Postgres database.
//
// REQUIRED environment variable:
//   DATABASE_URL = <Render Postgres Internal Database URL>
//   (set this in Render's Web Service -> Environment tab)

import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render's internal Postgres connections don't need SSL, but external
  // ones do. This setting works safely for both.
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes("render.com")
    ? { rejectUnauthorized: false }
    : false,
});

// CRITICAL: pg's Pool emits an 'error' event whenever an IDLE client in
// the pool hits a network error (brief connection blip, server restart,
// etc.) - this is normal/expected sometimes. But if NOTHING is
// listening for this event, Node.js treats it as an uncaught exception
// and CRASHES THE ENTIRE PROCESS. Without this handler, one random idle
// connection hiccup would kill heartbeats for every account until
// Render auto-restarts the service - exactly what was happening before
// this was added. This handler just logs it and lets the pool recover
// on its own (which it does automatically for the next query).
pool.on("error", (err) => {
  console.error("[pg pool] Unexpected error on idle client (recovering):", err.message);
});

// Simple helper - runs a parameterized query, returns the rows array.
export async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

export { pool };
