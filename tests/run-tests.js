/* Tests for hour totals, renewal-window math, deadline nudges, CSV, validation.
   Run: node tests/run-tests.js
   Logic is extracted from the single-file app (index.html) so the app stays one file. */
"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const match = /\/\* CEU-LOGIC-START \*\/([\s\S]*?)\/\* CEU-LOGIC-END \*\//.exec(html);
if (!match) {
  console.error("FAIL - could not find CEU-LOGIC markers in index.html");
  process.exit(1);
}
const sandboxModule = { exports: {} };
const fakeWindow = {};
new Function("module", "window", match[1] + "\nreturn module.exports;")(sandboxModule, fakeWindow);
const CEU = sandboxModule.exports;

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log("  ok - " + name); }
  catch (e) { failed++; console.error("  FAIL - " + name + ": " + e.message); }
}

function e(hours, extra) {
  return Object.assign({
    id: "x", date: "2026-06-15", topic: "Stroke basics", provider: "AHA",
    hours: hours, category: "Direct patient care / clinical", certNote: "pdf in CE folder"
  }, extra || {});
}

const SETTINGS = { hoursNeeded: 30, windowStart: "2026-01-01", windowDeadline: "2027-12-31" };
function nudge(hours, daysLeftFrom, todayStr, extra) {
  return CEU.deadlineNudge([e(hours)], Object.assign({}, SETTINGS, { today: todayStr }, extra || {}));
}

