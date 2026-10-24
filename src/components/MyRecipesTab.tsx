"use client";

import type { Recipe } from "@/lib/types";

interface Props {
  savedRecipes: Recipe[];
  selectedIds: Set<string>;
  onLoadRecipe: (id: string) => void;
  onDeleteRecipe: (id: string) => void;
  onCreateMenu: () => void;
  onToggleSelection: (id: string) => void;
}

export default function MyRecipesTab({
  savedRecipes,
  selectedIds,
  onLoadRecipe,
  onDeleteRecipe,
  onCreateMenu,
  onToggleSelection,
}: Props) {
  return (
    <section className="card saved-recipes-list">
      <h2>
        <i className="fa-solid fa-book icon-left" />
        My Saved Recipes
      </h2>
      <p className="menu-hint">Select recipes to add to a menu, then click &quot;Create Menu&quot; for a combined shopping list.</p>

      {savedRecipes.length === 0 ? (
        <div className="empty-state">
          <p>No saved recipes yet. Scrape and save a recipe to get started!</p>
        </div>
      ) : (
        <>
          <div className="menu-actions">
            <button className="btn" disabled={selectedIds.size === 0} onClick={onCreateMenu}>
              Create Menu ({selectedIds.size} selected)
            </button>
          </div>
          <div className="recipes-list">
            {savedRecipes.map((r) => {
              const id = r.id!;
              const selected = selectedIds.has(id);
              return (
                <div key={id} className={`recipe-list-item selectable${selected ? " selected" : ""}`}>
                  <div className="recipe-list-content" onClick={() => onToggleSelection(id)}>
                    <label className="recipe-checkbox" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelection(id)}
                        aria-label={`Select ${r.title || "recipe"}`}
                      />
                    </label>
                    <div className="recipe-list-content-inner">
                      {r.image && (
                        <div className="recipe-list-image">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.image} alt="Recipe" referrerPolicy="no-referrer" loading="lazy" />
                        </div>
                      )}
                      <div className="recipe-list-info">
                        <h3>{r.title || "Untitled Recipe"}</h3>
                        <div className="recipe-list-meta">
                          {r.total_time != null && (
                            <span>
                              <i className="fa-solid fa-clock icon-left" />
                              {r.total_time} min
                            </span>
                          )}
                          {r.yields && (
                            <span>
                              <i className="fa-solid fa-utensils icon-left" />
                              {r.yields}
                            </span>
                          )}
                          {r.host && (
                            <span>
                              <i className="fa-solid fa-link icon-left" />
                              {r.host}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn-view-recipe"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadRecipe(id);
                          }}
                          title="View recipe"
                        >
                          <i className="fa-solid fa-arrow-right icon-left" />
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                  <button className="btn-delete-list" onClick={() => onDeleteRecipe(id)} title="Delete recipe" aria-label="Delete recipe">
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
