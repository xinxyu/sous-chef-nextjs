import type { Recipe, User } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest,
    credentials: "same-origin",
    headers: json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status);
  return data as T;
}

type Message = { message?: string };

export const api = {
  me: () => request<{ user: User | null }>("/api/auth/me"),
  login: (username: string, password: string) =>
    request<{ user: User }>("/api/auth/login", { method: "POST", json: { username, password } }),
  register: (username: string, password: string, email: string) =>
    request<Message>("/api/auth/register", { method: "POST", json: { username, password, email } }),
  logout: () => request<Message>("/api/auth/logout", { method: "POST" }),
  verifyEmail: (token: string) => request<Message>("/api/auth/verify-email", { method: "POST", json: { token } }),
  forgotPassword: (email: string) => request<Message>("/api/auth/forgot-password", { method: "POST", json: { email } }),
  resetPassword: (token: string, newPassword: string) =>
    request<Message>("/api/auth/reset-password", { method: "POST", json: { token, new_password: newPassword } }),

  scrape: (url: string) => request<Recipe>("/api/scrape", { method: "POST", json: { url } }),
  getRecipes: () => request<Recipe[]>("/api/recipes"),
  getRecipe: (id: string) => request<Recipe>(`/api/recipes/${encodeURIComponent(id)}`),
  saveRecipe: (recipe: Recipe) => request<Recipe>("/api/recipes", { method: "POST", json: recipe }),
  deleteRecipe: (id: string) => request<Message>(`/api/recipes/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

export function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}
