import Link from "next/link";

const services = [
  {
    kicker: "Fix",
    title: "Bug fixes & debugging",
    body: "Broken code, cryptic errors, deadline around the corner. Send it over — we diagnose, fix, and explain what went wrong.",
    meta: "Most fixes returned within 48h",
  },
  {
    kicker: "Build",
    title: "Websites & landing pages",
    body: "Clean, fast, mobile-friendly pages for your business, portfolio, or event. You describe the vibe; we handle everything technical.",
    meta: "Live in days, not weeks",
  },
  {
    kicker: "Automate",
    title: "Scripts & automation",
    body: "Small tools and scripts that take over repetitive work — file handling, data entry, reports — built your way.",
    meta: "Give the boring work to a machine",
  },
  {
    kicker: "Learn",
    title: "Assignments & tutoring",
    body: "Stuck on coursework? We build it with you and walk through every line, so you understand it well enough to defend it.",
    meta: "Explanation always included",
  },
];

const steps = [
  {
    title: "Describe it",
    body: "Answer four quick questions in the request form. Paste errors, sketch ideas, or write it in plain words.",
  },
  {
    title: "Get a fixed quote",
    body: "Within 24 hours you receive a fixed price and delivery date by email. Accept it or walk away — completely free.",
  },
  {
    title: "Approve, then pay",
    body: "We build it. You verify it works — live preview or recording. Only then do you pay via DuitNow / TnG.",
  },
];

const tiers = [
  {
    kicker: "Small",
    price: "RM40–80",
    unit: "per job",
    items: [
      "Single bug fix or small script",
      "Delivered within 24–48 hours",
      "One free revision round",
    ],
  },
  {
    kicker: "Medium",
    price: "RM100–250",
    unit: "per job",
    items: [
      "Landing page or multi-file feature",
      "Delivered within 2–5 days",
      "One free revision round",
    ],
  },
  {
    kicker: "Large",
    price: "RM250–600",
    unit: "per job",
    items: [
      "Multi-page site or bigger build",
      "Scope and timeline quoted in writing",
      "One free revision round",
    ],
  },
];

const faqs = [
  {
    q: "How much does it cost?",
    a: "It depends on the job — which is exactly why we quote first. You get a fixed price before any work starts, and it never changes mid-project.",
  },
  {
    q: "When do I pay?",
    a: "After you've seen the work functioning — a live preview or screen recording. You confirm it does what you asked, then pay via DuitNow / TnG. No deposits on small jobs.",
  },
  {
    q: "What if I don't like the quote?",
    a: "Then you walk away — completely free. Requesting a quote costs nothing and commits you to nothing.",
  },
  {
    q: "Do we need to meet or call?",
    a: "Never. Everything happens in writing. Clearer requirements, better records, zero awkward calls.",
  },
  {
    q: "What if it breaks after delivery?",
    a: "Every job includes one free revision round after you test. If something we built stops working as delivered, we fix it.",
  },
];

export default function Home() {
  return (
    <>
      <nav className="nav">
        <div className="wrap nav-inner">
          <Link className="wordmark" href="/">
            DevDesk
          </Link>
          <div className="nav-links">
            <a className="navlink" href="#services">
              Services
            </a>
            <a className="navlink" href="#process">
              Process
            </a>
            <a className="navlink" href="#faq">
              FAQ
            </a>
            <Link className="btn btn-primary" href="/order">
              Get a free quote
            </Link>
          </div>
        </div>
      </nav>

      <header className="wrap hero">
        <div className="eyebrow">
          <span className="dot"></span>
          Accepting new projects
        </div>
        <h1>
          You describe it.
          <br />
          <em>We build it.</em>
        </h1>
        <p className="sub">
          Websites, bug fixes, scripts and coding help — with a{" "}
          <b>fixed quote in 24 hours</b>. Everything in writing. No calls, no
          meetings, no pressure.
        </p>
        <div className="hero-ctas">
          <Link className="btn btn-primary" href="/order">
            Start a request
          </Link>
          <a className="btn btn-ghost" href="#services">
            Explore services
          </a>
        </div>
        <p className="micro">
          Free to ask · Pay only after you see the work · Quote within 24h
        </p>
      </header>

      <section id="services" className="wrap section">
        <div className="eyebrow-sm">Services</div>
        <h2>What we build</h2>
        <p className="section-sub">
          Focused scope, honest timelines, and work you can verify before
          paying.
        </p>
        <div className="grid">
          {services.map((s) => (
            <div className="card" key={s.title}>
              <div className="kicker">{s.kicker}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
              <div className="meta">{s.meta}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="process" className="wrap section">
        <div className="eyebrow-sm">Process</div>
        <h2>Simple by design</h2>
        <p className="section-sub">
          Three steps, fully in writing. You never have to talk to anyone.
        </p>
        <div className="steps">
          {steps.map((s) => (
            <div className="step" key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="wrap section">
        <div className="eyebrow-sm">Pricing</div>
        <h2>Honest price bands</h2>
        <p className="section-sub">
          Every job gets a fixed quote first. These bands show where most jobs
          land.
        </p>
        <div className="pricing-grid">
          {tiers.map((t) => (
            <div className="price-card" key={t.kicker}>
              <div className="kicker">{t.kicker}</div>
              <div className="price">
                {t.price} <small>{t.unit}</small>
              </div>
              <ul>
                {t.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="pricing-note">
          Payment via DuitNow / TnG, only after you have seen the work
          functioning.
        </p>
      </section>

      <section id="faq" className="wrap section">
        <div className="eyebrow-sm">FAQ</div>
        <h2>Questions, answered</h2>
        <p className="section-sub">
          The things everyone asks before their first request.
        </p>
        <div className="faq">
          {faqs.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q} <span className="plus">+</span>
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="cta-strip">
        <div className="wrap cta-inner">
          <h2>Have something in mind?</h2>
          <p>
            Describe it now — the quote is free and arrives within 24 hours.
          </p>
          <Link className="btn btn-primary" href="/order">
            Start a request
          </Link>
        </div>
      </div>

      <footer className="footer">
        <div className="wrap foot">
          <span>
            <b style={{ color: "var(--text)", fontWeight: 700 }}>DevDesk</b> —
            You describe it, we build it.
          </span>
          <span>
            Questions?{" "}
            <a href="mailto:amanasmuei@gmail.com">amanasmuei@gmail.com</a>
          </span>
        </div>
      </footer>
    </>
  );
}
