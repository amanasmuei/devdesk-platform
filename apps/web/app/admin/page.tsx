"use client";

import { useState } from "react";
import Link from "next/link";
import { API_URL, AdminRequest, STATUS_VALUES, statusLabel } from "../lib";

type Draft = {
  status: string;
  quote_price: string;
  quote_date: string;
  preview_url: string;
  admin_notes: string;
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

export default function AdminPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<AdminRequest[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saveState, setSaveState] = useState<Record<string, string>>({});
  const [loadErr, setLoadErr] = useState("");

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
    } catch {
      setLoadErr("Could not load requests. Please try again.");
    }
  }

  async function login() {
    if (!email.trim() || !password) {
      setErr("Enter your email and password.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || (data?.role !== "admin" && !data?.is_admin)) {
        setErr("Admin access required.");
        setBusy(false);
        return;
      }
      await loadRequests();
    } catch {
      setErr("Could not reach the server. Please try again.");
    }
    setBusy(false);
  }

  async function save(id: string | number) {
    const d = drafts[String(id)];
    if (!d) return;
    setSaveState((s) => ({ ...s, [String(id)]: "Saving…" }));
    try {
      const body: Record<string, unknown> = {
        status: d.status,
        admin_notes: d.admin_notes,
      };
      body.quote_price = d.quote_price === "" ? null : Number(d.quote_price);
      body.quote_date = d.quote_date === "" ? null : d.quote_date;
      body.preview_url = d.preview_url;
      const res = await fetch(`${API_URL}/api/admin/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSaveState((s) => ({ ...s, [String(id)]: "Saved" }));
      setRequests((rs) =>
        rs
          ? rs.map((r) =>
              String(r.id) === String(id)
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
      setTimeout(
        () =>
          setSaveState((s) => {
            const n = { ...s };
            delete n[String(id)];
            return n;
          }),
        2500
      );
    } catch {
      setSaveState((s) => ({ ...s, [String(id)]: "Save failed — retry" }));
    }
  }

  function update(id: string | number, patch: Partial<Draft>) {
    setDrafts((ds) => ({
      ...ds,
      [String(id)]: { ...ds[String(id)], ...patch },
    }));
  }

  if (!requests && !loadErr) {
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
          <h1>Admin</h1>
          <p className="panel-sub">Log in to manage incoming requests.</p>
          <label className="field">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
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
            {busy ? "Logging in…" : "Log in"}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="panel" style={{ maxWidth: 1100 }}>
      <div className="page-header">
        <Link className="wordmark" href="/">
          DevDesk
        </Link>
        <span className="badge" style={{ border: "none" }}>
          Admin
        </span>
      </div>
      <h2 style={{ textAlign: "left", marginTop: 24 }}>All requests</h2>

      {loadErr && <div className="err">{loadErr}</div>}

      {requests && requests.length === 0 && (
        <div className="empty">No requests yet.</div>
      )}

      <div className="admin-table">
        {requests?.map((r) => {
          const id = String(r.id);
          const d = drafts[id];
          if (!d) return null;
          return (
            <div className="admin-row" key={id}>
              <div>
                <div className="head">
                  <div>
                    <div className="who">{r.name}</div>
                    <div className="meta-line">{r.email}</div>
                  </div>
                  <span className={`badge ${r.status}`}>
                    {statusLabel(r.status)}
                  </span>
                </div>
                <div className="meta-line" style={{ marginTop: 6 }}>
                  {r.service}
                  {r.urgency ? ` · ${r.urgency}` : ""}
                  {r.created_at
                    ? ` · ${new Date(r.created_at).toLocaleDateString()}`
                    : ""}
                </div>
                <div className="dtl">{r.details}</div>
              </div>

              <div className="admin-edit">
                <div>
                  <label>Status</label>
                  <select
                    value={d.status}
                    onChange={(e) => update(id, { status: e.target.value })}
                  >
                    {STATUS_VALUES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Quote price (RM)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={d.quote_price}
                    onChange={(e) =>
                      update(id, { quote_price: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label>Quote date</label>
                  <input
                    type="date"
                    value={d.quote_date}
                    onChange={(e) => update(id, { quote_date: e.target.value })}
                  />
                </div>
                <div>
                  <label>Preview link</label>
                  <input
                    type="url"
                    value={d.preview_url}
                    onChange={(e) => update(id, { preview_url: e.target.value })}
                    placeholder="https://… (shown to client when delivered)"
                  />
                </div>
              </div>

              <div className="admin-actions">
                <div>
                  <label
                    style={{
                      fontSize: "0.76rem",
                      fontWeight: 600,
                      color: "var(--faint)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Admin notes
                  </label>
                  <textarea
                    value={d.admin_notes}
                    onChange={(e) =>
                      update(id, { admin_notes: e.target.value })
                    }
                  />
                </div>
                <button className="btn btn-primary" onClick={() => save(id)}>
                  Save
                </button>
                {saveState[id] && (
                  <div
                    className={`save-note ${
                      saveState[id].includes("fail") ? "err" : ""
                    }`}
                  >
                    {saveState[id]}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
