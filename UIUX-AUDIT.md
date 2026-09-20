# DevDesk — Deep UI/UX Audit

**Scope:** the entire UI surface.
- `apps/web/app/page.tsx` (landing)
- `apps/web/app/layout.tsx` (root layout)
- `apps/web/app/order/page.tsx` (order wizard)
- `apps/web/app/portal/page.tsx` (client portal)
- `apps/web/app/admin/page.tsx` (admin panel)
- `apps/web/app/globals.css` (single shared stylesheet)
- `apps/web/app/lib.ts` (read for context: `statusLabel`, `NEXT_STATUS`, status values)

**Method:** static audit of markup, styles, state handling, and accessibility against WCAG 2.2 AA. Contrast ratios are computed (approx.) against the page background `--bg #0a0c11` and surface `--surface #10131b`.

---

## Severity legend

- **BLOCKER** — broken core flow, data-loss/integrity risk, or a hard WCAG failure that blocks task completion.
- **MAJOR** — clear usability/accessibility defect that meaningfully degrades the experience or fails AA.
- **MINOR** — polish, consistency, or best-practice gap.

Issue IDs are used in the Revamp Plan at the bottom for traceability.

---

# 0. Global / cross-cutting issues (layout.tsx + globals.css)

These apply to every page and are referenced by ID from the per-page sections.

### G1 — `--faint` fails WCAG AA for normal text (MAJOR)
- `globals.css:9` defines `--faint: #667085`. Against `--bg #0a0c11` it is **≈3.9:1**; against `--surface #10131b` it is **≈3.7:1** — below the 4.5:1 minimum for normal text.
- Used for real content at small sizes everywhere: `.micro` (globals.css:186), `.card .meta` (263), `.pricing-note` (345), `.footer` (421), `.step-label` (763), `.dt` (543), `.meta-line` (648), `.admin-edit label` (665), `.loading` (872), `.empty` (611), `.choice small` (805), and all placeholders (487).
- **Fix:** raise `--faint` to a value that clears 4.5:1 on the darkest surface, e.g. `#7a8498` (≈5.2:1 on `--bg`). Optionally add a separate `--placeholder` token that also passes. Do not use `--faint` for anything smaller than 0.75rem until it is lightened.

### G2 — No `:focus-visible` styles for buttons/links (MAJOR)
- Inputs/selects/textareas get a focus treatment (`globals.css:490-495`) but **no** interactive control (`.btn`, `.wbtn`, `.choice`, `.logout-btn`, `.navlink`, `.preview-link`, FAQ `summary`) has a focus-visible style. `.choice`, `.wbtn`, and `.btn` never set `outline: none`, so users are left with the browser's default ring (low contrast on a dark theme) or none at all.
- **Fix:** add a global rule:
  ```css
  :where(a, button, summary, select, input, textarea, [tabindex]):focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 6px;
  }
  ```
  and keep the `:focus` box-shadow for text inputs (switch it to `:focus-visible` to avoid showing the ring on mouse click).

### G3 — Inputs/selects lack `color-scheme: dark` (MAJOR)
- `:root` (globals.css:1-15) never sets `color-scheme: dark`. Native widgets — `<input type="date">`, `<input type="number">` spinners, `<select>` chevron, scrollbars, autofill — render with light-system styling. On a near-black theme the WebKit date/number controls are often invisible or glaringly light (admin page depends on these heavily).
- **Fix:** add `color-scheme: dark;` to `:root`.

### G4 — `overflow-x: hidden` on body (MAJOR)
- `globals.css:33` sets `overflow-x: hidden`. This both **masks** horizontal-scroll bugs instead of fixing them, and risks breaking `position: sticky` on `.nav` (globals.css:47-55) because a non-`visible` overflow axis turns `body` into a scroll container.
- **Fix:** use `overflow-x: clip` (does not create a scroll container), or remove it and fix the actual overflow sources (the `.req-row`/`.admin-row` grids at mid widths — see P7/A6).

### G5 — No `scroll-margin-top` for sticky nav (MAJOR)
- The nav is `position: sticky; top: 0` (globals.css:47-55) but the anchor targets `#services`/`#process`/`#pricing`/`#faq` (page.tsx:154,173,189,217) have no `scroll-margin-top`. Jumping to a section scrolls its heading underneath the ~61px nav, hiding the eyebrow + part of the `h2`.
- **Fix:** `section[id], [id] { scroll-margin-top: 80px; }`.

