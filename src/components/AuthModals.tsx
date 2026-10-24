"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { api, errorMessage } from "@/lib/api";
import type { User } from "@/lib/types";

export type AuthModal = "login" | "register" | "forgot" | "reset" | "verifyResult" | null;

interface Props {
  modal: AuthModal;
  setModal: (m: AuthModal) => void;
  onLoggedIn: (user: User) => void;
  /** Message shown when the login dialog opens (e.g. an OAuth error). */
  initialError?: string | null;
  resetToken?: string;
  verifyResult?: { ok: boolean; message: string } | null;
}

function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function GoogleButton() {
  return (
    <a className="btn btn-google" href="/api/auth/google" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
      <i className="fa-brands fa-google icon-left" />
      Continue with Google
    </a>
  );
}

export default function AuthModals({ modal, setModal, onLoggedIn, initialError, resetToken, verifyResult }: Props) {
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState({ username: "", password: "", email: "", confirm: "" });

  const field = (name: keyof typeof fields) => ({
    name,
    value: fields[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [name]: e.target.value })),
  });

  function open(m: AuthModal) {
    setError(null);
    setSuccess(null);
    setFields({ username: "", password: "", email: "", confirm: "" });
    setModal(m);
  }

  /** Runs an auth request with shared loading/error state. */
  async function run(e: FormEvent, fallback: string, fn: () => Promise<void>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err, fallback));
    } finally {
      setLoading(false);
    }
  }

  const close = () => open(null);
  const errorEl = error && <div className="error">{error}</div>;
  const successEl = success && <div className="success">{success}</div>;

  switch (modal) {
    case "login":
      return (
        <Modal onClose={close}>
          <h2>Login</h2>
          <form
            onSubmit={(e) =>
              run(e, "Login failed", async () => {
                const { user } = await api.login(fields.username, fields.password);
                onLoggedIn(user);
                close();
              })
            }
          >
            <GoogleButton />
            <div className="auth-divider">
              <span>or</span>
            </div>
            <input type="text" placeholder="Username" autoComplete="username" required {...field("username")} />
            <input type="password" placeholder="Password" autoComplete="current-password" required {...field("password")} />
            <button type="button" className="forgot-link" onClick={() => open("forgot")}>
              Forgot password?
            </button>
            {errorEl}
            {successEl}
            <div className="modal-actions">
              <button type="submit" className="btn" disabled={loading}>
                Login
              </button>
              <button type="button" className="btn btn-secondary" onClick={close}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      );

    case "register":
      return (
        <Modal onClose={close}>
          {success ? (
            <div className="register-success">
              <h2>Check your email</h2>
              <p className="register-success-message">{success}</p>
              <button type="button" className="btn" onClick={close}>
                Close
              </button>
            </div>
          ) : (
            <>
              <h2>Register</h2>
              <GoogleButton />
              <div className="auth-divider">
                <span>or</span>
              </div>
              <form
                onSubmit={(e) =>
                  run(e, "Registration failed", async () => {
                    await api.register(fields.username, fields.password, fields.email);
                    setSuccess(`We've sent a verification link to ${fields.email}. Please check your inbox to verify your account.`);
                  })
                }
              >
                <input type="text" placeholder="Username" autoComplete="username" required minLength={3} {...field("username")} />
                <input type="email" placeholder="Email (required)" autoComplete="email" required {...field("email")} />
                <input type="password" placeholder="Password" autoComplete="new-password" required minLength={6} {...field("password")} />
                {errorEl}
                <div className="modal-actions">
                  <button type="submit" className="btn" disabled={loading}>
                    Register
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={close}>
                    Cancel
                  </button>
                </div>
              </form>
            </>
          )}
        </Modal>
      );

    case "forgot":
      return (
        <Modal onClose={close}>
          <h2>Forgot password</h2>
          <p className="modal-hint">Enter your email and we&apos;ll send you a link to reset your password.</p>
          <form
            onSubmit={(e) =>
              run(e, "Request failed", async () => {
                const res = await api.forgotPassword(fields.email.trim());
                setSuccess(res.message || "If an account exists with this email, you will receive a reset link.");
              })
            }
          >
            <input type="email" placeholder="Email" autoComplete="email" required {...field("email")} />
            {errorEl}
            {successEl}
            <div className="modal-actions">
              <button type="submit" className="btn" disabled={loading}>
                Send reset link
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => open("login")}>
                Back to login
              </button>
            </div>
          </form>
        </Modal>
      );

    case "reset":
      return (
        <Modal onClose={close}>
          <h2>Reset password</h2>
          <form
            onSubmit={(e) =>
              run(e, "Failed to reset password", async () => {
                if (fields.password.length < 6) throw new Error("Password must be at least 6 characters.");
                if (fields.password !== fields.confirm) throw new Error("Passwords do not match.");
                if (!resetToken) throw new Error("Invalid or missing reset link.");
                const res = await api.resetPassword(resetToken, fields.password);
                setSuccess(res.message || "Password updated. You can now log in.");
                setTimeout(() => open("login"), 2500);
              })
            }
          >
            <input type="password" placeholder="New password" autoComplete="new-password" required minLength={6} {...field("password")} />
            <input type="password" placeholder="Confirm new password" autoComplete="new-password" required minLength={6} {...field("confirm")} />
            {errorEl}
            {successEl}
            <div className="modal-actions">
              <button type="submit" className="btn" disabled={loading}>
                Update password
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => open("login")}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      );

    case "verifyResult":
      return (
        <Modal onClose={() => open("login")}>
          <h2>{verifyResult?.ok ? "Email verified" : "Verification failed"}</h2>
          <p className={`modal-hint${verifyResult?.ok ? "" : " error"}`}>{verifyResult?.message}</p>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => open("login")}>
              Log in
            </button>
          </div>
        </Modal>
      );

    default:
      return null;
  }
}
