import type { Sql, UserRow } from "./db";

export async function findUserByEmail(sql: Sql, email: string): Promise<UserRow | undefined> {
  const [user] = await sql<UserRow[]>`
    SELECT * FROM users WHERE email IS NOT NULL AND lower(trim(email)) = ${email.trim().toLowerCase()} LIMIT 1`;
  return user;
}

export async function findUserById(sql: Sql, id: string): Promise<UserRow | undefined> {
  const [user] = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${id}`;
  return user;
}

function sanitizeUsernameBase(s: string): string {
  const base = s.trim().replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "user";
  return base.length < 3 ? `${base}_sc` : base;
}

export async function uniqueUsername(sql: Sql, raw: string): Promise<string> {
  const base = sanitizeUsernameBase(raw);
  const taken = new Set(
    (await sql<{ username: string }[]>`SELECT username FROM users WHERE username = ${base} OR username LIKE ${base + "\\_%"}`).map(
      (r) => r.username,
    ),
  );
  let candidate = base;
  for (let n = 1; taken.has(candidate); n++) candidate = `${base}_${n}`;
  return candidate;
}

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}