### G6 — No skip link (MAJOR)
- `layout.tsx:22-24` renders `<body>{children}</body>` with no "Skip to content" link. Keyboard users must tab through the nav on every page.
- **Fix:** add `<a class="skip-link" href="#main">Skip to content</a>` as the first body child; give each page's `<main>` `id="main"` (or wrap children).

### G7 — Ad-hoc radii, spacing, shadows; no tokens (MAJOR for maintainability)
- Radii are scattered: `--radius: 14px` (globals.css:12) for cards, `20px` for `.panel-card`/`.wizard-shell` (447, 737), `12px` inputs (479), `10px` buttons (94), `11px` `.wbtn` (816), `999px` badges (548). Shadows are hardcoded twice each: `0 30px 80px rgba(0,0,0,.45)` (451, 741), `0 8px 24px rgba(255,255,255,.12)` (110, 837). Spacing is arbitrary px (`28, 26, 44, 96, 72, 22, 24`).
- **Fix:** define `--radius-*`, `--shadow-*`, and `--space-*` scales (see Revamp Plan) and replace all literals.

### G8 — Raw color literals instead of semantic tokens (MAJOR for maintainability)
- Success green `#4ade80` appears as `.dot` shadow (153), `.ok-note` (507), `.save-note` (683), `.badge.delivered/accepted/paid` (569, 582, 586), `.success .ring` (717). Danger red `#f97066` in `.err` (501), `.badge.declined` (573), `.save-note.err` (686). Warning `#f5c14b` (565). Primary button white `#fff`/`#0a0c11` (105-106, 830-832). All should be `--success`, `--danger`, `--warning`, `--on-accent`, `--accent-strong`.
- **Fix:** add semantic tokens and sweep the file.

### G9 — Form controls use `:focus`, not `:focus-visible` (MINOR)
- `globals.css:490-495`. The accent ring appears on mouse click as well as keyboard. Acceptable, but inconsistent with the `:focus-visible` fix in G2.

### G10 — Breakpoints are only 700px/640px (MINOR)
- `globals.css:84-88` and `877-917`. No tablet range handling; nav links disappear below 700px while the CTA remains, and the req/admin grids only collapse at 640px (see P7/A6).

### G11 — Layout: no `metadataBase` / `viewport`/theme-color (MINOR)
- `layout.tsx:12-16`. Missing `metadataBase` (needed for absolute OG URLs later), no `theme-color` for the dark chrome.
- **Fix:** add `export const viewport = { themeColor: "#0a0c11" }` and `metadataBase` when a canonical domain exists.

---

# 1. Landing page (`page.tsx`)

## 1.1 Visual hierarchy / typography / spacing / color
- **L1 (MINOR)** — `page.tsx:250` — footer wordmark uses an inline `<b style={{ color: "var(--text)", fontWeight: 700 }}>` instead of the `.wordmark` class. Duplicates the wordmark style; use the class or a `.foot-mark` component.
- **L2 (MINOR)** — `page.tsx:131-135` + `globals.css:161-167` — the gradient `h1 em` uses `color: transparent` + `background-clip: text` without `-webkit-text-fill-color: transparent`. Works in modern browsers but is the common failure point for invisible text; add the `-webkit-text-fill-color: transparent` fallback line.
- **L3 (MINOR)** — `globals.css:280-289` — the process step counter is hardcoded `content: "0" counter(step)`, so a 10th step would read "010". Harmless today (3 steps) but fragile; use `content: counter(step, decimal-leading-zero)`.
- **L4 (MINOR)** — Hero is strong (clamp type scale, clear CTA hierarchy). No change needed beyond tokens. The `.eyebrow-sm`/`h2`/`.section-sub` vertical rhythm (14/12/52px) is consistent and reads well.

## 1.2 Component consistency
- **L5 (MAJOR)** — `page.tsx:109-121` — nav omits the **Pricing** section even though `#pricing` exists (page.tsx:189). Nav has Services/Process/FAQ but not Pricing; inconsistent with the page structure.
  - **Fix:** add `<a className="navlink" href="#pricing">Pricing</a>` (or drop the section).