function parseCSV(csv) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (inQ) {
      if (c === '"') {
        if (csv[i + 1] === '"') { field += '"'; i++; }
        else { inQ = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ',') {
      row.push(field); field = "";
    } else if (c === '\r') {
      row.push(field); field = "";
      rows.push(row); row = [];
      if (csv[i + 1] === '\n') i++;
    } else if (c === '\n') {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

console.log("Hour totals");

t("empty array totals 0", () => {
  assert.strictEqual(CEU.totalHours([]), 0);
});
t("single entry totals its hours", () => {
  assert.strictEqual(CEU.totalHours([e(7.5)]), 7.5);
});
t("multiple entries sum correctly", () => {
  assert.strictEqual(CEU.totalHours([e(8), e(6), e(4)]), 18);
});
t("floating point drift is fixed (0.1 + 0.2 = 0.3)", () => {
  assert.strictEqual(CEU.totalHours([e(0.1), e(0.2)]), 0.3);
});
t("non-array input returns 0", () => {
  assert.strictEqual(CEU.totalHours(null), 0);
});
t("bad hour values are ignored", () => {
  assert.strictEqual(CEU.totalHours([e(5), e("abc"), e(undefined)]), 5);
});

console.log("Renewal-window math");

t("entries inside window count", () => {
  assert.strictEqual(CEU.hoursInWindow([e(8)], "2026-01-01", "2027-12-31"), 8);
});
t("entries before window start do not count", () => {
  assert.strictEqual(CEU.hoursInWindow([e(8, { date: "2025-12-31" })], "2026-01-01", "2027-12-31"), 0);
});
t("window start date itself is inclusive", () => {
  assert.strictEqual(CEU.hoursInWindow([e(4, { date: "2026-01-01" })], "2026-01-01", "2027-12-31"), 4);
});
t("window deadline date itself is inclusive", () => {
  assert.strictEqual(CEU.hoursInWindow([e(4, { date: "2027-12-31" })], "2026-01-01", "2027-12-31"), 4);
});
t("entries after deadline do not count", () => {
  assert.strictEqual(CEU.hoursInWindow([e(8, { date: "2028-01-01" })], "2026-01-01", "2027-12-31"), 0);
});
t("mixed entries count only the in-window ones", () => {
  const list = [e(8), e(6, { date: "2025-06-01" }), e(2, { date: "2028-03-01" }), e(1.5)];
  assert.strictEqual(CEU.hoursInWindow(list, "2026-01-01", "2027-12-31"), 9.5);
});
t("invalid window dates count nothing (fail closed)", () => {
  assert.strictEqual(CEU.hoursInWindow([e(8)], "not-a-date", "2027-12-31"), 0);
});
t("hours by category bucket groups correctly", () => {
  const byCat = CEU.hoursByCategory([e(8), e(2, { category: "Pharmacology" }), e(3)]);
  assert.deepStrictEqual(byCat, { "Direct patient care / clinical": 11, "Pharmacology": 2 });
});
t("entries with non-bucket category group under the stored value", () => {
  const byCat = CEU.hoursByCategory([e(2, { category: "Mystery bucket" })]);
  assert.deepStrictEqual(byCat, { "Mystery bucket": 2 });
});

console.log("Progress bar");

t("progress 0% with empty log", () => {
  assert.strictEqual(CEU.progressPercent([], 30), 0);
});
t("progress 50% at 15/30", () => {
  assert.strictEqual(CEU.progressPercent([e(15)], 30), 50);
});
t("progress caps at 100%", () => {
  assert.strictEqual(CEU.progressPercent([e(40)], 30), 100);
});
t("progress is one decimal (e.g. 12.5%)", () => {
  assert.strictEqual(CEU.progressPercent([e(3.75)], 30), 12.5);
});
t("progress uses default needed when omitted", () => {
  assert.strictEqual(CEU.progressPercent([e(30)]), 100);
});
t("hours remaining is clamped at 0", () => {
  assert.strictEqual(CEU.hoursRemaining([e(40)], 30), 0);
});
t("hours remaining rounds to 2 decimals", () => {
  assert.strictEqual(CEU.hoursRemaining([e(12.33)], 30), 17.67);
});

console.log("Deadline nudge math (deterministic today)");

t("days remaining computed on calendar days", () => {
  const n = CEU.deadlineNudge([], Object.assign({}, SETTINGS, { today: "2026-10-27" }));
  assert.strictEqual(n.daysRemaining, 430);
});
t("basic remaining-hours math: 10 of 30 -> 20 remaining", () => {
  const n = nudge(10, 0, "2026-10-15");
  assert.strictEqual(n.inWindowHours, 10);
  assert.strictEqual(n.hoursRemaining, 20);
  assert.strictEqual(n.status, "active");
});
t("pace per day: 20 hours over 100 days = 0.2", () => {
  const n = CEU.deadlineNudge([e(10, { date: "2026-03-01" })], Object.assign({}, SETTINGS, {
    today: "2026-02-01", windowDeadline: "2026-05-12"
  }));
  assert.strictEqual(n.daysRemaining, 100);
  assert.strictEqual(n.perDay, 0.2);
});
t("pace per week: 20 hours over 100 days = 1.4", () => {
  const n = CEU.deadlineNudge([e(10, { date: "2026-03-01" })], Object.assign({}, SETTINGS, {
    today: "2026-02-01", windowDeadline: "2026-05-12"
  }));
  assert.strictEqual(n.perWeek, 1.4);
});
t("pace per month: 20 hours over 100 days = 6.09", () => {
  const n = CEU.deadlineNudge([e(10, { date: "2026-03-01" })], Object.assign({}, SETTINGS, {
    today: "2026-02-01", windowDeadline: "2026-05-12"
  }));
  assert.strictEqual(n.perMonth, 6.09);
});
t("deadline day with hours remaining is due-today and pace is null", () => {
  const n = nudge(10, 0, "2027-12-31");
  assert.strictEqual(n.daysRemaining, 0);
  assert.strictEqual(n.status, "due-today");
  assert.strictEqual(n.perDay, null);
  assert.strictEqual(n.perWeek, null);
});
t("deadline passed -> expired even if hours penciled in", () => {
  const n = nudge(10, 0, "2028-01-01");
  assert.strictEqual(n.daysRemaining, -1);
  assert.strictEqual(n.status, "expired");
});
t("met status when logged hours cover the requirement", () => {
  const n = nudge(30, 0, "2026-10-27");
  assert.strictEqual(n.hoursRemaining, 0);
  assert.strictEqual(n.status, "met");
});
t("met status wins over active even on day 0", () => {
  const n = nudge(30, 0, "2027-12-31");
  assert.strictEqual(n.status, "met");
});
t("hours outside window do not satisfy the requirement", () => {
  const n = CEU.deadlineNudge(
    [e(35, { date: "2025-06-01" })],
    Object.assign({}, SETTINGS, { today: "2026-10-27" })
  );
  assert.strictEqual(n.inWindowHours, 0);
  assert.strictEqual(n.status, "active");
  assert.strictEqual(n.hoursRemaining, 30);
});
t("invalid dates -> invalid status, no NaN", () => {
  const n = CEU.deadlineNudge([e(10)], {
    today: "2026-10-27", windowStart: "2026-01-01", windowDeadline: "", hoursNeeded: 30
  });
  assert.strictEqual(n.status, "invalid");
  assert.strictEqual(n.perDay, null);
  assert.strictEqual(n.daysRemaining, null);
});
t("default hoursNeeded is 30 when missing", () => {
  const n = CEU.deadlineNudge([e(10)], {
    today: "2026-10-27", windowStart: "2026-01-01", windowDeadline: "2026-11-30", hoursNeeded: undefined
  });
  assert.strictEqual(n.hoursNeeded, 30);
  assert.strictEqual(n.hoursRemaining, 20);
});
t("day count is DST-safe (spring forward)", () => {
  const n = CEU.deadlineNudge([e(15)], Object.assign({}, SETTINGS, {
    today: "2027-03-10", windowDeadline: "2027-03-15"
  }));
  assert.strictEqual(n.daysRemaining, 5);
  assert.strictEqual(n.perDay, 3);
});

console.log("Validation");

t("valid entry passes and is normalized", () => {
  const r = CEU.validateEntry(e(7.5));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.hours, 7.5);
  assert.strictEqual(r.value.provider, "AHA");
});
t("missing topic rejected", () => {
  assert.strictEqual(CEU.validateEntry(e(8, { topic: "" })).ok, false);
});
t("missing provider rejected", () => {
  assert.strictEqual(CEU.validateEntry(e(8, { provider: "" })).ok, false);
});
t("missing date rejected", () => {
  assert.strictEqual(CEU.validateEntry(e(8, { date: "" })).ok, false);
});
t("malformed date rejected", () => {
  assert.strictEqual(CEU.validateEntry(e(8, { date: "06/15/26" })).ok, false);
  assert.strictEqual(CEU.validateEntry(e(8, { date: "2026-13-01" })).ok, false);
});
t("zero hours rejected", () => {
  assert.strictEqual(CEU.validateEntry(e(0)).ok, false);
});
t("negative hours rejected", () => {
  assert.strictEqual(CEU.validateEntry(e(-3)).ok, false);
});
t("hours over 40 rejected", () => {
  assert.strictEqual(CEU.validateEntry(e(40.25)).ok, false);
});
t("fractional hours allowed and rounded to 2 dp", () => {
  const r = CEU.validateEntry(e(7.125));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.value.hours, 7.13);
});
t("unknown category coerced to Other", () => {
  const r = CEU.validateEntry(e(8, { category: "Made-up" }));
  assert.strictEqual(r.value.category, "Other");
});
t("known category kept", () => {
  const r = CEU.validateEntry(e(8, { category: "Pharmacology" }));
  assert.strictEqual(r.value.category, "Pharmacology");
});
t("certificate note over 200 chars rejected", () => {
  assert.strictEqual(CEU.validateEntry(e(8, { certNote: "x".repeat(201) })).ok, false);
});
t("certificate note trimmed", () => {
  const r = CEU.validateEntry(e(8, { certNote: "  pdf saved  " }));
  assert.strictEqual(r.value.certNote, "pdf saved");
});

console.log("Settings validation");

t("default settings are a 2-year window ending Dec 31", () => {
  const s = CEU.defaultSettings("2026-10-27");
  assert.strictEqual(s.windowStart, "2026-01-01");
  assert.strictEqual(s.windowDeadline, "2028-12-31");
  assert.strictEqual(s.hoursNeeded, 30);
});
t("deadline before start rejected", () => {
  const r = CEU.validateSettings({ hoursNeeded: 30, windowStart: "2027-01-01", windowDeadline: "2026-12-31" });
  assert.strictEqual(r.ok, false);
});
t("zero hoursNeeded rejected", () => {
  const r = CEU.validateSettings({ hoursNeeded: 0, windowStart: "2026-01-01", windowDeadline: "2027-12-31" });
  assert.strictEqual(r.ok, false);
});
t("same-day window is allowed", () => {
  const r = CEU.validateSettings({ hoursNeeded: 30, windowStart: "2026-01-01", windowDeadline: "2026-01-01" });
  assert.strictEqual(r.ok, true);
});

console.log("CSV export");

t("header row is exact", () => {
  const csv = CEU.toCSV([]);
  assert.strictEqual(csv.split("\r\n")[0], "Date,Topic,Provider,Hours,Category,Certificate Note");
});
t("fields are joined in order", () => {
  const csv = CEU.toCSV([e(1.5)]);
  const line = csv.split("\r\n")[1];
  assert.strictEqual(line, "2026-06-15,Stroke basics,AHA,1.5,Direct patient care / clinical,pdf in CE folder");
});
t("commas force quoting", () => {
  const csv = CEU.toCSV([e(2, { topic: "Ethics, law, and you" })]);
  const line = csv.split("\r\n")[1];
  assert.strictEqual(line, "2026-06-15,\"Ethics, law, and you\",AHA,2,Direct patient care / clinical,pdf in CE folder");
});
t("quotes are doubled inside quoted fields", () => {
  const csv = CEU.toCSV([e(2, { topic: 'Say "hello" now' })]);
  const line = csv.split("\r\n")[1];
  assert.ok(line.indexOf('"Say ""hello"" now"') >= 0, "double-quote escaping");
});
t("newlines force quoting and stay inside the field", () => {
  const csv = CEU.toCSV([e(2, { certNote: "line1\nline2" })]);
  const rows = parseCSV(csv);
  assert.strictEqual(rows.length, 2);
  const field = rows[1][5];
  assert.match(field, /^line1\r?\nline2$/, "embedded newline survives inside the quoted field");
});
t("tricky CSV round-trips through an RFC 4180-style parser", () => {
  const rowEntry = e(2, {
    topic: 'Ethics, "the quotes", and commas',
    provider: "Provider, Inc",
    certNote: "Saved 2026.\r\nSecond line, with, commas"
  });
  const rows = parseCSV(CEU.toCSV([rowEntry]));
  assert.strictEqual(rows.length, 2);
  const r = rows[1];
  const HEADER = 6;
  assert.strictEqual(r.length, HEADER);
  assert.strictEqual(r[0], "2026-06-15");
  assert.strictEqual(r[1], 'Ethics, "the quotes", and commas');
  assert.strictEqual(r[2], "Provider, Inc");
  assert.strictEqual(r[5], "Saved 2026.\r\nSecond line, with, commas");
});
t("rows sort chronologically oldest first", () => {
  const csv = CEU.toCSV([e(2, { date: "2026-09-01" }), e(4, { date: "2026-01-01" })]);
  const rows = csv.split("\r\n");
  assert.strictEqual(rows[1].startsWith("2026-01-01"), true);
  assert.strictEqual(rows[2].startsWith("2026-09-01"), true);
});

console.log("De-identified summary");

t("placeholders only - no real names or identifiers", () => {
  const s = CEU.summaryData([e(8)], SETTINGS);
  assert.strictEqual(s.nameLine, "[Your Name]");
  assert.ok(s.licenseLine.indexOf("left blank") >= 0);
  assert.ok(!("provider" in s), "no provider details in summary");
  assert.ok(!("topic" in s), "no topic details in summary");
});
t("summary carries totals, percent, count and disclaimer", () => {
  const list = [e(10), e(5, { category: "Pharmacology" })];
  const s = CEU.summaryData(list, SETTINGS);
  assert.strictEqual(s.totalHours, 15);
  assert.strictEqual(s.percent, 50);
  assert.strictEqual(s.entryCount, 2);
  assert.ok(s.disclaimer.indexOf("licensure advice") >= 0);
});
t("empty log summary is safe", () => {
  const s = CEU.summaryData([], SETTINGS);
  assert.strictEqual(s.totalHours, 0);
  assert.strictEqual(s.entryCount, 0);
});

console.log("Date utilities");

t("localIsoDate formats zero-padded", () => {
  assert.strictEqual(CEU.localIsoDate(new Date(2026, 2, 4)), "2026-03-04");
});
t("daysBetween is DST-safe across a spring-forward gap", () => {
  assert.strictEqual(CEU.daysBetween("2027-03-10", "2027-03-15"), 5);
});
t("daysBetween handles leap Feb", () => {
  assert.strictEqual(CEU.daysBetween("2028-02-27", "2028-03-02"), 4);
});
t("formatHours keeps trailing style tidy", () => {
  assert.strictEqual(CEU.formatHours(18), "18");
  assert.strictEqual(CEU.formatHours(18.5), "18.5");

  assert.strictEqual(CEU.formatHours(4.42), "4.42");
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
