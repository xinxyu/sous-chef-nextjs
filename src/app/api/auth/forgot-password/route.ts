import { randomToken } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { baseUrl } from "@/lib/env";
import { error, json, readJson, str } from "@/lib/http";
import { findUserByEmail } from "@/lib/users";

const GENERIC = "If an account exists with this email, you will receive a reset link.";

export async function POST(req: Request) {
  const email = str((await readJson(req)).email);
  if (!email) return error("Email is required", 400);

  const token = randomToken();
  const user = await withDb(async (sql) => {
    const user = await findUserByEmail(sql, email);
    if (user) {
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await sql`INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (${token}, ${user.id}, ${expiresAt})`;
    }
    return user;
  });
  if (user) {
    const resetUrl = `${baseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;
    await sendEmail(
      email,
      "Reset your password - Sous Chef",
      `Hi ${user.username},\n\nReset your password by opening this link:\n${resetUrl}\n\nThe link expires in 1 hour.`,
      `<p>Hi ${escapeHtml(user.username)},</p><p><a href="${resetUrl}">Reset your password</a>.</p><p>The link expires in 1 hour.</p>`,
    );
  }
  return json({ message: GENERIC });
}