- **L6 (MINOR)** — `.card` and `.price-card` (globals.css:227-264 vs 307-342) duplicate kicker/padding/border/hover intent. Extract one `Card` component.
- **L7 (MINOR)** — `.step` (transparent bg) vs `.card` (surface bg) — two different "card" treatments in one page. Intentional differentiation is fine, but they should share a `--radius` and padding token.

## 1.3 Interaction states
- **L8 (MINOR)** — No `:active` (pressed) state on `.btn-primary`/`.btn-ghost`/`.card` (globals.css:108-120, 234-238). Hover-only.
- **L9 (MINOR)** — `.card:hover` lifts with `translateY(-3px)` but the `.card` is not clickable — motion implies clickability. Either link the cards to `/order` or remove the lift.
- **L10 (MINOR)** — `page.tsx:127-130` — "Accepting new projects" eyebrow is a decorative status; the green `.dot` is fine visually, but the status is not exposed to AT (no `role="status"`). Minor.

## 1.4 Accessibility
- **L11 (MAJOR)** — G1 applies: `.micro` (page.tsx:149), `.card .meta` (167), `.pricing-note` (211), `.footer` (247-257) are `--faint` ≈3.9:1 → fail AA.
- **L12 (MAJOR)** — G2 applies: `.navlink` (110-117), `.btn` CTAs, FAQ `summary` (226) have no focus-visible treatment.
- **L13 (MAJOR)** — G5 applies: anchor jumps hide headings under sticky nav.
- **L14 (MINOR)** — `page.tsx:227` — the FAQ `.plus` is a text `+` inside `summary`; screen readers announce it ("Questions, answered +"). Mark decorative: `<span className="plus" aria-hidden="true">+</span>`.
- **L15 (MINOR)** — `page.tsx:226-228` — `<details>/<summary>` is semantically correct and keyboard-operable (good), but `summary` has only a hover style (globals.css:374); add the G2 focus-visible style.
- **L16 (MINOR)** — `page.tsx:128` — `.dot` is decorative (`<span className="dot"></span>`) — fine, empty span is ignored; no action needed.

## 1.5 Responsiveness 390px → desktop
- **L17 (MAJOR)** — `globals.css:84-88` — below 700px all `.navlink` items are `display: none` with **no replacement** (no hamburger/menu). A 390px user can only reach Services/Process/FAQ by scrolling; the only nav affordance left is "Get a free quote".
  - **Fix:** add a mobile menu (details/summary or a stateful button) or keep anchor links visible as a second row.
- **L18 (MINOR)** — `globals.css:893-896` — `.hero-ctas .btn { width: 100% }` stacks CTAs full-width at ≤640px (good), but `.hero-ctas` has `flex-wrap: wrap` (185) so at 641-700px the buttons may wrap awkwardly while nav links are already hidden.
- **L19 (MINOR)** — `.wrap` padding changes from 24px to 22px at 640px (globals.css:36-39, 878-880) — a negligible, non-scale-aligned difference. Normalize to a spacing token.

---

# 2. Order wizard (`order/page.tsx`)

## 2.1 Visual hierarchy / typography / spacing / color
- **O1 (MINOR)** — Heavy use of inline `style={{ marginTop, marginBottom, fontSize }}` on the success screen (order/page.tsx:126, 139-143, 155, 174, 180-201, 212). These override `.q`/`.qhelp` and re-state spacing that should be CSS classes. Extract `.post-submit`, `.post-submit-actions`.
- **O2 (MINOR)** — `order/page.tsx:240` — reuses `.section-sub` for the intro line, but `.section-sub` is a *centered* landing class with `margin: 12px auto 52px`; overridden inline. A dedicated `.wizard-intro` class is clearer.
- **O3 (MINOR)** — `.q` (1.42rem) is the de-facto step heading; `h1`/`h2` semantics are absent — the page has no single visible `h1` in the wizard flow (heading is a `.q` div). See O13.

## 2.2 Component consistency
- **O4 (MAJOR)** — Two parallel button systems exist: `.btn`/`.btn-primary`/`.btn-ghost` (globals.css:91-125) and `.wbtn`/`.wbtn-next` (globals.css:814-843). They duplicate padding, hover lift, disabled opacity, and "white primary" treatment. The wizard mixes both (`.wbtn` for Back, `.btn` for portal links on success). Consolidate into one `Button` with variants.
- **O5 (MINOR)** — `.choice` (globals.css:780-808) is a third button variant (selectable card). Keep it, but extract the shared focus/hover/radius tokens.

