"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Recipe, User } from "@/lib/types";
import AuthModals, { type AuthModal } from "./AuthModals";
import MenuListTab from "./MenuListTab";
import MyRecipesTab from "./MyRecipesTab";
import ScrapeTab from "./ScrapeTab";

type Tab = "scrape" | "saved" | "menu";

export default function SousChefApp() {
  const [user, setUser] = useState<User | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("scrape");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [modal, setModal] = useState<AuthModal>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState("");
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Session check, plus handling of email links (/verify-email, /reset-password) and OAuth errors.
  useEffect(() => {
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));

    const hash = window.location.hash;
    if (hash.startsWith("#oauth_error=")) {
      let message = "Google sign-in failed";
      try {
        message = decodeURIComponent(hash.slice("#oauth_error=".length));
      } catch {}
      setOauthError(message);
      setModal("login");
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;
    const path = window.location.pathname;
    window.history.replaceState({}, "", "/");
    if (path.includes("verify-email")) {
      api
        .verifyEmail(token)
        .then((res) => setVerifyResult({ ok: true, message: res.message || "Email verified. You can now log in." }))
        .catch((e) => setVerifyResult({ ok: false, message: e.message || "Invalid or expired verification link." }))
        .finally(() => setModal("verifyResult"));
    } else {
      setResetToken(token);
      setModal("reset");
    }
  }, []);

  const loadSavedRecipes = useCallback(async () => {
    try {
      setSavedRecipes(await api.getRecipes());
    } catch (e) {
      console.error("Failed to load saved recipes:", e);
    }
  }, []);

  useEffect(() => {
    if (user) loadSavedRecipes();
  }, [user, loadSavedRecipes]);

  const menuRecipes = savedRecipes.filter((r) => r.id != null && selectedIds.has(r.id));

  function selectTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "saved") loadSavedRecipes();
  }

  async function loadRecipe(id: string) {
    setActiveTab("scrape");
    try {
      setRecipe(await api.getRecipe(id));
      setTimeout(() => document.querySelector(".recipe")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setRecipe(null);
    }
  }

  async function deleteRecipe(id: string) {
    if (!confirm("Are you sure you want to delete this recipe?")) return;
    try {
      await api.deleteRecipe(id);
      setSelectedIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
      if (recipe?.id === id) setRecipe(null);
      await loadSavedRecipes();
    } catch (e) {
      console.error(e);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((ids) => {
      const next = new Set(ids);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function logout() {
    try {
      await api.logout();
    } catch (e) {
      console.error("Logout error:", e);
    }
    setUser(null);
    setRecipe(null);
    setSavedRecipes([]);
    setSelectedIds(new Set());
    setActiveTab("scrape");
  }

  const tab = user ? activeTab : "scrape";

  return (
    <div className="app-root">
      <div className="container">
        <header className="header">
          <div className="header-top">
            <h1>
              <i className="fa-solid fa-utensils icon-left" />
              Sous Chef
            </h1>
            <div className="auth-section">
              {user ? (
                <div className="user-info">
                  <span>
                    <i className="fa-solid fa-user icon-left" />
                    {user.username}
                  </span>
                  <button className="btn btn-small" onClick={logout}>
                    Logout
                  </button>
                </div>
              ) : (
                <div className="auth-buttons">
                  <button className="btn btn-small" onClick={() => setModal("login")}>
                    Login
                  </button>
                  <button className="btn btn-small" onClick={() => setModal("register")}>
                    Register
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {user && (
          <nav className="tabs">
            <button className={`tab-button${tab === "scrape" ? " active" : ""}`} onClick={() => selectTab("scrape")}>
              <i className="fa-solid fa-magnifying-glass icon-left" />
              Scrape Recipe
            </button>
            <button className={`tab-button${tab === "saved" ? " active" : ""}`} onClick={() => selectTab("saved")}>
              <i className="fa-solid fa-book icon-left" />
              My Recipes
            </button>
            <button className={`tab-button${tab === "menu" ? " active" : ""}`} onClick={() => selectTab("menu")}>
              <i className="fa-solid fa-clipboard-list icon-left" />
              Menu &amp; List
            </button>
          </nav>
        )}

        <AuthModals
          key={modal ?? "none"}
          modal={modal}
          setModal={(m) => {
            if (m !== "login") setOauthError(null);
            setModal(m);
          }}
          onLoggedIn={setUser}
          initialError={modal === "login" ? oauthError : null}
          resetToken={resetToken}
          verifyResult={verifyResult}
        />

        {tab === "scrape" && (
          <ScrapeTab
            recipe={recipe}
            currentUser={user}
            onRecipeLoaded={setRecipe}
            onRecipeSaved={(r) => {
              setRecipe(r);
              loadSavedRecipes();
            }}
            onShowLogin={() => setModal("login")}
          />
        )}
        {tab === "saved" && (
          <MyRecipesTab
            savedRecipes={savedRecipes}
            selectedIds={selectedIds}
            onLoadRecipe={loadRecipe}
            onDeleteRecipe={deleteRecipe}
            onCreateMenu={() => selectedIds.size > 0 && setActiveTab("menu")}
            onToggleSelection={toggleSelection}
          />
        )}
        {tab === "menu" && (
          <MenuListTab menuRecipes={menuRecipes} currentUser={user} onChangeSelection={() => selectTab("saved")} />
        )}
      </div>
    </div>
  );
}
