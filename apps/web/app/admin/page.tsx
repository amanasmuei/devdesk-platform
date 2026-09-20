"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, AdminRequest, NEXT_STATUS, statusLabel } from "../lib";
import {
  AuthForm,
  Button,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingState,
  PageShell,
  StatusBadge,
} from "../components";

type Draft = {
  status: string;
  quote_price: string;
  quote_date: string;
  preview_url: string;
  admin_notes: string;
};

type SaveState = {
  kind: "saving" | "saved" | "error";
  message: string;
};

function toDraft(r: AdminRequest): Draft {
  return {
    status: r.status ?? "submitted",
    quote_price: r.quote_price != null ? String(r.quote_price) : "",
    quote_date: r.quote_date ? r.quote_date.slice(0, 10) : "",
    preview_url: r.preview_url ?? "",
    admin_notes: r.admin_notes ?? "",
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-MY", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [requests, setRequests] = useState<AdminRequest[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [loadErr, setLoadErr] = useState("");
  // False until the /api/auth/me session probe finishes; avoids flashing
  // the login form for an already-signed-in admin.
  const [booted, setBooted] = useState(false);

  // Restore an existing admin session on page load / refresh.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.is_admin) {
            setLoggedIn(true);
            await loadRequests();
          }
        }
      } catch {
        // not logged in; show the login form
      } finally {
        setBooted(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRequests() {
    try {
      const res = await fetch(`${API_URL}/api/admin/requests`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const list: AdminRequest[] = Array.isArray(data)
        ? data
        : data.requests ?? [];
      setRequests(list);
      const d: Record<string, Draft> = {};
      for (const r of list) d[String(r.id)] = toDraft(r);
      setDrafts(d);
      setLoadErr("");
    } catch {
      setLoadErr("Could not load requests. Please try again.");
    }
  }

  async function handleAuth(input: {
    email: string;
    password: string;
  }): Promise<string | null> {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: input.email, password: input.password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return data?.error ?? "Login failed. Check your email and password.";
    }
    if (!data?.is_admin) {
      return "Admin access required.";
    }
    setLoggedIn(true);
    await loadRequests();
    return null;
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
    setDrafts({});
    setSaveState({});
    setLoadErr("");
  }

  async function save(id: string | number) {
    const key = String(id);
    const d = drafts[key];
    if (!d) return;
    setSaveState((s) => ({
      ...s,
      [key]: { kind: "saving", message: "Saving…" },
    }));
    try {
      const body: Record<string, unknown> = {
        status: d.status,
        admin_notes: d.admin_notes,
      };
      body.quote_price = d.quote_price === "" ? null : Number(d.quote_price);
      body.quote_date = d.quote_date === "" ? null : d.quote_date;
      body.preview_url = d.preview_url === "" ? null : d.preview_url;
      const res = await fetch(`${API_URL}/api/admin/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? `Save failed (${res.status})`);
      }
      setSaveState((s) => ({
        ...s,
        [key]: { kind: "saved", message: "Saved" },
      }));
      setRequests((rs) =>
        rs
          ? rs.map((r) =>
              String(r.id) === key
                ? {
                    ...r,
                    status: d.status,
                    quote_price:
                      d.quote_price === "" ? null : Number(d.quote_price),
                    quote_date: d.quote_date === "" ? null : d.quote_date,
                    admin_notes: d.admin_notes,
                  }
                : r
            )
          : rs
      );
      setTimeout(() => {
        setSaveState((s) => {
          const n = { ...s };
          delete n[key];
          return n;
        });
      }, 2500);
    } catch (e) {
      setSaveState((s) => ({
        ...s,
        [key]: {
          kind: "error",
          message:
            (e instanceof Error && e.message) || "Save failed — retry",
        },
      }));
    }
  }

  function update(id: string | number, patch: Partial<Draft>) {
    setDrafts((ds) => ({
      ...ds,
      [String(id)]: { ...ds[String(id)], ...patch },
    }));
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
            title="Admin"
            subtitle="Log in to manage incoming requests."
            allowRegister={false}
            onSubmit={handleAuth}
          />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell wide>
      <div className="page-header">
        <Link className="wordmark" href="/">
          DevDesk
        </Link>
        <div className="page-header-actions">
          <span className="badge badge-role">Admin</span>
          <Button variant="ghost" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>
      <h1 className="page-title">All requests</h1>

      {loadErr && <ErrorBanner>{loadErr}</ErrorBanner>}

      {requests && requests.length === 0 && (
        <EmptyState>No requests yet.</EmptyState>
      )}

      <div className="admin-table">
        {requests?.map((r) => {
          const id = String(r.id);
          const d = drafts[id];
          if (!d) return null;
          const saving = saveState[id]?.kind === "saving";
          const note = saveState[id];
          const isTerminal = !NEXT_STATUS[r.status];
          return (
            <div className="admin-row" key={id}>
              <div>
                <div className="head">
                  <div>
                    <div className="who">{r.name}</div>
                    <div className="meta-line">{r.email}</div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="meta-line">
                  {r.service}
                  {r.urgency ? ` · ${r.urgency}` : ""}
                  {r.created_at ? ` · ${formatDate(r.created_at)}` : ""}
                </div>
                <div className="dtl">{r.details}</div>
              </div>

              <div className="admin-edit">
                {isTerminal ? (
                  <div className="status-static">
                    <span className="status-static-label">Status</span>
                    <StatusBadge status={r.status} />
                  </div>
                ) : (
                  <Field id={`admin-status-${id}`} label="Status">
                    {(fid, props) => (
                      <select
                        {...props}
                        id={fid}
                        value={d.status}
                        onChange={(e) =>
                          update(id, { status: e.target.value })
                        }
                      >
                        {/* Current status plus the one legal next step; the
                            API rejects anything else with a 409. */}
                        {[r.status, NEXT_STATUS[r.status]]
                          .filter(Boolean)
                          .map((s) => (
                            <option key={s} value={s}>
                              {statusLabel(s)}
                              {s !== r.status ? " (next step)" : ""}
                            </option>
                          ))}
                      </select>
                    )}
                  </Field>
                )}
                <Field id={`admin-price-${id}`} label="Quote price (RM)">
                  {(fid, props) => (
                    <input
                      {...props}
                      id={fid}
                      type="number"
                      min="0"
                      step="0.01"
                      value={d.quote_price}
                      onChange={(e) =>
                        update(id, { quote_price: e.target.value })
                      }
                    />
                  )}
                </Field>
                <Field id={`admin-date-${id}`} label="Quote date">
                  {(fid, props) => (
                    <input
                      {...props}
                      id={fid}
                      type="date"
                      value={d.quote_date}
                      onChange={(e) =>
                        update(id, { quote_date: e.target.value })
                      }
                    />
                  )}
                </Field>
                <Field id={`admin-preview-${id}`} label="Preview link">
                  {(fid, props) => (
                    <input
                      {...props}
                      id={fid}
                      type="url"
                      value={d.preview_url}
                      onChange={(e) =>
                        update(id, { preview_url: e.target.value })
                      }
                      placeholder="https://… (shown to client when delivered)"
                    />
                  )}
                </Field>
              </div>

              <div className="admin-actions">
                <Field id={`admin-notes-${id}`} label="Admin notes">
                  {(fid, props) => (
                    <textarea
                      {...props}
                      id={fid}
                      value={d.admin_notes}
                      onChange={(e) =>
                        update(id, { admin_notes: e.target.value })
                      }
                    />
                  )}
                </Field>
                <Button
                  variant="primary"
                  loading={saving}
                  disabled={saving}
                  onClick={() => save(id)}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
                {note && (
                  <div
                    className={`save-note ${note.kind === "error" ? "err" : ""}`}
                    role={note.kind === "error" ? "alert" : "status"}
                    aria-live="polite"
                  >
                    {note.message}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}