## 2.3 Interaction states
- **O6 (MINOR)** — No loading state other than the label swap `"Sending…"` (order/page.tsx:378). The button disables correctly (`disabled={sending}`, 376). A small inline spinner would improve perceived progress.
- **O7 (MINOR)** — `accountState === "creating"` renders plain text "Creating your account…" (order/page.tsx:173-176) with no spinner or aria-live; a screen reader won't announce the transition.
- **O8 (MINOR)** — Validation error is a single `.err` line (order/page.tsx:292, 368). Errors are not announced (`aria-live`) and not linked to fields (see O14).

## 2.4 Accessibility
- **O9 (MAJOR)** — **Progress bar is wrong and inaccessible.** `order/page.tsx:245-250` computes `width: ${(step / TOTAL) * 100}%`, which yields **0% / 25% / 50% / 75%** — on the final step the bar shows 75%, never 100%. It also has no `role="progressbar"`, `aria-valuemin/max/now`, or label.
  - **Fix:** `width: ${((step + 1) / TOTAL) * 100}%` and add `role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={step + 1} aria-label="Request progress"`.
- **O10 (MAJOR)** — **The wizard is not a `<form>`** (order/page.tsx:244-383). Pressing Enter in the textarea or inputs does nothing; native submit/validation is bypassed.
  - **Fix:** wrap each step (or the whole shell) in `<form onSubmit={...}>` with the primary action as `type="submit"`.
- **O11 (MAJOR)** — **The `textarea` and name/email inputs have no accessible label.** `order/page.tsx:287-291` (textarea) has only a placeholder; `352-367` wraps inputs in `<label className="field">` that contains **no text**, so the accessible name is empty (placeholder-only). G1 also makes the placeholder low-contrast.
  - **Fix:** add visible labels ("What's going on?", "Your name", "Email") or `aria-label`, and keep placeholders as examples only.
- **O12 (MAJOR)** — G2 applies: `.choice` (order/page.tsx:261-274, 321-334) and `.wbtn` (294, 297, 338, 370, 373) have no focus-visible style; keyboard users cannot see focus on the primary interaction of the page.
- **O13 (MAJOR)** — No `h1` on the order page — the page title is a `.q` div (order/page.tsx:255). Heading structure starts at `h3` on success (130). Add a visually-consistent `h1` ("Start a request") or make the step question an `h1`/`h2`.
- **O14 (MAJOR)** — **Validation is not programmatically associated.** `order/page.tsx:66-73, 99-101, 300-302` set a single error string; inputs/textarea have no `aria-invalid`, no `aria-describedby`, and `.err` (292, 368) has no `role="alert"`/`aria-live`.
  - **Fix:** per-field errors with `aria-invalid` + `aria-describedby`, and `role="alert"` on the error container.
- **O15 (MINOR)** — `order/page.tsx:129` — success `.ring` is the text glyph `&#10003;` (✓). Screen readers may announce "check mark". Wrap in `aria-hidden="true"` and rely on the `h3` text.
- **O16 (MINOR)** — `order/page.tsx:148-153` — password field lacks `autoComplete="new-password"`; browsers won't offer a strong password and may misfill.

## 2.5 Responsiveness 390px → desktop
- **O17 (MINOR)** — Inputs use 16px font (globals.css:481) → no iOS zoom on the wizard (good). `.wizard-shell` collapses padding at 640px (897-900) (good). The only risk is the long `.qhelp`/`textarea` placeholder wrapping — fine.
- **O18 (MINOR)** — `globals.css:914-916` — `.wbtn { flex: 1 }` at ≤640px makes Back and Continue equal-width (good tap targets). But `.choice` padding (16px/18px) is comfortable; verify tap target ≥44px — passes.

## 2.6 Wizard-specific UX
- **O19 (MAJOR)** — **No selected state when navigating Back.** `order/page.tsx:260-275` and `320-335` auto-advance on click but never record/highlight the current choice. Going Back to step 1 or 3 shows all options as unselected, so users can't tell what they already picked.
  - **Fix:** add `.choice[aria-selected="true"]` styling (accent border/background) and set `aria-selected={service === c.val}`.
- **O20 (MAJOR)** — **Auto-advance on choice click means no review before commit.** Selecting a service or urgency immediately advances the step; there is no summary/review step before "Get my free quote" on step 4, so the user never sees service + details + urgency together before submitting.
  - **Fix:** either add a review step (shows all answers + Edit links) or, at minimum, echo the selected service/urgency on step 4.
