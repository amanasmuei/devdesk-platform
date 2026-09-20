"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, PortalRequest } from "../lib";
import {
  AuthForm,
  Button,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PageShell,
  StatusBadge,
} from "../components";

const currency = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
});

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PortalPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [requests, setRequests] = useState<PortalRequest[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [deciding, setDeciding] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  // Restore an existing session (e.g. account just created on /order),
  // then poll for updates so clients see quote/status changes without
  // manually refreshing. `booted` gates rendering so an authenticated
  // client never sees a flash of the login form.
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
      } finally {
        setBooted(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loggedIn) return;
    const t = setInterval(() => {
      void loadRequests();
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
      setLoadErr("");
    } catch {
      setLoadErr("Could not load your requests. Please try again.");
    }
  }

  async function decide(id: string | number, decision: "accept" | "decline") {
    const key = String(id);
    setDeciding(key);
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
        // Resync the true state first, then surface the decision error so
        // a successful resync does not wipe the message.
        await loadRequests();
        setLoadErr(
          data?.error ?? "Could not save your decision. Please try again."
        );
        return;
      }
      setLoadErr("");
      setRequests((rs) =>
        rs
          ? rs.map((r) =>
              String(r.id) === key
                ? {
                    ...r,
                    status:
                      decision === "accept" ? "accepted" : "declined",
                  }
                : r
            )
          : rs
      );
    } catch {
      setLoadErr("Could not save your decision. Please try again.");
    } finally {
      setDeciding(null);
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
    setLoadErr("");
  }

  async function handleAuth(input: {
    email: string;
    password: string;
    mode: "login" | "register";
  }): Promise<string | null> {
    const res = await fetch(
      `${API_URL}${
        input.mode === "login" ? "/api/auth/login" : "/api/auth/register"
      }`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: input.email, password: input.password }),
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || data?.role === "admin" || data?.is_admin) {
      return data?.role === "admin" || data?.is_admin
        ? "This is an admin account. Use the admin page."
        : input.mode === "register"
          ? data?.error?.includes("already exists")
            ? "An account with this email already exists. Log in instead."
            : "Could not create the account. Try again."
          : "Login failed. Check your email and password.";
    }
    setLoggedIn(true);
    await loadRequests();
    return null;
  }

  if (!booted) {
    return (
      <PageShell>
        <LoadingState />
      </PageShell>
    );
  }

  if (!loggedIn) {
    return (
      <PageShell>
        <nav className="nav">
          <div className="nav-inner">
            <Link className="wordmark" href="/">
              DevDesk
            </Link>
            <Button variant="ghost" href="/">
              Back to site
            </Button>
          </div>
        </nav>
        <div className="panel-card panel-card--auth">
          <AuthForm
            title="Client portal"
            subtitle="Log in to see the status of your requests and quotes."
            onSubmit={handleAuth}
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="page-header">
        <Link className="wordmark" href="/">
          DevDesk
        </Link>
        <Button variant="ghost" size="sm" onClick={logout}>
          Log out
        </Button>
      </div>
      <h1 className="page-title">Your requests</h1>

      {loadErr && <ErrorBanner>{loadErr}</ErrorBanner>}
      {!requests && !loadErr && <LoadingState />}

      {requests && requests.length === 0 && (
        <EmptyState>
          No requests yet.{" "}
          <Link className="link" href="/order">
            Start one
          </Link>
          .
        </EmptyState>
      )}

      {requests && requests.length > 0 && (
        <div className="req-list" aria-live="polite">
          {requests.map((r) => {
            const key = String(r.id);
            const inFlight = deciding === key;
            return (
              <div className="req-row" key={key}>
                <div>
                  <div className="svc">{r.service}</div>
                  {r.created_at && (
                    <div className="dt">
                      Submitted {formatDate(r.created_at)}
                    </div>
                  )}
                </div>
                <div className="dtl">{r.details}</div>
                <div>
                  <StatusBadge status={r.status} />
                </div>
                <div>
                  {r.quote_price != null && (
                    <div className="quote-price">
                      {currency.format(r.quote_price)}
                    </div>
                  )}
                  {r.quote_date && (
                    <div className="dt">
                      Quote date {formatDate(r.quote_date)}
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
                    <div className="decision">
                      {r.status === "quoted" && (
                        <Button
                          variant="primary"
                          loading={inFlight}
                          disabled={inFlight}
                          onClick={() => decide(r.id, "accept")}
                        >
                          {inFlight ? "Saving…" : "Accept quote"}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        loading={inFlight}
                        disabled={inFlight}
                        onClick={() => decide(r.id, "decline")}
                      >
                        {inFlight ? "Saving…" : "Decline"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
