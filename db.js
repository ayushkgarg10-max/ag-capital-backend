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

// Simple helper - runs a parameterized query, returns the rows array.
export async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

export { pool };
