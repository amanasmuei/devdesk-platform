"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, PortalRequest, statusLabel } from "../lib";

export default function PortalPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [requests, setRequests] = useState<PortalRequest[] | null>(null);
  const [loadErr, setLoadErr] = useState("");

  // Restore an existing session (e.g. account just created on /order),
  // then poll for updates so clients see quote/status changes without
  // manually refreshing.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && !data.is_admin) {
          setLoggedIn(true);
          await loadRequests();
        }
      } catch {
        // not logged in; show the login form
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const t = setInterval(() => {
      loadRequests();
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  async function loadRequests() {
    try {
      const res = await fetch(`${API_URL}/api/portal/requests`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : data.requests ?? []);
    } catch {
      setLoadErr("Could not load your requests. Please try again.");
    }
  }

  const [mode, setMode] = useState<"login" | "register">("login");

  async function decide(id: string | number, decision: "accept" | "decline") {
    try {
      const res = await fetch(
        `${API_URL}/api/portal/requests/${id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ decision }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setLoadErr(data?.error ?? "Could not save your decision. Please try again.");
        await loadRequests(); // resync UI with the true state
        return;
      }
      setLoadErr("");
      setRequests((rs) =>
        rs
          ? rs.map((r) =>
              String(r.id) === String(id)
                ? { ...r, status: decision === "accept" ? "accepted" : "declined" }
                : r
            )
          : rs
      );
    } catch {
      setLoadErr("Could not save your decision. Please try again.");
    }
  }

  async function logout() {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore network errors on logout
    }
    setLoggedIn(false);
    setRequests(null);
  }

  async function authFetch(path: string) {
    return fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: email.trim(), password }),
    });
  }

  async function login() {
    if (!email.trim() || !password) {
      setErr("Enter your email and password.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const res = await authFetch(mode === "login" ? "/api/auth/login" : "/api/auth/register");
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.role === "admin" || data?.is_admin) {
        const msg =
          data?.role === "admin" || data?.is_admin
            ? "This is an admin account. Use the admin page."
            : mode === "register"
              ? data?.error?.includes("already exists")
                ? "An account with this email already exists. Log in instead."
                : "Could not create the account. Try again."
              : "Login failed. Check your email and password.";
        setErr(msg);
        setBusy(false);
        return;
      }
      setLoggedIn(true);
      await loadRequests();
    } catch {
      setErr("Could not reach the server. Please try again.");
    }
    setBusy(false);
  }

  if (!loggedIn) {
    return (
      <main className="panel">
        <nav className="nav">
          <div className="nav-inner">
            <Link className="wordmark" href="/">
              DevDesk
            </Link>
            <Link className="btn btn-ghost" href="/">
              Back to site
            </Link>
          </div>
        </nav>
        <div className="panel-card" style={{ marginTop: 56 }}>
          <h1>Client portal</h1>
          <p className="panel-sub">
            Log in to see the status of your requests and quotes.
          </p>
          <label className="field">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="field">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </label>
          <div className="err">{err}</div>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            onClick={login}
            disabled={busy}
          >
            {busy
              ? mode === "login"
                ? "Logging in…"
                : "Creating account…"
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </button>
          <button
            className="btn btn-ghost"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setErr("");
            }}
          >
            {mode === "login"
              ? "New here? Create an account"
              : "Already have an account? Log in"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="panel">
      <div className="page-header">
        <Link className="wordmark" href="/">
          DevDesk
        </Link>
        <button className="logout-btn" onClick={logout}>
          Log out
        </button>
      </div>
      <h2 style={{ textAlign: "left", marginTop: 24 }}>Your requests</h2>

      {loadErr && <div className="err">{loadErr}</div>}
      {!requests && !loadErr && <div className="loading">Loading…</div>}

      {requests && requests.length === 0 && (
        <div className="empty">
          No requests yet. <Link href="/order">Start one</Link>.
        </div>
      )}

      {requests && requests.length > 0 && (
        <div className="req-list">
          {requests.map((r) => (
            <div className="req-row" key={String(r.id)}>
              <div>
                <div className="svc">{r.service}</div>
                {r.created_at && (
                  <div className="dt">
                    Submitted {new Date(r.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="dtl">{r.details}</div>
              <div>
                <span className={`badge ${r.status}`}>{statusLabel(r.status)}</span>
              </div>
              <div>
                {r.quote_price != null && (
                  <div className="quote-price">RM {r.quote_price}</div>
                )}
                {r.quote_date && (
                  <div className="dt">
                    Quote date {new Date(r.quote_date).toLocaleDateString()}
                  </div>
                )}
                {r.quote_price == null && !r.quote_date && (
                  <div className="dt">Quote pending</div>
                )}
                {r.preview_url && (
                  <a
                    className="preview-link"
                    href={r.preview_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View the work
                  </a>
                )}
                {(r.status === "quoted" || r.status === "submitted") && (
                  <div className="decision" style={{ marginTop: 10 }}>
                    {r.status === "quoted" && (
                      <button
                        className="btn btn-primary"
                        onClick={() => decide(r.id, "accept")}
                      >
                        Accept quote
                      </button>
                    )}
                    <button
                      className="btn btn-ghost"
                      onClick={() => decide(r.id, "decline")}
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