- **O21 (MINOR)** — Step clarity is otherwise good: "Step N of 4" label + question + helper copy is a clean pattern. `Back` is present on steps 2/3/4 but there is no persistent "Back to site" once `done` (see O22).
- **O22 (MINOR)** — **Success screen has no nav.** `order/page.tsx:124-224` — the `done` branch drops the wordmark/back link entirely; only the `/portal` CTA (or nothing) exits. Add a "Back to site" link.
- **O23 (MINOR)** — **Optional account creation appears after "done", which muddles success.** `order/page.tsx:138-171` — the headline says "Request sent" and immediately asks the user to set a password; it can read as the request not being finished. Keep it, but visually separate it as a clearly-optional "Next step" panel (it already has "No thanks", which is good).
- **O24 (MINOR)** — State is not persisted (order/page.tsx:48-61). A refresh mid-wizard loses all answers. Low priority for a 60-second flow, but `sessionStorage` would prevent accidental loss.
- **O25 (MINOR)** — `emailOk` (order/page.tsx:63) is a bare regex and only checked on submit (70). Fine for now; consider inline email validation on blur.
- **O26 (MINOR)** — "Something else" service choice (order/page.tsx:28-31) flows straight to the textarea with no prompt tailored to it. Acceptable, but could add conditional helper text.

---

# 3. Client portal (`portal/page.tsx`)

## 3.1 Visual hierarchy / typography / spacing / color
- **P1 (MINOR)** — Logged-in heading is an `h2` styled with inline `textAlign: left` (portal/page.tsx:223) while login view uses `h1` (161). Heading levels are inconsistent between the two states of the same page.
- **P2 (MINOR)** — `RM {r.quote_price}` (portal/page.tsx:252) is unformatted — no thousands separators or fixed decimals. `RM 1250` and `RM 250.5` render inconsistently.
  - **Fix:** `new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(price)`.
- **P3 (MINOR)** — Dates use bare `toLocaleDateString()` (portal/page.tsx:242, 256) → locale-dependent formats across users. Pass an explicit locale/options.

## 3.2 Component consistency
- **P4 (MAJOR)** — **Login/register form duplicates the admin login form** almost line-for-line (portal/page.tsx:165-207 vs admin/page.tsx:190-215): same `.field`, same empty-label inputs, same "full width button" inline styles. Extract a shared `AuthForm`.
- **P5 (MAJOR)** — `portal/page.tsx:228-232` — the empty-state `<Link href="/order">Start one</Link>` is unstyled (no class). With no global `a` reset it renders as the browser default blue/underline, clashing with the dark minimal design.
  - **Fix:** use `.btn btn-ghost` or a `.link` class.
- **P6 (MINOR)** — `portal/page.tsx:248` — badge markup is duplicated from admin; status→color mapping is ad-hoc CSS classes (`.badge.submitted/quoted/...`). Move to a `StatusBadge` component driven by a single status→color map in `lib.ts`.

## 3.3 Interaction states
- **P7 (MAJOR)** — **Login form flashes for already-authenticated users.** `loggedIn` starts `false` (portal/page.tsx:12) and the `/api/auth/me` probe runs in a `useEffect` after first paint (19-36). An authenticated client sees the login form flash before the session resolves. The admin page already solves this with a `booted` flag (admin/page.tsx:36); the portal does not.
  - **Fix:** mirror the admin `booted` pattern; render a neutral loading state until the probe finishes.
- **P8 (MAJOR)** — **`loadErr` is never cleared on a successful reload.** `loadRequests` (portal/page.tsx:47-58) only ever `setLoadErr(...)`; it never clears it. A transient error sticks permanently even after the next successful poll (line 40 polls every 30s).
  - **Fix:** `setLoadErr("")` at the start (or success) of `loadRequests`.
- **P9 (MAJOR)** — **Accept/Decline has no busy/disabled state.** `decide` (portal/page.tsx:62-92) does not disable the buttons while in flight; double-click sends duplicate decisions and can race. Add a `deciding` id/state and disable both buttons during the request.
- **P10 (MINOR)** — No `aria-live` on status changes. After accept/decline the badge updates (80-88) but AT users aren't told. Add `role="status"`/`aria-live="polite"` to the list or badge.
- **P11 (MINOR)** — Empty state ("No requests yet") is fine, but `.empty`/`.loading` (globals.css:609-614, 870-875) are plain text in `--faint` (G1 → fails contrast).

