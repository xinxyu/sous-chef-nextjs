import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface AppEnv {
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
  SECRET_KEY?: string;
  JWT_EXPIRY_DAYS?: string;
  APP_BASE_URL?: string;
  RESEND_API_KEY?: string;
  FROM_EMAIL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SCRAPER_API_URL?: string;
  BRIGHTDATA_API_KEY?: string;
  BRIGHTDATA_ZONE?: string;
}

/** Worker bindings + vars/secrets (from wrangler config, `.dev.vars`, or the dashboard). */
export function getEnv(): AppEnv {
  return getCloudflareContext().env as unknown as AppEnv;
}

/** Public base URL for links in emails and OAuth redirects. */
export function baseUrl(req: Request): string {
  const raw = (getEnv().APP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (raw) return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
  return new URL(req.url).origin;
}
