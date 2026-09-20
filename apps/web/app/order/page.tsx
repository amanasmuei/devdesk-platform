"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { API_URL } from "../lib";
import {
  AuthForm,
  Button,
  ErrorBanner,
  Field,
  LoadingState,
  PageShell,
  ProgressSteps,
} from "../components";

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

// Three questions (service, details, urgency) plus the review rung.
const TOTAL = 4;

// POST /api/requests still requires name and email (the API is unchanged),
// so both are derived from the logged-in session instead of being asked.
// "sara.k@example.com" -> "Sara K"; fall back to "Client" if unusable.
function nameFromEmail(email: string): string {
  const local = email.trim().split("@")[0] ?? "";
  const name = local
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim();
  return name || "Client";
}

export default function OrderPage() {
  // Booted gate: restore any existing session before rendering so an
  // authenticated visitor never sees a flash of the auth screen.
  const [booted, setBooted] = useState(false);
  const [view, setView] = useState<"auth" | "wizard">("auth");
  const [sessionEmail, setSessionEmail] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  const [step, setStep] = useState(0);
  const [service, setService] = useState("");
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState("");
  const [detailsErr, setDetailsErr] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.email && !data.is_admin) {
            setSessionEmail(String(data.email));
            setView("wizard");
          }
        }
      } catch {
        // not logged in; show the auth screen
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  async function handleAuth(input: {
    email: string;
    password: string;
    mode: "login" | "register";
  }): Promise<string | null> {
    try {
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
      if (!res.ok) {
        if (
          input.mode === "register" &&
          typeof data?.error === "string" &&
          data.error.includes("already exists")
        ) {
          return "An account with this email already exists. Log in instead.";
        }
        return input.mode === "login"
          ? "Login failed. Check your email and password."
          : "Could not create the account. Try again.";
      }
      if (data?.role === "admin" || data?.is_admin) {
        return "This is an admin account. Use the admin page.";
      }
    } catch {
      return "Could not reach the server. Please try again.";
    }

    // Session cookie is set; confirm it and read the canonical email —
    // the submit body derives name and email from the session.
    try {
      const me = await fetch(`${API_URL}/api/auth/me`, {
        credentials: "include",
      });
      if (me.ok) {
        const who = await me.json();
        if (who?.email && !who.is_admin) {
          setSessionEmail(String(who.email));
          setSessionExpired(false);
          setView("wizard");
          return null;
        }
      }
    } catch {
      // fall through to the message below
    }
    return "Signed in, but the session could not be confirmed. Please try again.";
  }

  async function submit() {
    setSubmitErr("");
    setSending(true);
    try {
      // Re-validate the session before sending: the submit endpoint itself
      // is public, so an expired cookie must be caught here (401) and lead
      // back to the auth screen rather than to an anonymous submission.
      // Everything the visitor typed stays in state either way.
      let email = sessionEmail;
      try {
        const me = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        if (me.status === 401) {
          setSessionExpired(true);
          setSending(false);
          return;
        }
        if (me.ok) {
          const who = await me.json();
          if (who?.email && !who.is_admin) {
            email = String(who.email);
            setSessionEmail(email);
          }
        }
      } catch {
        // could not double-check; still attempt the submit below
      }

      const res = await fetch(`${API_URL}/api/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: nameFromEmail(email),
          email,
          service,
          urgency,
          details,
        }),
      });
      if (res.status === 401) {
        setSessionExpired(true);
        setSending(false);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setDone(true);
    } catch {
      setSubmitErr(
        "Something went wrong sending your request. Please try again, or email us directly at amanasmuei@gmail.com."
      );
      setSending(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 1) {
      if (details.trim().length < 10) {
        setDetailsErr("A sentence or two is all we need.");
        return;
      }
      setDetailsErr("");
      setStep(2);
      return;
    }
    if (step === 3) {
      void submit();
    }
  }

  if (!booted) {
    return (
      <PageShell variant="wrap">
        <LoadingState>Checking your session…</LoadingState>
      </PageShell>
    );
  }

  const firstName = nameFromEmail(sessionEmail).split(" ")[0] ?? "there";

  if (done) {
    return (
      <PageShell variant="wrap">
        <div className="wizard-shell">
          <div className="success">
            <div className="ring" aria-hidden="true">&#10003;</div>
            <h1>Request sent, {firstName}</h1>
            <p>
              Check your inbox within 24 hours for your fixed quote.
              <br />
              You can also follow it live in your portal.
            </p>
          </div>

          <div className="post-submit">
            <Button variant="primary" href="/portal" fullWidth>
              Go to your portal
            </Button>
          </div>

          <p className="back-link">
            <Link className="link" href="/">
              Back to site
            </Link>
          </p>
        </div>
      </PageShell>
    );
  }

  if (view === "auth") {
    return (
      <PageShell variant="wrap">
        <nav className="nav nav-page">
          <div className="nav-inner">
            <Link className="wordmark" href="/">
              DevDesk
            </Link>
            <Button variant="ghost" href="/">
              Back to site
            </Button>
          </div>
        </nav>

        <div className="order-auth">
          {sessionExpired && (
            <div className="notice" role="status">
              Your session expired while you were writing. Sign in again —
              everything you entered is saved and ready to send.
            </div>
          )}
          <div className="panel-card">
            <AuthForm
              title="Start your request"
              subtitle="Log in or create a free account first — the request itself takes about a minute."
              onSubmit={handleAuth}
            />
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell variant="wrap">
      <nav className="nav nav-page">
        <div className="nav-inner">
          <Link className="wordmark" href="/">
            DevDesk
          </Link>
          <Button variant="ghost" href="/">
            Back to site
          </Button>
        </div>
      </nav>

      <p className="wizard-intro">
        Takes about 60 seconds. Your quote arrives by email within 24 hours.
      </p>

      <div className="wizard-shell">
        <ProgressSteps step={step} total={TOTAL} />

        <form onSubmit={handleSubmit} noValidate>
          {step === 0 && (
            <div>
              <div className="step-label">Step 1 of 3</div>
              <h1 className="q">What do you need help with?</h1>
              <div className="qhelp">
                Pick the closest match — details come next.
              </div>
              <div className="choices">
                {SERVICE_CHOICES.map((c) => (
                  <button
                    type="button"
                    className="choice"
                    key={c.val}
                    aria-selected={service === c.val}
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
              <div className="step-label">Step 2 of 3</div>
              <h1 className="q">Tell us what&apos;s going on.</h1>
              <Field
                id="details"
                label="Describe the problem"
                hint="Plain words are perfect. Paste error messages if you have them."
                error={detailsErr}
              >
                {(id, props) => (
                  <textarea
                    {...props}
                    id={id}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="e.g. My Python script crashes with a KeyError after a few minutes. It worked before. I need it fixed by Friday."
                  />
                )}
              </Field>
              <div className="wizard-actions">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(0)}
                >
                  Back
                </Button>
                <Button type="submit" variant="primary">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="step-label">Step 3 of 3</div>
              <h1 className="q">When do you need it?</h1>
              <div className="qhelp">Honest answers get honest schedules.</div>
              <div className="choices">
                {URGENCY_CHOICES.map((c) => (
                  <button
                    type="button"
                    className="choice"
                    key={c.val}
                    aria-selected={urgency === c.val}
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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(1)}
                >
                  Back
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="step-label">Review and send</div>
              <h1 className="q">One last look before we send it.</h1>
              <div className="qhelp">
                We&apos;ll send your fixed quote to{" "}
                <b>{sessionEmail}</b> — the email on your account.
              </div>

              <div className="review">
                <div className="review-row">
                  <span className="review-key">Service</span>
                  <span className="review-val">{service}</span>
                </div>
                <div className="review-row">
                  <span className="review-key">Details</span>
                  <span className="review-val">{details}</span>
                </div>
                <div className="review-row">
                  <span className="review-key">Timing</span>
                  <span className="review-val">{urgency}</span>
                </div>
                <div className="review-row">
                  <span className="review-key">Quote to</span>
                  <span className="review-val">{sessionEmail}</span>
                </div>
              </div>

              {sessionExpired ? (
                <>
                  <div className="notice" role="alert">
                    Your session expired, so we couldn&apos;t send your request
                    yet. Sign in again — your answers are saved and nothing
                    needs to be re-entered.
                  </div>
                  <div className="wizard-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(2)}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setView("auth")}
                    >
                      Sign in again
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {submitErr && <ErrorBanner>{submitErr}</ErrorBanner>}

                  <div className="wizard-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(2)}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={sending}
                      disabled={sending}
                    >
                      {sending ? "Sending…" : "Get my free quote"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </form>
      </div>
    </PageShell>
  );
}