## 3.4 Accessibility
- **P12 (MAJOR)** — **Login form is not a `<form>`** (portal/page.tsx:165-207); Enter does not submit and there's no `type="submit"`.
- **P13 (MAJOR)** — **Inputs have empty labels.** `portal/page.tsx:165-180` — `<label className="field">` contains no text; accessible names come only from placeholders (which are `--faint`, failing contrast per G1).
  - **Fix:** visible labels ("Email", "Password") or `aria-label`, plus `autoComplete="email"` / `current-password`/`new-password`.
- **P14 (MAJOR)** — G2 applies to `.btn` login buttons (portal/page.tsx:182-207), decision buttons (275-287), and `.logout-btn` (219).
- **P15 (MINOR)** — `.err` (portal/page.tsx:181) is always rendered (reserves a blank line even when empty) and has no `role="alert"`.
- **P16 (MINOR)** — `.preview-link` (portal/page.tsx:263-270) opens `target="_blank"` with correct `rel="noopener noreferrer"` (good), but has no indication it opens a new tab.

## 3.5 Responsiveness 390px → desktop
- **P17 (MAJOR)** — `.req-row` uses `grid-template-columns: 1.2fr 2fr 0.8fr 1fr` (globals.css:519-522) and only collapses to one column at **640px** (904-907). Between 641-900px the four columns are cramped (service, details, badge, actions squeeze), risking horizontal scroll and tiny tap targets.
  - **Fix:** collapse to a stacked layout at a tablet breakpoint (~860px) or use `grid-template-columns` with `minmax()` + auto-flow.
- **P18 (MINOR)** — `.decision .btn` padding `8px 14px` (globals.css:605-608) makes Accept/Decline short (~32px tall) — below the 44px touch target. Bump to ≥44px on coarse pointers.

---

# 4. Admin panel (`admin/page.tsx`)

## 4.1 Visual hierarchy / typography / spacing / color
- **A1 (MINOR)** — `admin/page.tsx:315-324` — the "Admin notes" label is an inline-styled `label` that duplicates `.admin-edit label` (globals.css:662-670) by hand. Use the same class; delete the inline style.
- **A2 (MINOR)** — `admin/page.tsx:226` — "Admin" badge uses inline `style={{ border: "none" }}` overriding `.badge`; use a `.badge .badge-role` modifier.
- **A3 (MINOR)** — Row content hierarchy (name → email → meta → details) is clear; but `.who`/`.meta-line`/`.dtl` have no visual grouping separator beyond spacing — acceptable.

## 4.2 Component consistency
- **A4 (MAJOR)** — Login form duplicates portal's (see P4). Extract shared `AuthForm`.
- **A5 (MAJOR)** — **No logout in the logged-in admin view.** `admin/page.tsx:220-229` — `page-header` contains only the wordmark + "Admin" badge; there is no logout button (the portal has one at portal/page.tsx:219-221). Admins cannot end their session without clearing cookies.
  - **Fix:** add the same `.logout-btn` (and wire `logout()`).

## 4.3 Interaction states
- **A6 (MAJOR)** — **Save button has no disabled state while saving.** `admin/page.tsx:335` — `save()` sets `saveState` to "Saving…" (113) but the button stays clickable; rapid double-click fires duplicate PUTs and can re-order/overwrite transitions.
  - **Fix:** `disabled={saveState[id] === "Saving…"}` and show the label "Saving…" on the button.
- **A7 (BLOCKER)** — **Save error detection is substring-based and wrong.** `admin/page.tsx:159-163` stores the server error message; `338-346` decides green-vs-red by `saveState[id].includes("fail")`. Any server error that doesn't contain "fail" (e.g. "Cannot transition from quoted to paid", "Invalid preview URL") is rendered **green as if saved**.
  - **Fix:** store a discriminated value (`{ kind: "saving" | "saved" | "error", message }`) and style on `kind`, not on string contents.
- **A8 (MINOR)** — "Saved" auto-clears after 2.5s via `setTimeout` (admin/page.tsx:150-158). No `aria-live` on `.save-note`, so the transient confirmation is invisible to AT.
- **A9 (MINOR)** — No loading state when `requests` is present but stale; polling is absent on admin (unlike portal) — admins must refresh manually. Minor feature gap.

