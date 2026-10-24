"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { exportRecipeToPdf } from "@/lib/pdf";
import { recipeSteps, type Recipe, type User } from "@/lib/types";

interface Props {
  recipe: Recipe | null;
  currentUser: User | null;
  onRecipeLoaded: (recipe: Recipe) => void;
  onRecipeSaved: (recipe: Recipe) => void;
  onShowLogin: () => void;
}

export default function ScrapeTab({ recipe, currentUser, onRecipeLoaded, onRecipeSaved, onShowLogin }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function scrape() {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a recipe URL");
      return;
    }
    setLoading(true);
    try {
      onRecipeLoaded(await api.scrape(trimmed));
    } catch (e) {
      setError(errorMessage(e, "Failed to scrape recipe"));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!recipe || !currentUser) return;
    setSaving(true);
    setError(null);
    try {
      onRecipeSaved(await api.saveRecipe(recipe));
    } catch (e) {
      setError(errorMessage(e, "Failed to save recipe"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="card">
        <form
          className="input-group"
          onSubmit={(e) => {
            e.preventDefault();
            scrape();
          }}
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter recipe URL (e.g., https://www.allrecipes.com/recipe/...)"
            aria-label="Recipe URL"
          />
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Scraping…" : "Scrape Recipe"}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
        {loading && <div className="loading">Scraping recipe... Please wait.</div>}
      </section>

      {recipe && (
        <section className="card recipe">
          <div className="recipe-header">
            <div className="recipe-title-row">
              <h2>{recipe.title || "Untitled Recipe"}</h2>
              <div className="recipe-header-actions">
                <button className="btn btn-small" onClick={() => exportRecipeToPdf(recipe)} title="Export to PDF">
                  <i className="fa-solid fa-file-pdf icon-left" />
                  Export PDF
                </button>
                {!recipe.id && currentUser && (
                  <button className="btn btn-save" onClick={save} disabled={saving}>
                    {saving ? (
                      "Saving…"
                    ) : (
                      <>
                        <i className="fa-solid fa-floppy-disk icon-left" />
                        Save Recipe
                      </>
                    )}
                  </button>
                )}
                {recipe.id && (
                  <span className="saved-badge">
                    <i className="fa-solid fa-check icon-left" />
                    Saved
                  </span>
                )}
                {!currentUser && (
                  <div className="login-prompt">
                    <button className="link-button" onClick={onShowLogin}>
                      Login to save recipes
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="recipe-meta">
              <div className="meta-item">
                <div className="meta-label">Total Time</div>
                <div className="meta-value">{recipe.total_time != null ? `${recipe.total_time} minutes` : "N/A"}</div>
              </div>
              <div className="meta-item">
                <div className="meta-label">Yields</div>
                <div className="meta-value">{recipe.yields || "N/A"}</div>
              </div>
            </div>

            {recipe.source_url && (
              <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="recipe-source-link">
                <i className="fa-solid fa-link icon-left" />
                View original recipe
              </a>
            )}

            {recipe.image && (
              // eslint-disable-next-line @next/next/no-img-element -- remote images from arbitrary recipe sites
              <img src={recipe.image} alt="Recipe" className="recipe-image" referrerPolicy="no-referrer" />
            )}
          </div>

          <div className="section">
            <h3>Ingredients</h3>
            <ul className="ingredients-list">
              {(recipe.ingredients ?? []).map((ing, i) => (
                <li key={i}>{ing}</li>
              ))}
            </ul>
          </div>

          <div className="section">
            <h3>Instructions</h3>
            <ol className="instructions-list">
              {recipeSteps(recipe).map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </>
  );
}
