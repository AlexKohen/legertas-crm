"use client";

import { useState } from "react";

const allowedEmail = "droneai@legertas.ai";

export default function LoginPage() {
  const [email, setEmail] = useState(allowedEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setIsBusy(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      window.location.assign("/");
      return;
    }

    const data = await response.json().catch(() => ({}));
    setError(data.error || "Invalid login.");
    setIsBusy(false);
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <p className="login-kicker">Legertas.lt CRM</p>
        <h1>Sign in</h1>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" disabled={isBusy}>
          {isBusy ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <style jsx>{`
        .login-shell {
          min-height: 100svh;
          display: grid;
          place-items: center;
          padding: 24px;
          background: radial-gradient(circle at 50% 0%, rgba(57, 111, 255, 0.18), transparent 34%), #0a0a0a;
          color: #f5f5f5;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .login-card {
          width: min(100%, 380px);
          display: grid;
          gap: 16px;
          padding: 24px;
          border: 1px solid #262626;
          border-radius: 8px;
          background: #111111;
        }
        .login-kicker {
          margin: 0;
          color: #8fb3ff;
          font-weight: 800;
        }
        h1 {
          margin: 0 0 8px;
          font-size: 40px;
        }
        label {
          display: grid;
          gap: 6px;
          color: #d4d4d4;
          font-weight: 700;
        }
        input {
          min-height: 46px;
          border: 1px solid #333333;
          border-radius: 8px;
          background: #0a0a0a;
          color: #ffffff;
          padding: 0 12px;
          font: inherit;
        }
        button {
          min-height: 48px;
          border: 0;
          border-radius: 8px;
          background: #396fff;
          color: #ffffff;
          font-weight: 800;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.7;
          cursor: default;
        }
        .login-error {
          margin: 0;
          color: #ff9a9a;
        }
      `}</style>
    </main>
  );
}