## 4.4 Accessibility
- **A10 (MAJOR)** — **Login form not a `<form>`** (admin/page.tsx:190-215); Enter doesn't submit.
- **A11 (MAJOR)** — **Edit labels are not associated with their inputs.** `admin/page.tsx:267, 283, 295, 303` — `<label>Status</label>` etc. are siblings of the `<select>`/`<input>`, with no `htmlFor`/`id`. Screen readers won't announce field names.
  - **Fix:** `id` + `htmlFor` on every field (or wrap inputs in the label).
- **A12 (MAJOR)** — **Admin inputs use 14px font** (globals.css:671-676: `.admin-edit input/select/textarea { font-size: 14px }`) → below the 16px threshold, so iOS Safari zooms the viewport on focus, breaking the admin layout on mobile.
  - **Fix:** use 16px for all admin form controls (and the global input rule already does 16px — remove the 14px override).
- **A13 (MAJOR)** — G2 applies to the login buttons, Save button, and select.
- **A14 (MINOR)** — `.save-note` and login `.err` (admin/page.tsx:206, 338-346) have no `role="alert"`/`aria-live`.
- **A15 (MINOR)** — Status `<select>` (admin/page.tsx:268-280) shows current + next legal status (good UX, mirrors `NEXT_STATUS`), but when a request is terminal (`paid`/`declined`) the select has a single option and is still focusable/interactive — could be a read-only label instead.

## 4.5 Responsiveness 390px → desktop
- **A16 (MAJOR)** — `.admin-row` uses `grid-template-columns: 1.6fr 1fr 1fr` (globals.css:623-630) and only collapses at 640px (908-910). Between 641-1000px (and especially with the `maxWidth: 1100` at admin/page.tsx:221) the three columns + 14px inputs are cramped.
  - **Fix:** collapse to one column at a tablet breakpoint (~960px) and let the edit/actions stack.
- **A17 (MAJOR)** — A12's 14px font also causes iOS input zoom on the admin edit fields specifically (the worst offender for mobile admin use).
- **A18 (MINOR)** — `admin/page.tsx:221` uses inline `style={{ maxWidth: 1100 }}` to override `.panel` (max-width 860px). Extract a `.panel--wide` modifier.

---

# REVAMP PLAN

## 1. Proposed design tokens (keep dark + minimal + Inter)

```css
:root {
  color-scheme: dark;

  /* Color */
  --bg: #0a0c11;
  --surface: #10131b;
  --surface-2: #151926;
  --border: rgba(255, 255, 255, 0.07);
  --border-strong: rgba(255, 255, 255, 0.13);
  --text: #f4f6fb;
  --muted: #98a2b8;          /* secondary — passes AA */
  --faint: #7a8498;          /* tertiary — bumped from #667085 to pass 4.5:1 */
  --placeholder: #7a8498;    /* or a dedicated tone ≥4.5:1 */
  --accent: #7c8cff;
  --accent-deep: #5d6ef3;
  --on-accent: #0a0c11;      /* text on white/primary */
  --primary: #ffffff;        /* solid primary button surface */
  --success: #4ade80;
  --warning: #f5c14b;
  --danger: #f97066;

  /* Type scale (Inter) */
  --fs-xs: 0.75rem;   /* 12 */
  --fs-sm: 0.8125rem; /* 13 */
  --fs-base: 0.9375rem; /* 15 */
  --fs-md: 1rem;      /* 16 */
  --fs-lg: 1.125rem;  /* 18 */
  --fs-xl: 1.25rem;   /* 20 */
  --fs-2xl: 1.5rem;   /* 24 */
  --fs-3xl: 2rem;     /* 32 */
  --fs-4xl: 2.5rem;   /* 40 */
  --fs-hero: clamp(2.5rem, 6.4vw, 4.2rem);
  --leading: 1.6;

  /* Spacing scale (4px base) */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 24px;
  --space-8: 32px; --space-10: 40px; --space-12: 48px;
  --space-16: 64px; --space-24: 96px;

  /* Radii */
  --radius-sm: 8px;   --radius-md: 10px;  --radius-lg: 14px;
  --radius-xl: 20px;  --radius-pill: 999px;

  /* Shadows */
  --shadow-focus: 0 0 0 3px rgba(124, 140, 255, 0.14);
  --shadow-raise: 0 8px 24px rgba(255, 255, 255, 0.12);
  --shadow-card: 0 30px 80px rgba(0, 0, 0, 0.45);
}
```

