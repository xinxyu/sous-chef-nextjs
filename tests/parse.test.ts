import { describe, expect, it } from "vitest";
import { durationToMinutes, normalizeYields, parseRecipe } from "@/lib/scraper/parse";

const page = (head: string, body = "") => `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

describe("parseRecipe: JSON-LD", () => {
  it("extracts count and contents of ingredients", () => {
    const ingredients = ["2 cups flour", "1 tsp salt", "3 eggs"];
    const r = parseRecipe(page(ld({ "@type": "Recipe", name: "Test", recipeIngredient: ingredients })), "https://example.com/r");
    expect(r.ingredients).toEqual(ingredients);
    expect(r.title).toBe("Test");
    expect(r.host).toBe("example.com");
  });

  it("finds the Recipe inside @graph with array @type, sections, durations and yields", () => {
    const html = page(
      ld({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", name: "Site" },
          {
            "@type": ["Recipe", "NewsArticle"],
            name: "Mac &amp; Cheese",
            totalTime: "PT1H15M",
            recipeYield: ["4", "4 servings"],
            image: [{ "@type": "ImageObject", url: "https://cdn.example.com/a.jpg" }],
            recipeIngredient: ["  1 lb   macaroni ", "2 cups cheddar"],
            recipeInstructions: [
              { "@type": "HowToSection", name: "Pasta", itemListElement: [{ "@type": "HowToStep", text: "Boil <b>water</b>." }] },
              { "@type": "HowToStep", text: "Stir in cheese." },
            ],
            nutrition: { "@type": "NutritionInformation", calories: "500 kcal" },
          },
        ],
      }),
    );
    const r = parseRecipe(html, "https://www.example.com/mac");
    expect(r).toMatchObject({
      title: "Mac & Cheese",
      total_time: 75,
      yields: "4 servings",
      image: "https://cdn.example.com/a.jpg",
      ingredients: ["1 lb macaroni", "2 cups cheddar"],
      instructions: ["Boil water.", "Stir in cheese."],
      nutrients: { calories: "500 kcal" },
      host: "example.com",
    });
  });

  it("sums prep and cook time when totalTime is missing, and splits string instructions", () => {
    const r = parseRecipe(
      page(ld([{ "@type": "Recipe", name: "X", prepTime: "PT10M", cookTime: "PT20M", recipeIngredient: ["a b c"], recipeInstructions: "Step one.\nStep two." }])),
      "https://example.com",
    );
    expect(r.total_time).toBe(30);
    expect(r.instructions).toEqual(["Step one.", "Step two."]);
  });
});

describe("parseRecipe: fallbacks", () => {
  it("uses microdata when there is no JSON-LD", () => {
    const body = `<div itemscope itemtype="http://schema.org/Recipe">
      <h1 itemprop="name">Pancakes</h1>
      <meta itemprop="totalTime" content="PT20M">
      <ul><li itemprop="recipeIngredient">1 cup milk</li><li itemprop="recipeIngredient">1 egg</li></ul>
      <ol itemprop="recipeInstructions"><li>Whisk.</li><li>Fry.</li></ol>
    </div>`;
    const r = parseRecipe(page("", body), "https://example.com");
    expect(r).toMatchObject({ title: "Pancakes", total_time: 20, ingredients: ["1 cup milk", "1 egg"], instructions: ["Whisk.", "Fry."] });
  });

  it("uses AllRecipes-style selectors and heading-based instructions", () => {
    const body = `<h1>Soup</h1>
      <ul><li class="mntl-structured-ingredients__list-item"><span>1</span> <span>onion</span></li>
          <li class="mntl-structured-ingredients__list-item"><span>2</span> <span>carrots</span></li></ul>
      <h2>Directions</h2><ol><li>Chop everything.</li><li>Simmer.</li></ol>`;
    const r = parseRecipe(page('<meta property="og:image" content="/img.jpg">', body), "https://site.test/soup");
    expect(r.title).toBe("Soup");
    expect(r.ingredients).toEqual(["1 onion", "2 carrots"]);
    expect(r.instructions).toEqual(["Chop everything.", "Simmer."]);
    expect(r.image).toBe("https://site.test/img.jpg");
  });

  it("uses an Ingredients heading followed by a list", () => {
    const body = `<h2>Ingredients</h2><div><ul><li>1 cup rice</li><li>2 cups water</li></ul></div>`;
    expect(parseRecipe(page("", body), "https://x.test").ingredients).toEqual(["1 cup rice", "2 cups water"]);
  });

  it("throws when the page has no recipe", () => {
    expect(() => parseRecipe(page("<title>Hi</title>", "<p>Hello</p>"), "https://x.test")).toThrow();
  });

  it("tolerates malformed JSON-LD", () => {
    const html = page('<script type="application/ld+json">{not json</script>', "<h2>Ingredients</h2><ul><li>1 cup rice</li></ul>");
    expect(parseRecipe(html, "https://x.test").ingredients).toEqual(["1 cup rice"]);
  });
});

describe("helpers", () => {
  it("durationToMinutes", () => {
    expect(durationToMinutes("PT45M")).toBe(45);
    expect(durationToMinutes("P0DT1H")).toBe(60);
    expect(durationToMinutes("P1D")).toBe(1440);
    expect(durationToMinutes("30")).toBe(30);
    expect(durationToMinutes("PT0M")).toBeNull();
    expect(durationToMinutes("soon")).toBeNull();
    expect(durationToMinutes(undefined)).toBeNull();
  });

  it("normalizeYields", () => {
    expect(normalizeYields("4")).toBe("4 servings");
    expect(normalizeYields(1)).toBe("1 serving");
    expect(normalizeYields("12 cookies")).toBe("12 cookies");
    expect(normalizeYields(["6", "6 to 8 servings"])).toBe("6 to 8 servings");
    expect(normalizeYields(null)).toBe("");
  });
});
