# sous-chef (Next.js on Cloudflare Workers)

A meal planning and recipe app — a port of the Flask + Angular `sous-chef` to a single Next.js app
that runs on Cloudflare Workers via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).

## Features

1. **Recipe scraper** — paste a recipe URL to get the ingredients and instructions without the ads. Export to PDF.
2. **My Recipes** — save scraped recipes to your account.
3. **Menu & shopping list** — pick saved recipes to build a menu and a shopping list (by recipe or combined),
   copy it for notes, or send it to Google Keep.
4. **Accounts** — username/password with email verification and password reset (via Resend), or Google sign-in.

## Layout

```
src/app/page.tsx                 UI entry (also served at /verify-email and /reset-password for email links)
src/components/                  SousChefApp (root), ScrapeTab, MyRecipesTab, MenuListTab, AuthModals
src/app/api/scrape               POST  { url } → recipe
src/app/api/recipes              GET list / POST save;  /api/recipes/[id]  GET / DELETE
src/app/api/auth/*               register, login, logout, me, verify-email, forgot-password, reset-password,
                                 google, google/callback
src/lib/scraper/                 fetch (direct → scraping service fallback) + parse (JSON-LD, microdata, heuristics)
db/schema.sql                    Postgres schema (identical to the Flask app's)
```

## Differences from the Flask/Angular version

- **One deployment, same origin.** No CORS or `API_URL` injection; the API lives under `/api`.
- **Sessions** are an httpOnly cookie holding the same HS256 JWT (`user_id` claim) the Flask app issued.
  `Authorization: Bearer <jwt>` is still accepted for API clients.
- **Passwords** are now hashed with salted PBKDF2-SHA256. Existing unsalted SHA-256 hashes from the Flask app
  still work and are upgraded automatically on the user's next login.
- **Scraping** no longer uses Python `recipe-scrapers`. It's replaced with a TypeScript parser for schema.org
  JSON-LD/microdata (what `recipe-scrapers` mostly relies on) plus the old fallback heuristics.
  Workers can't use HTTP proxies, `curl_cffi`, or `cloudscraper`, so blocked sites are retried through a
  scraping API instead (see `SCRAPER_API_URL` / `BRIGHTDATA_*` below).
- **Google OAuth** is implemented directly (state + PKCE) instead of Authlib. The redirect URI is now
  `<APP_BASE_URL>/api/auth/google/callback`.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars          # fill in what you need
psql "$DATABASE_URL" -f db/schema.sql   # once; safe to re-run against the existing Flask database
```

The database is reached through the `HYPERDRIVE` binding. Locally it uses `localConnectionString` in
`wrangler.jsonc` (or the `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` env var). Wrangler requires
a password in that URL; for trust-auth local Postgres any placeholder works (`postgresql://me:x@localhost:5432/sous_chef`).

```bash
npm run dev       # Next.js dev server with Cloudflare bindings, http://localhost:3000
npm run preview   # build and run the real Worker locally in workerd, http://localhost:8787
npm test          # unit tests (parser, shopping list, password hashing)
npm run lint      # type-check
```

## Deploying to Cloudflare

1. Create a Hyperdrive config for your Postgres database and put its id in `wrangler.jsonc`:
   ```bash
   npx wrangler hyperdrive create sous-chef-db --connection-string="postgresql://user:pass@host:5432/sous_chef"
   ```
2. Set secrets:
   ```bash
   npx wrangler secret put SECRET_KEY            # reuse the Flask SECRET_KEY to keep existing sessions valid
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put SCRAPER_API_URL       # optional, see below
   ```
   Plain vars (`APP_BASE_URL`, `FROM_EMAIL`, `JWT_EXPIRY_DAYS`) can go in `wrangler.jsonc` under `"vars"` or in the dashboard.
3. Deploy:
   ```bash
   npm run deploy
   ```
4. In Google Cloud Console, add `https://<your-domain>/api/auth/google/callback` as an authorized redirect URI.

## Environment

| Name | Purpose |
| --- | --- |
| `HYPERDRIVE` (binding) | Postgres connection. Falls back to `DATABASE_URL` if the binding is absent. |
| `SECRET_KEY` | Signs session JWTs. |
| `JWT_EXPIRY_DAYS` | Session length (default 7). |
| `APP_BASE_URL` | Base for email links and the OAuth redirect. Defaults to the request origin. |
| `RESEND_API_KEY`, `FROM_EMAIL` | Verification and reset emails. Without a key, emails are skipped and the link is logged. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in. |
| `SCRAPER_API_URL` | Fallback for sites that block Cloudflare IPs: any URL template containing `{url}`, e.g. `https://api.scraperapi.com/?api_key=KEY&url={url}` (ScraperAPI, ZenRows, ScrapingBee…). |
| `BRIGHTDATA_API_KEY`, `BRIGHTDATA_ZONE` | Alternative fallback: Bright Data Web Unlocker API (replaces the old `SCRAPING_PROXY`). |

The fallback is used when the direct fetch fails, or when it succeeds but the page has no recipe (typically a
bot-challenge page).
