import { withDb } from "@/lib/db";
import { error, json, readJson, str } from "@/lib/http";

async function verify(token: string) {
  if (!token) return error("Verification token is required", 400);
  const verified = await withDb((sql) =>
    sql.begin(async (tx) => {
      const [row] = await tx<{ user_id: string }[]>`
        DELETE FROM email_verification_tokens
        WHERE token = ${token} AND expires_at > now()
        RETURNING user_id`;
      if (!row) return false;
      await tx`UPDATE users SET email_verified = true WHERE id = ${row.user_id}`;
      return true;
    }),
  );
  if (!verified) {
    return error("Invalid or expired verification link. You may request a new one by registering again.", 400);
  }
  return json({ message: "Email verified. You can now log in." });
}

export async function GET(req: Request) {
  return verify(new URL(req.url).searchParams.get("token")?.trim() ?? "");
}

export async function POST(req: Request) {
  return verify(str((await readJson(req)).token));
}
