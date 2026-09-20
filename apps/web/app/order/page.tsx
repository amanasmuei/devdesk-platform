"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { API_URL } from "../lib";
import {
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

const TOTAL = 4;

export default function OrderPage() {
  const [step, setStep] = useState(0);
  const [service, setService] = useState("");
  const [details, setDetails] = useState("");
  const [urgency, setUrgency] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [detailsErr, setDetailsErr] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [accountState, setAccountState] = useState<
    "idle" | "creating" | "created" | "exists" | "skip" | "error"
  >("idle");
  const [accountErr, setAccountErr] = useState("");

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function submit() {
    const nameTrimmed = name.trim();
    const emailTrimmed = email.trim();
    let valid = true;

    if (!nameTrimmed) {
      setNameErr("Please tell us your name.");
      valid = false;
    } else {
      setNameErr("");
    }
    if (!emailOk) {
      setEmailErr("That email doesn't look right.");
      valid = false;
    } else {
      setEmailErr("");
    }
    if (!valid) return;

    setSubmitErr("");
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameTrimmed,
          email: emailTrimmed,
          service,
          urgency,
          details,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDone(true);
    } catch {
      setSubmitErr(
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
      setAccountErr(
        "Could not create the account. You can retry or use the portal later."
      );
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

  if (done) {
    return (
      <PageShell variant="wrap">
        <div className="wizard-shell">
          <div className="success">
            <div className="ring" aria-hidden="true">&#10003;</div>
            <h1>Request sent, {name.trim().split(" ")[0]}</h1>
            <p>
              Check your inbox within 24 hours for your fixed quote.
              <br />
              Sit tight — you&apos;ve done your part.
            </p>
          </div>

          <p className="back-link">
            <Link className="link" href="/">
              Back to site
            </Link>
          </p>

          <div className="next-step">
            <div className="step-label">Optional next step</div>

            {accountState === "idle" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void createAccount();
                }}
                noValidate
              >
                <div className="post-submit">
                  <div className="q">
                    Track this request live in the client portal
                  </div>
                  <div className="qhelp">
                    Set a password for {email.trim()} to see your quote,
                    accept or decline it, and follow progress — all in
                    writing.
                  </div>
                  <Field
                    id="account-password"
                    label="Create a portal password"
                    error={accountErr}
                  >
                    {(id, props) => (
                      <input
                        {...props}
                        id={id}
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="8+ characters"
                      />
                    )}
                  </Field>
                  <div className="post-submit-actions">
                    <Button type="submit" variant="primary">
                      Create password
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setAccountState("skip")}
                    >
                      No thanks
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {accountState === "creating" && (
              <div className="post-submit">
                <LoadingState>Creating your account…</LoadingState>
              </div>
            )}

            {accountState === "created" && (
              <div className="post-submit">
                <p>Account created. Your request is already linked.</p>
                <Button variant="primary" href="/portal">
                  Go to your portal
                </Button>
              </div>
            )}

            {(accountState === "exists" || accountState === "skip") && (
              <div className="post-submit">
                {accountState === "exists" ? (
                  <p>
                    An account with this email already exists — log in to
                    see this request.
                  </p>
                ) : (
                  <p>
                    No problem — your quote will arrive by email. You can
                    create a portal account any time.
                  </p>
                )}
                <Button variant="ghost" href="/portal">
                  Client portal
                </Button>
              </div>
            )}

            {accountState === "error" && (
              <div className="post-submit">
                <ErrorBanner>{accountErr}</ErrorBanner>
                <div className="post-submit-actions">
                  <Button
                    variant="primary"
                    onClick={() => void createAccount()}
                  >
                    Retry
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setAccountState("skip")}
                  >
                    Skip for now
                  </Button>
                </div>
              </div>
            )}
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
              <div className="step-label">Step 1 of 4</div>
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
              <div className="step-label">Step 2 of 4</div>
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
              <div className="step-label">Step 3 of 4</div>
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
              <div className="step-label">Step 4 of 4</div>
              <h1 className="q">Where should we send your quote?</h1>
              <div className="qhelp">
                No spam, no newsletter — just your quote.
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
              </div>

              <Field id="name" label="Your name" error={nameErr}>
                {(id, props) => (
                  <input
                    {...props}
                    id={id}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                )}
              </Field>
              <Field id="email" label="Email" error={emailErr}>
                {(id, props) => (
                  <input
                    {...props}
                    id={id}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                )}
              </Field>

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
            </div>
          )}
        </form>
      </div>
    </PageShell>
  );
}
