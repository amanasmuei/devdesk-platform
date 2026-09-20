"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { statusLabel } from "./lib";

type ButtonVariant = "primary" | "ghost" | "secondary";
type ButtonSize = "sm" | "md";

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  href,
  type = "button",
  disabled = false,
  loading = false,
  fullWidth = false,
  className = "",
  onClick,
  children,
}: ButtonProps) {
  const cls = [
    "btn",
    `btn-${variant}`,
    size !== "md" ? `btn-${size}` : "",
    fullWidth ? "btn-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner = loading ? (
    <>
      <span className="btn-spinner" aria-hidden="true" />
      <span>{children}</span>
    </>
  ) : (
    children
  );

  if (href) {
    return (
      <Link
        className={cls}
        href={href}
        onClick={onClick}
        aria-disabled={disabled || loading || undefined}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      className={cls}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading || undefined}
    >
      {inner}
    </button>
  );
}

type FieldControlProps = {
  id: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

type FieldProps = {
  id: string;
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (id: string, controlProps: FieldControlProps) => ReactNode;
};

export function Field({
  id,
  label,
  hint,
  error,
  className = "",
  children,
}: FieldProps) {
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const controlProps: FieldControlProps = {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };

  return (
    <div className={`field ${className}`.trim()}>
      {label && <label htmlFor={id}>{label}</label>}
      {children(id, controlProps)}
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type AuthMode = "login" | "register";

type AuthFormProps = {
  title: string;
  subtitle: string;
  allowRegister?: boolean;
  submitLabel?: { login: string; register: string };
  onSubmit: (input: {
    email: string;
    password: string;
    mode: AuthMode;
  }) => Promise<string | null>;
};

export function AuthForm({
  title,
  subtitle,
  allowRegister = true,
  submitLabel,
  onSubmit,
}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErr("Enter your email and password.");
      return;
    }
    setErr("");
    setBusy(true);
    try {
      const msg = await onSubmit({ email: email.trim(), password, mode });
      if (msg) {
        setErr(msg);
        setBusy(false);
      }
    } catch {
      setErr("Could not reach the server. Please try again.");
      setBusy(false);
    }
  }

  const buttonLabel =
    submitLabel?.[mode] ?? (mode === "login" ? "Log in" : "Create account");
  const busyLabel = mode === "login" ? "Logging in…" : "Creating account…";

  return (
    <form onSubmit={handleSubmit} noValidate>
      <header>
        <h1>{title}</h1>
        <p className="panel-sub">{subtitle}</p>
      </header>
      <Field id="auth-email" label="Email">
        {(id, props) => (
          <input
            {...props}
            id={id}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        )}
      </Field>
      <Field id="auth-password" label="Password">
        {(id, props) => (
          <input
            {...props}
            id={id}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        )}
      </Field>
      {err && <ErrorBanner>{err}</ErrorBanner>}
      <div className="form-actions">
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={busy}
          disabled={busy}
        >
          {busy ? busyLabel : buttonLabel}
        </Button>
        {allowRegister && (
          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setErr("");
            }}
          >
            {mode === "login"
              ? "New here? Create an account"
              : "Already have an account? Log in"}
          </Button>
        )}
      </div>
    </form>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge--${status}`}>{statusLabel(status)}</span>;
}

export function ProgressSteps({
  step,
  total,
  label = "Request progress",
}: {
  step: number;
  total: number;
  label?: string;
}) {
  const now = Math.min(Math.max(step + 1, 0), total);
  const pct = total > 0 ? (now / total) * 100 : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={now}
      aria-label={label}
    >
      <div className="bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="empty" role="status">
      {children}
    </div>
  );
}

export function LoadingState({
  children = "Loading…",
}: {
  children?: ReactNode;
}) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function ErrorBanner({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <div className="err" role="alert" id={id}>
      {children}
    </div>
  );
}

export function PageShell({
  variant = "panel",
  wide = false,
  children,
}: {
  variant?: "panel" | "wrap";
  wide?: boolean;
  children: ReactNode;
}) {
  const cls =
    variant === "wrap"
      ? "wrap page-main"
      : `panel${wide ? " panel--wide" : ""}`;
  return (
    <main id="main" className={cls}>
      {children}
    </main>
  );
}


