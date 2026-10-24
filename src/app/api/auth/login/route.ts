import { hashPassword, isLegacyHash, setSessionCookie, verifyPassword } from "@/lib/auth";
import { publicUser, withDb, type UserRow } from "@/lib/db";
import { error, json, readJson, str } from "@/lib/http";

export async function POST(req: Request) {
  const body = await readJson(req);
  const username = str(body.username);
  const password = str(body.password);
  if (!username || !password) return error("Username and password are required", 400);

  try {
    const result = await withDb(async (sql) => {
      const [user] = await sql<UserRow[]>`SELECT * FROM users WHERE username = ${username}`;
      if (!user || !(await verifyPassword(password, user.password_hash))) return { status: 401 as const };
      if (!user.email_verified) return { status: 403 as const };
      // Transparently upgrade the Flask app's unsalted SHA-256 hashes.
      if (isLegacyHash(user.password_hash)) {
        await sql`UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${user.id}`;
      }
      return { status: 200 as const, user };
    });

    if (result.status === 401) return error("Invalid username or password", 401);
    if (result.status === 403) {
      return error("Please verify your email before logging in. Check your inbox for the verification link.", 403);
    }
    await setSessionCookie(result.user.id);
    return json({ message: "Login successful", user: publicUser(result.user) });
  } catch (e) {
    console.error("Error logging in:", e);
    return error("Failed to login", 500);
  }
}
