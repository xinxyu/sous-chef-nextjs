import postgres from "postgres";
import { getEnv } from "./env";

export type Sql = postgres.Sql;

/**
 * Runs `fn` with a Postgres client scoped to this request.
 * Workers can't share sockets across requests, so a client is opened per request;
 * Hyperdrive does the actual pooling.
 */
export async function withDb<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const env = getEnv();
  const url = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  if (!url) throw new Error("Database is not configured (HYPERDRIVE binding or DATABASE_URL)");
  const sql = postgres(url, { max: 5, fetch_types: false, prepare: true });
  try {
    return await fn(sql);
  } finally {
    // Don't block the response on closing the socket.
    sql.end({ timeout: 1 }).catch(() => {});
  }
}

export interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  created_at: Date;
  email_verified: boolean;
  google_sub: string | null;
}

export function publicUser(u: UserRow) {
  return { id: u.id, username: u.username, email: u.email, google_account: Boolean(u.google_sub) };
}
