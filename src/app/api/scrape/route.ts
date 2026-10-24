import { error, json, readJson, str } from "@/lib/http";
import { FetchError, scrapeRecipe } from "@/lib/scraper";

export async function POST(req: Request) {
  const url = str((await readJson(req)).url);
  if (!url) return error("URL is required", 400);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return error("Please enter a valid URL", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return error("Only http(s) URLs are supported", 400);

  try {
    return json(await scrapeRecipe(parsed.toString()));
  } catch (e) {
    console.error(`Error scraping ${url}:`, e);
    if (e instanceof FetchError) return error(e.message, 502);
    return error(`Failed to scrape recipe: ${e instanceof Error ? e.message : String(e)}`, 500);
  }
}
