import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE, hashPassword, randomToken, setSessionCookie } from "@/lib/auth";
import { withDb, type UserRow } from "@/lib/db";
import { baseUrl, getEnv } from "@/lib/env";
import { findUserByEmail, uniqueUsername } from "@/lib/users";

interface GoogleUserInfo {
  sub?: string;
  email?: string;
}

export async function GET(req: Request) {
  const env = getEnv();
  const base = baseUrl(req);
  const fail = (msg: string) => NextResponse.redirect(`${base}/#oauth_error=${encodeURIComponent(msg)}`);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return fail("Google sign-in is not configured");

  const params = new URL(req.url).searchParams;
  const jar = await cookies();
  const [expectedState, verifier] = (jar.get(OAUTH_STATE_COOKIE)?.value ?? "").split(".");
  jar.delete({ name: OAUTH_STATE_COOKIE, path: "/api/auth/google" });
  const code = params.get("code");
  if (!code || !expectedState || params.get("state") !== expectedState) {
    return fail("Google sign-in was cancelled or failed");
  }

  let userinfo: GoogleUserInfo;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange ${tokenRes.status}: ${await tokenRes.text()}`);
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) return fail("No access token from Google");

    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new Error(`userinfo ${infoRes.status}`);
    userinfo = (await infoRes.json()) as GoogleUserInfo;
  } catch (e) {
    console.warn("Google OAuth callback failed:", e);
    return fail("Google sign-in was cancelled or failed");
  }

  const googleSub = userinfo.sub?.trim();
  const email = userinfo.email?.trim();
  if (!googleSub) return fail("Invalid Google account");
  if (!email) return fail("Google did not provide an email");

  let user: UserRow | string;
  try {
    user = await withDb(async (sql) => {
      const [bySub] = await sql<UserRow[]>`SELECT * FROM users WHERE google_sub = ${googleSub}`;
      if (bySub) {
        if (!bySub.email_verified) await sql`UPDATE users SET email_verified = true WHERE id = ${bySub.id}`;
        return bySub;
      }
      const byEmail = await findUserByEmail(sql, email);
      if (byEmail) {
        if (byEmail.google_sub && byEmail.google_sub !== googleSub) {
          return "This email is linked to another Google account";
        }
        await sql`UPDATE users SET google_sub = ${googleSub}, email_verified = true WHERE id = ${byEmail.id}`;
        return byEmail;
      }
      const username = await uniqueUsername(sql, email.split("@")[0] || "user");
      const [created] = await sql<UserRow[]>`
        INSERT INTO users (id, username, email, password_hash, created_at, email_verified, google_sub)
        VALUES (${crypto.randomUUID()}, ${username}, ${email}, ${await hashPassword(randomToken(48))}, now(), true, ${googleSub})
        RETURNING *`;
      return created;
    });
  } catch (e) {
    console.error("Google OAuth user persist failed:", e);
    return fail("Could not save account");
  }
  if (typeof user === "string") return fail(user);

  await setSessionCookie(user.id);
  return NextResponse.redirect(`${base}/`);
}
