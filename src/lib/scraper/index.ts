import { fetchHtml, hasScrapingService } from "./fetch";
import { parseRecipe, type ScrapedRecipe } from "./parse";

export { FetchError } from "./fetch";
export type { ScrapedRecipe } from "./parse";

export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  const html = await fetchHtml(url);
  let recipe: ScrapedRecipe;
  try {
    recipe = parseRecipe(html, url);
  } catch (e) {
    // A 200 with no recipe is often a bot-challenge page; retry through the scraping service.
    if (!hasScrapingService()) throw e;
    recipe = parseRecipe(await fetchHtml(url, { skipDirect: true }), url);
  }
  return { ...recipe, source_url: url };
}
