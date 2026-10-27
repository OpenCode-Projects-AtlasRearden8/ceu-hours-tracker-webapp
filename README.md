# CE Hours Tracker

A friendly, education-only web app for licensed nurses to track their own continuing-education
hours. Plain HTML/JS/CSS in a **single file** — zero dependencies, works offline straight from
`file://`, and every bit of data stays in your browser's localStorage.

Part of the beginner-friendly education family from [Asdale Dynamics, LLC](https://dylanasdale.github.io).
It is intentionally separate from sister projects: *clinical-rotation-log-webapp* is for nursing
**students** logging school rotations, and *nclex-style-quiz-trainer* is exam prep. This one is for
working nurses keeping an eye on their own CE buckets.

## Important: education only, never licensure advice

This app is a personal notebook. It does **not** verify, approve, or certify any hours, it is not
an official hours record, and it is never medical, legal, or licensure advice. Your state board of
nursing or certifying body is the sole authority on what counts toward renewal — requirements,
hour minimums, and eligible course categories vary by state and credential. Verify everything
independently before relying on any total here.

**Keep it de-identified, too.** Don't enter license numbers, SSNs, patient details, or other
personal identifiers — the printable summary is de-identified by design, and there's nothing in
the app that needs those.

## What it does

- **Course entries** — date completed, topic, provider, contact hours (up to 40, fractional to
  0.25 turned into clean 2-decimal math), category bucket, and a short certificate note
  (where you filed the cert — 200 chars max)
- **Category buckets** — eight fixed buckets (clinical, pharmacology, safety & infection control,
  ethics, patient education, professional development, informatics, other) with hour totals each
- **Renewal-window settings** — hours needed (default 30), window start, and renewal deadline;
  only entries dated inside the window count toward the progress bar
- **Progress bar** — percent of your requirement logged in the current window, plus an all-time total
- **Deadline nudge math** — hours remaining, days remaining, and a pace line: hours per day, per
  week, and per month to land the requirement before the deadline; special states for
  requirement met, due today, expired window, and broken settings
- **Printable de-identified summary** — totals and category buckets only (no topics, providers,
  notes, names, or identifiers), with name/license placeholders to fill in by hand after printing
- **CSV export** — RFC 4180-clean spreadsheet file of all entries, commas/quotes/newlines escaped
- **JSON backup + import** — export your whole log and settings; import replaces with confirmation
- **Filterable log** — search by topic/provider/note and filter by category; edit or delete entries
- **Disclaimers everywhere** — header banner, dedicated notes section, printed summary, and footer
- **Local-only** — no accounts, no servers, no analytics, no network calls; localStorage only

## How to run

No install, no build step, no account:

1. Download or clone this folder
2. Open `index.html` in any modern browser (double-click it)

It works fully offline from `file://` — the whole app is that one file.

To run the logic tests (Node.js required):

```
node tests/run-tests.js
```

## Project layout

| File | Purpose |
|---|---|
| `index.html` | The entire app: markup, styles, logic, and UI in one file |
| `tests/run-tests.js` | 66 tests for hour totals, renewal-window and deadline math, CSV, validation |
| `README.md` | This file |
| `LICENSE` | MIT License |
| `STATUS.md` | Build status, verification results, known gaps |

The pure logic layer lives inside `index.html` between `CEU-LOGIC-START` / `CEU-LOGIC-END`
markers; the test file extracts those functions so the app itself stays a single file.

## Privacy

- Everything is stored in your browser's localStorage on your device
- No network calls, no analytics, no accounts, no tracking
- Clearing browser data erases your log — use **Export JSON (backup)** regularly

## Credits

Built by **Asdale Dynamics, LLC** — healthcare-worker AI aids and education tools, education only,
never medical or licensure advice. See Dylan Asdale's hub at [dylanasdale.github.io](https://dylanasdale.github.io).

Licensed under the [MIT License](LICENSE).
