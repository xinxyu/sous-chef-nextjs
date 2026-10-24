import { hashPassword } from "@/lib/auth";
import { withDb } from "@/lib/db";
import { error, json, readJson, str } from "@/lib/http";

export async function POST(req: Request) {
  const body = await readJson(req);
  const token = str(body.token) || (new URL(req.url).searchParams.get("token") ?? "");
  const newPassword = str(body.new_password) || str(body.password);
  if (!token) return error("Reset token is required", 400);
  if (newPassword.length < 6) return error("New password must be at least 6 characters", 400);

  const passwordHash = await hashPassword(newPassword);
  const updated = await withDb((sql) =>
    sql.begin(async (tx) => {
      const [row] = await tx<{ user_id: string }[]>`
        DELETE FROM password_reset_tokens
        WHERE token = ${token} AND expires_at > now()
        RETURNING user_id`;
      if (!row) return false;
      await tx`UPDATE users SET password_hash = ${passwordHash} WHERE id = ${row.user_id}`;
      return true;
    }),
  );
  if (!updated) return error("Invalid or expired reset link. Please request a new one.", 400);
  return json({ message: "Password updated. You can now log in with your new password." });
}
