"use client";

import { useMemo, useState } from "react";
import { combineIngredients, copyText, menuAndListText, shoppingListText } from "@/lib/shopping";
import type { Recipe, User } from "@/lib/types";

interface Props {
  menuRecipes: Recipe[];
  currentUser: User | null;
  onChangeSelection: () => void;
}

/** Shows a confirmation state for `ms`, then resets. */
function useFlash(ms: number): [boolean, () => void] {
  const [on, setOn] = useState(false);
  return [
    on,
    () => {
      setOn(true);
      setTimeout(() => setOn(false), ms);
    },
  ];
}

export default function MenuListTab({ menuRecipes, currentUser, onChangeSelection }: Props) {
  const [view, setView] = useState<"byRecipe" | "combined">("byRecipe");
  const [copied, flashCopied] = useFlash(2000);
  const [keepCopied, flashKeep] = useFlash(3500);
  const [keepError, setKeepError] = useState<string | null>(null);
  const combined = useMemo(() => combineIngredients(menuRecipes), [menuRecipes]);

  async function copyShoppingList() {
    if (await copyText(shoppingListText(menuRecipes))) flashCopied();
  }

  /** Copy menu + shopping list and open Keep (consumer apps cannot use the Keep OAuth scope). */
  async function openInKeep() {
    setKeepError(null);
    if (!(await copyText(menuAndListText(menuRecipes)))) {
      setKeepError('Could not copy. Allow clipboard access or use "Copy for notes".');
      return;
    }
    window.open("https://keep.google.com/", "_blank", "noopener,noreferrer");
    flashKeep();
  }

  return (
    <section className="card menu-card">
      <h2>
        <i className="fa-solid fa-clipboard-list icon-left" />
        Menu &amp; Shopping List
      </h2>

      {menuRecipes.length === 0 ? (
        <div className="empty-state">
          <p>No recipes in your menu. Go to My Recipes, select some recipes, and click &quot;Create Menu&quot;.</p>
          <button className="btn" onClick={onChangeSelection}>
            Choose Recipes
          </button>
        </div>
      ) : (
        <>
          <div className="menu-actions">
            <button className="btn btn-secondary" onClick={onChangeSelection}>
              Change selection
            </button>
          </div>
          <div className="menu-recipes-section">
            <h3>Menu</h3>
            <ul className="menu-recipes-list">
              {menuRecipes.map((r) => (
                <li key={r.id ?? r.title}>{r.title || "Untitled Recipe"}</li>
              ))}
            </ul>
          </div>

          <div className="shopping-list-section">
            <div className="shopping-list-header">
              <h3>
                <i className="fa-solid fa-cart-shopping icon-left" />
                Shopping List
              </h3>
              <div className="shopping-list-actions">
                <button className={`btn btn-copy${copied ? " copied" : ""}`} onClick={copyShoppingList} title="Copy list for notes">
                  <i className={`fa-solid ${copied ? "fa-check" : "fa-clipboard"} icon-left`} />
                  {copied ? "Copied!" : "Copy for notes"}
                </button>
                {currentUser?.google_account && (
                  <button
                    className="btn btn-keep"
                    type="button"
                    onClick={openInKeep}
                    title="Copies your menu and shopping list, opens Google Keep — paste into a new note (⌘V / Ctrl+V)"
                  >
                    <i className={`${keepCopied ? "fa-solid fa-check" : "fa-brands fa-google"} icon-left`} />
                    {keepCopied ? "Copied — paste in Keep" : "Open Google Keep"}
                  </button>
                )}
                <div className="shopping-list-view-toggle">
                  <button className={`toggle-btn${view === "byRecipe" ? " active" : ""}`} onClick={() => setView("byRecipe")}>
                    By Recipe
                  </button>
                  <button className={`toggle-btn${view === "combined" ? " active" : ""}`} onClick={() => setView("combined")}>
                    Combined
                  </button>
                </div>
              </div>
            </div>

            <p className="shopping-list-intro">
              {view === "combined"
                ? "Ingredients merged by item across all recipes:"
                : 'Ingredients listed under each recipe. Use "Copy for notes" or "Open Google Keep" (Google accounts) to save the list.'}
            </p>
            {keepError && <p className="keep-error">{keepError}</p>}

            {view === "combined" ? (
              <ul className="shopping-list">
                {combined.map((item) => (
                  <li key={item.name} className="shopping-list-item">
                    <span className="shopping-list-name">{item.name}</span>
                    <span className="shopping-list-amounts">{item.amounts.join(" + ")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="shopping-list-by-recipe">
                {menuRecipes.map((r) => (
                  <div key={r.id ?? r.title} className="shopping-recipe-block">
                    <h4 className="shopping-recipe-title">{r.title || "Untitled Recipe"}</h4>
                    <ul className="shopping-list">
                      {(r.ingredients ?? []).map((ing, i) => (
                        <li key={i} className="shopping-list-item">
                          <span className="shopping-list-ingredient-full">{ing}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
