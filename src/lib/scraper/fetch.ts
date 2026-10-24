import { getEnv } from "../env";

// Browser-like headers to reduce 403s from sites like AllRecipes.
const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

export class FetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function fetchText(url: string, init: RequestInit, timeoutMs: number): Promise<string> {
  const res = await fetch(url, { ...init, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new FetchError(`${res.status} ${res.statusText}`.trim(), res.status);
  return res.text();
}

function direct(url: string): Promise<string> {
  const { origin } = new URL(url);
  return fetchText(url, { headers: { ...DEFAULT_HEADERS, Referer: `${origin}/` } }, 15_000);
}

/** Any scraping API reachable by URL template, e.g. `https://api.scraperapi.com/?api_key=K&url={url}`. */
function viaScraperApi(template: string, url: string): Promise<string> {
  return fetchText(template.replace("{url}", encodeURIComponent(url)), {}, 60_000);
}

/** Bright Data Web Unlocker (replaces the HTTP proxy, which Workers' fetch can't use). */
function viaBrightData(apiKey: string, zone: string, url: string): Promise<string> {
  return fetchText(
    "https://api.brightdata.com/request",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zone, url, format: "raw" }),
    },
    60_000,
  );
}

function friendlyMessage(err: unknown): string {
  const status = err instanceof FetchError ? err.status : undefined;
  if (status === 402 || status === 403) {
    return (
      `This recipe site blocked the request (${status}). ` +
      "Set SCRAPER_API_URL or BRIGHTDATA_API_KEY/BRIGHTDATA_ZONE to route scraping through an unblocking service."
    );
  }
  return `Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`;
}

export function hasScrapingService(): boolean {
  const env = getEnv();
  return Boolean(env.SCRAPER_API_URL || (env.BRIGHTDATA_API_KEY && env.BRIGHTDATA_ZONE));
}

/**
 * Fetch page HTML directly; if that fails and a scraping service is configured, retry through it.
 * `skipDirect` goes straight to the service (e.g. when the direct response was a bot-challenge page).
 */
export async function fetchHtml(url: string, { skipDirect = false } = {}): Promise<string> {
  const env = getEnv();
  const fallbacks: Array<() => Promise<string>> = [];
  if (env.SCRAPER_API_URL) fallbacks.push(() => viaScraperApi(env.SCRAPER_API_URL!, url));
  if (env.BRIGHTDATA_API_KEY && env.BRIGHTDATA_ZONE) {
    fallbacks.push(() => viaBrightData(env.BRIGHTDATA_API_KEY!, env.BRIGHTDATA_ZONE!, url));
  }

  let firstError: unknown;
  if (!skipDirect) {
    try {
      return await direct(url);
    } catch (e) {
      firstError = e;
      console.warn(`Direct fetch failed for ${url}:`, e);
    }
  }
  for (const attempt of fallbacks) {
    try {
      return await attempt();
    } catch (e) {
      firstError ??= e;
      console.warn(`Scraping service fetch failed for ${url}:`, e);
    }
  }
  throw new FetchError(friendlyMessage(firstError));
}
