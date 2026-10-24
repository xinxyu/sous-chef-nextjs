import { hashPassword, randomToken } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { baseUrl } from "@/lib/env";
import { error, json, readJson, str } from "@/lib/http";
import { findUserByEmail, isUniqueViolation } from "@/lib/users";

export async function POST(req: Request) {
  const body = await readJson(req);
  const username = str(body.username);
  const password = str(body.password);
  const email = str(body.email);
  if (!username || !password) return error("Username and password are required", 400);
  if (!email) return error("Email is required for registration", 400);
  if (username.length < 3) return error("Username must be at least 3 characters", 400);
  if (password.length < 6) return error("Password must be at least 6 characters", 400);

  const token = randomToken();
  try {
    const conflict = await withDb(async (sql) => {
      const [existing] = await sql`SELECT 1 FROM users WHERE username = ${username}`;
      if (existing) return "Username already exists";
      if (await findUserByEmail(sql, email)) return "An account with this email already exists";

      const userId = crypto.randomUUID();
      const passwordHash = await hashPassword(password);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await sql.begin(async (tx) => {
        await tx`
          INSERT INTO users (id, username, email, password_hash, created_at, email_verified)
          VALUES (${userId}, ${username}, ${email}, ${passwordHash}, now(), false)`;
        await tx`
          INSERT INTO email_verification_tokens (token, user_id, expires_at)
          VALUES (${token}, ${userId}, ${expiresAt})`;
      });
      return null;
    });
    if (conflict) return error(conflict, 400);
  } catch (e) {
    if (isUniqueViolation(e)) return error("Username already exists", 400);
    console.error("Error registering user:", e);
    return error("Failed to register user", 500);
  }

  const verifyUrl = `${baseUrl(req)}/verify-email?token=${encodeURIComponent(token)}`;
  const emailSent = await sendEmail(
    email,
    "Verify your email - Sous Chef",
    `Hi ${username},\n\nPlease verify your email by opening this link:\n${verifyUrl}\n\nThe link expires in 24 hours.`,
    `<p>Hi ${escapeHtml(username)},</p><p>Please <a href="${verifyUrl}">verify your email</a>.</p><p>The link expires in 24 hours.</p>`,
  );
  return json(
    {
      message: "Registration successful. Please check your email to verify your account before logging in.",
      email_sent: emailSent,
    },
    201,
  );
}
