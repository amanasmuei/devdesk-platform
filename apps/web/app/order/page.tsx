"use client";

import { useState } from "react";
import Link from "next/link";
import { API_URL } from "../lib";

const SERVICE_CHOICES = [
  {
    val: "Bug fix / debugging",
    label: "Bug fix / debugging",
    small: "Something is broken and needs to work",
  },
  {
    val: "Website / landing page",
    label: "Website / landing page",
    small: "A page or small site, built from scratch",
  },
  {
    val: "Script / automation",
    label: "Script / automation",
    small: "Automate a repetitive task",
  },
  {
    val: "Assignment / tutoring",
    label: "Assignment / tutoring",
    small: "Coursework help, with explanations",
  },
  {
    val: "Something else",
    label: "Something else",
    small: "I'll describe it myself",
  },
];

const URGENCY_CHOICES = [
  { val: "ASAP — within days", label: "ASAP", small: "Within the next few days" },
  {
    val: "Within 1–2 weeks",
    label: "Within 1–2 weeks",
    small: "Soon, but not urgent",
  },
  { val: "Flexible", label: "Flexible", small: "No rush — quality first" },
];

const TOTAL = 4;

export default function OrderPage() {
  const [step, setStep] = useState(0);
  const [service, setService] = useState("");
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [accountState, setAccountState] = useState<
    "idle" | "creating" | "created" | "exists" | "skip" | "error"
  >("idle");
  const [accountErr, setAccountErr] = useState("");

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function submit() {
    if (!name.trim()) {
      setErr("Please tell us your name.");
      return;
    }
    if (!emailOk) {
      setErr("That email doesn't look right.");
      return;
    }
    setErr("");
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          service,
          urgency,
          details,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDone(true);
    } catch {
      setErr(
        "Something went wrong sending your request. Please try again, or email us directly at amanasmuei@gmail.com."
      );
      setSending(false);
    }
  }

  async function createAccount() {
    if (password.length < 8) {
      setAccountErr("Password must be at least 8 characters.");
      return;
    }
    setAccountErr("");
    setAccountState("creating");
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.status === 409) {
        setAccountState("exists");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setAccountState("created");
    } catch {
      setAccountState("error");
      setAccountErr("Could not create the account. You can retry or use the portal later.");
    }
  }

  if (done) {
    return (
      <main className="wrap" style={{ paddingTop: 72, paddingBottom: 96 }}>
        <div className="wizard-shell">
          <div className="success">
            <div className="ring">&#10003;</div>
            <h3>Request sent, {name.trim().split(" ")[0]}</h3>
            <p>
              Check your inbox within 24 hours for your fixed quote.
              <br />
              Sit tight — you&apos;ve done your part.
            </p>
          </div>

          {accountState === "idle" && (
            <div className="post-submit" style={{ marginTop: 28 }}>
              <div className="q" style={{ fontSize: "1.05rem" }}>
                Track this request live in the client portal
              </div>
              <div className="qhelp" style={{ marginBottom: 12 }}>
                Set a password for {email.trim()} to see your quote, accept
                or decline it, and follow progress — all in writing.
              </div>
              <label className="field">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a password (8+ characters)"
                />
              </label>
              <div className="err">{accountErr}</div>
              <div className="wizard-actions">
                <button
                  className="wbtn wbtn-next"
                  onClick={createAccount}
                >
                  Create password
                </button>
                <button
                  className="wbtn"
                  onClick={() => setAccountState("skip")}
                >
                  No thanks
                </button>
              </div>
            </div>
          )}

          {accountState === "creating" && (
            <div className="post-submit" style={{ marginTop: 24 }}>
              <div className="qhelp">Creating your account…</div>
            </div>
          )}

          {accountState === "created" && (
            <div className="post-submit" style={{ marginTop: 24 }}>
              <p style={{ marginBottom: 12 }}>
                Account created. Your request is already linked.
              </p>
              <Link className="btn btn-primary" href="/portal">
                Go to your portal
              </Link>
            </div>
          )}

          {(accountState === "exists" || accountState === "skip") && (
            <div className="post-submit" style={{ marginTop: 24 }}>
              {accountState === "exists" ? (
                <p style={{ marginBottom: 12 }}>
                  An account with this email already exists — log in to see
                  this request.
                </p>
              ) : (
                <p style={{ marginBottom: 12 }}>
                  No problem — your quote will arrive by email. You can
                  create a portal account any time.
                </p>
              )}
              <Link className="btn btn-ghost" href="/portal">
                Client portal
              </Link>
            </div>
          )}

          {accountState === "error" && (
            <div className="post-submit" style={{ marginTop: 24 }}>
              <div className="err">{accountErr}</div>
              <div className="wizard-actions" style={{ marginTop: 10 }}>
                <button className="wbtn wbtn-next" onClick={createAccount}>
                  Retry
                </button>
                <button className="wbtn" onClick={() => setAccountState("skip")}>
                  Skip for now
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="wrap" style={{ paddingTop: 72, paddingBottom: 96 }}>
      <nav className="nav" style={{ marginBottom: 40 }}>
        <div className="nav-inner">
          <Link className="wordmark" href="/">
            DevDesk
          </Link>
          <Link className="btn btn-ghost" href="/">
            Back to site
          </Link>
        </div>
      </nav>

      <div className="section-sub" style={{ marginBottom: 40, marginTop: 0 }}>
        Takes about 60 seconds. Your quote arrives by email within 24 hours.
      </div>

      <div className="wizard-shell">
        <div className="progress">
          <div
            className="bar"
            style={{ width: `${(step / TOTAL) * 100}%` }}
          ></div>
        </div>

        {step === 0 && (
          <div>
            <div className="step-label">Step 1 of 4</div>
            <div className="q">What do you need help with?</div>
            <div className="qhelp">
              Pick the closest match — details come next.
            </div>
            <div className="choices">
              {SERVICE_CHOICES.map((c) => (
                <button
                  className="choice"
                  key={c.val}
                  onClick={() => {
                    setService(c.val);
                    setStep(1);
                  }}
                >
                  <span>
                    {c.label}
                    <small>{c.small}</small>
                  </span>
                  <span>&rarr;</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="step-label">Step 2 of 4</div>
            <div className="q">Tell us what&apos;s going on.</div>
            <div className="qhelp">
              Plain words are perfect. Paste error messages if you have them.
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. My Python script crashes with a KeyError after a few minutes. It worked before. I need it fixed by Friday."
            />
            <div className="err">{err}</div>
            <div className="wizard-actions">
              <button className="wbtn" onClick={() => setStep(0)}>
                Back
              </button>
              <button
                className="wbtn wbtn-next"
                onClick={() => {
                  if (details.trim().length < 10) {
                    setErr("A sentence or two is all we need.");
                    return;
                  }
                  setErr("");
                  setStep(2);
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="step-label">Step 3 of 4</div>
            <div className="q">When do you need it?</div>
            <div className="qhelp">Honest answers get honest schedules.</div>
            <div className="choices">
              {URGENCY_CHOICES.map((c) => (
                <button
                  className="choice"
                  key={c.val}
                  onClick={() => {
                    setUrgency(c.val);
                    setStep(3);
                  }}
                >
                  <span>
                    {c.label}
                    <small>{c.small}</small>
                  </span>
                  <span>&rarr;</span>
                </button>
              ))}
            </div>
            <div className="wizard-actions">
              <button className="wbtn" onClick={() => setStep(1)}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="step-label">Step 4 of 4</div>
            <div className="q">Where should we send your quote?</div>
            <div className="qhelp">
              No spam, no newsletter — just your quote.
            </div>
            <label className="field">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <label className="field">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <div className="err">{err}</div>
            <div className="wizard-actions">
              <button className="wbtn" onClick={() => setStep(2)}>
                Back
              </button>
              <button
                className="wbtn wbtn-next"
                onClick={submit}
                disabled={sending}
              >
                {sending ? "Sending…" : "Get my free quote"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