Rationale: tokenizes every raw literal found in the audit (G1, G7, G8), adds `color-scheme: dark` (G3), a WCAG-passing `--faint`/`--placeholder` (G1), and a `--shadow-focus` to power the new focus-visible rule (G2).

## 2. Shared components / CSS patterns to extract

| Component | Replaces | Kills duplication / fixes |
|---|---|---|
| `Button` (variants: `primary`, `ghost`, `secondary`; sizes `sm/md`; `loading`, `disabled`) | `.btn`, `.btn-primary`, `.btn-ghost`, `.wbtn`, `.wbtn-next`, `.logout-btn`, decision buttons | O4, P9, A6, G2 |
| `Field` (label + input + hint + error, auto `id`/`htmlFor`, `aria-invalid`/`aria-describedby`) | `.field`, `.admin-edit` inputs, raw labels | O11, O14, P13, A11, G1 |
| `AuthForm` (login/register, email+password, busy state) | portal login (165-207) + admin login (190-215) | P4, A4, P12, A10 |
| `StatusBadge` (single status→color map from `lib.ts`) | `.badge.*` classes + inline Admin badge | P6, A2 |
| `Card` (surface card + kicker/title/body/meta) | `.card`, `.price-card` | L6 |
| `Nav` (+ mobile menu) | all four nav instances | L17, O22, A5 |
| `ProgressSteps` (accessible progressbar + "Step N of M") | `.progress` markup | O9 |
| `EmptyState`, `LoadingState`, `ErrorBanner` (with `role="status"`/`alert`) | `.empty`, `.loading`, `.err` blocks | P11, A8, A14 |
| `PageShell` (`panel`, `panel--wide`, `panel-card`, `wizard-shell`) | `.panel`, `.panel-card`, `.wizard-shell`, inline maxWidths | O1, A18 |

## 3. Ordered work items (highest impact first)

1. **Design tokens + global fixes (G1-G11).** Replace raw colors/radii/spacing/shadows with the token set; add `color-scheme: dark`, `:focus-visible`, `overflow-x: clip`, `scroll-margin-top`, skip link, and bump `--faint`/placeholder contrast.
   → Fixes: G1, G2, G3, G4, G5, G6, G7, G8, G9, and every `--faint` contrast issue (L11, O11 placeholder, P11, etc.).

2. **Extract `Button`, `Field`, `AuthForm`, `StatusBadge` components and adopt them everywhere.** This single refactor removes the `.btn`/`.wbtn` split, empty-label fields, duplicated auth forms, and inconsistent badges, and bakes in focus-visible + disabled/loading states.
   → Fixes: O4, O11, O14, P4, P5, P12, P13, A4, A10, A11, P6, A2, G2.

3. **Fix order-wizard correctness + accessibility.** Correct the progress bar math + ARIA (`role="progressbar"`), wrap in `<form>`, add visible labels, per-field `aria-invalid`, selected-state on choices, and a review step or summary echo.
   → Fixes: O9, O10, O11, O13, O14, O19, O20.

4. **Fix admin data-integrity bugs.** Discriminated save-state (`saving/saved/error`) instead of `.includes("fail")`, disable Save while saving, add logout.
   → Fixes: A7 (BLOCKER), A6, A5, A8.

5. **Fix portal session/state bugs.** Add the `booted` gate (kill login flash), clear `loadErr` on successful loads, disable Accept/Decline while in flight, format RM + dates.
   → Fixes: P7, P8, P9, P2, P3.

6. **Responsive breakpoint pass.** Collapse `.req-row`/`.admin-row` at tablet widths (~860-960px), raise admin inputs to 16px, fix tap targets, add mobile nav menu.
   → Fixes: P17, P18, A16, A17, L17, L18.

7. **Polish + semantic cleanup.** Add `aria-live` to status/save/error regions, `aria-hidden` on decorative glyphs, success-screen "Back to site", empty-state link styling, heading hierarchy, and remove inline styles.
   → Fixes: O1, O2, O7, O15, O22, O23, P1, P5, P10, P15, A1, A3, A14, A15, L1-L4, L14.

---

*End of audit. No files were modified other than this document.*
