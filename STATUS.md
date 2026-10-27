# STATUS.md — CE Hours Tracker

## What was built

`ceu-hours-tracker-webapp` — an education-only web app for licensed nurses tracking their own
continuing-education hours. Entirely local-first, per the brief: a **single file** (`index.html`)
containing markup, styles, logic, and UI. Zero dependencies, no build step, works offline from
`file://`; everything persists in the browser's localStorage.

Features:
- Course entries: date completed, topic (120ch), provider (80ch), contact hours (0–40, clean
  2-decimal math, UI step 0.25), category bucket, certificate note (200ch, "where you filed it")
- 8 fixed category buckets (clinical, pharmacology, safety & infection control, ethics/law,
  patient education, professional development, informatics, other) with per-bucket hour totals
- Renewal-window settings: hours needed (default 30), window start, renewal deadline — validated
  (deadline ≥ start, 1–10000 hours); entries must be dated inside the window to count
- Renewal-window progress bar (percent of requirement, capped at 100, one decimal) plus all-time total
- Deadline nudge math (see tests): days remaining, hours remaining, and pace → per-day / per-week /
  per-month hours needed; states: active, met, due-today, expired, invalid-settings
- Printable de-identified summary: totals and category totals only — topics, providers, notes,
  and personal identifiers are structurally excluded; [Your Name] placeholders to fill in by hand
- CSV export (RFC 4180: comma/quote/newline escaping, CRLF, UTF-8 BOM) and JSON backup export/import
- Filterable, searchable log with edit and delete; entry count with in/out-of-window breakdown
- Disclaimers everywhere: header banner, notes section, footer, inside the printed summary
- Design guardrails: "no personal identifiers" guidance in every data-entry field; validation
  rejects bad hours/dates; floating-point drift fixed (0.1 + 0.2 logs as 0.3)
- Accessibility: skip link, labels, progressbar role with live values, aria-live status messages
- Sister projects (kept deliberately distinct): `clinical-rotation-log-webapp` is for nursing
  students' rotation logs; `nclex-style-quiz-trainer` is exam prep. From Asdale Dynamics, LLC —
  education only, never medical or licensure advice.

## How to run

- App: open `index.html` in any modern browser (double-click, or `file://` path). No install, no build.
- Tests (Node.js required): `node tests/run-tests.js`
- The test file extracts the pure-logic layer from `index.html` (between `CEU-LOGIC-START` /
  `CEU-LOGIC-END` markers) so the app stays a single file while remaining unit-testable.

## Verification results

- `node tests/run-tests.js` → **66 passed, 0 failed**, covering: hour totals (incl. float drift,
  invalid values), renewal-window inclusion boundaries (start/deadline inclusive; fail-closed on
  bad dates), per-bucket totals, progress cap/rounding, remaining-hours rounding, deadline math
  (430- and 796-day cases, per-day/week/month paces = 0.2/1.4/6.09 over a verified 100-day span,
  due-today, expired, met states, DST-safe day counts incl. leap-Feb), entry + settings
  validation, CSV escaping (commas, doubled quotes, embedded newlines round-tripping through a
  mini RFC 4180 parser), and de-identified summary guarantees
- `node --check` on the extracted inline script → syntax OK (one script block, 29,263 chars)
- Headless Chrome (`--headless=new --dump-dom` on `index.html`) → exit 0; app boots, renders 8
  category options, progress label, and a correct nudge line ("…to go by Dec 31, 2028 (796 days
  left). Paces: 0.04 hr/day · 0.26 hr/week…"); no JS errors
- Browser-level integration self-test (headless Chrome with a temporary DOM-driving harness):
  form submission saves a real entry to localStorage → progress label
  "7.5 of 30 hours logged in this window (25%)", bar width 25%, nudge math updates
  ("22.5 hours to go…"); invalid input (99 hours) rejected — log count stays at the saved entry.
  Two test-harness bugs (harness injected over a `</body>` inside a JS string; wrong expected
  values in test math) were caught and fixed during verification; one logic hardening also
  resulted (CSV field newlines are now normalized to inline CRLF per RFC 4180).

## Known gaps

- No CSP meta tag; static hosting can add headers, and `file://` can't set them anyway
- No service-worker/offline caching (the single file already works from disk, but a SW would add
  install-offline for hosted copies)
- localStorage only — no IndexedDB fallback; quota/private-mode errors are surfaced, not solved
- Printable summary opens a popup window — blocked popups need user permission
- Category buckets are fixed (8); no custom bucket input
- No per-category requirements (some boards mandate minimums inside buckets); totals only
- Print summary is the only de-identified output; the CSV/JSON exports intentionally carry the
  user's own full entries (they're local backups, not shareable)
- Import replaces the log after confirmation; no merge mode
- Tests cover the logic layer plus one DOM-driving harness run; no full E2E suite
- Accessibility basics implemented but not formally audited
