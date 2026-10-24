import { describe, expect, it } from "vitest";
import { combineIngredients, getAmountPhrase, menuAndListText } from "@/lib/shopping";
import type { Recipe } from "@/lib/types";

const recipe = (title: string, ingredients: string[]): Recipe => ({
  title,
  ingredients,
  total_time: null,
  yields: null,
  instructions: [],
  image: null,
  host: null,
  nutrients: null,
});

describe("shopping list", () => {
  it("extracts amount phrases", () => {
    expect(getAmountPhrase("2 cups flour")).toBe("2 cups");
    expect(getAmountPhrase("½ tsp salt")).toBe("½ tsp");
    expect(getAmountPhrase("salt to taste")).toBe("");
  });

  it("merges the same item across recipes", () => {
    const combined = combineIngredients([recipe("A", ["2 cups flour", "1 egg"]), recipe("B", ["1 cup flour", "salt"])]);
    expect(combined).toEqual([
      { name: "egg", amounts: ["1"] },
      { name: "flour", amounts: ["2 cups", "1 cup"] },
      { name: "salt", amounts: ["salt"] },
    ]);
  });

  it("formats menu text", () => {
    expect(menuAndListText([recipe("A", ["1 egg"])])).toBe("Menu\n\n• A\n\nShopping List\n\nA\n\n• 1 egg");
  });
});
