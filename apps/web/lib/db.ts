import pg from "pg";

const { Pool } = pg;

declare global {
  var _pool: pg.Pool | undefined;
}

function getPool(): pg.Pool {
  if (!global._pool) {
    global._pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return global._pool;
}

export const pool = getPool();
