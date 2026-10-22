// Builds "Final Project Report.pdf" from report.template.html and details.json.
//
//   node Documentation/report/build.cjs
//
// Fill in the highlighted fields in details.local.json (copy the keys you need
// from details.json; anything still containing
// "TO FILL" is shown highlighted in the PDF and listed here), then re-run.
// Needs Google Chrome or Microsoft Edge installed; the PDF is printed by a
// headless browser so it matches what the HTML looks like.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = __dirname;
// details.local.json (git-ignored) overrides details.json, so test-account
// passwords never need to be committed.
const localFile = path.join(dir, "details.local.json");
const details = {
  ...JSON.parse(fs.readFileSync(path.join(dir, "details.json"), "utf8")),
  ...(fs.existsSync(localFile) ? JSON.parse(fs.readFileSync(localFile, "utf8")) : {}),
};
let html = fs.readFileSync(path.join(dir, "report.template.html"), "utf8");

const escape = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const missing = [];
html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
  if (!(key in details)) throw new Error(`details.json has no "${key}"`);
  const value = String(details[key]);
  if (/TO FILL/i.test(value)) {
    missing.push(`${key}: ${value}`);
    return `<mark>${escape(value)}</mark>`;
  }
  return escape(value);
});

const out = path.join(dir, "report.html");
fs.writeFileSync(out, html);

const candidates = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];
const browser = candidates.find((p) => fs.existsSync(p));
if (!browser) throw new Error("Install Google Chrome or Microsoft Edge to print the PDF.");

const pdf = path.join(dir, "..", "Final Project Report.pdf");
const profile = fs.mkdtempSync(path.join(require("os").tmpdir(), "w360-report-"));
const run = spawnSync(
  browser,
  [
    "--headless=new",
    "--disable-gpu",
    `--user-data-dir=${profile}`,
    "--no-pdf-header-footer",
    "--virtual-time-budget=20000",
    `--print-to-pdf=${pdf}`,
    "file:///" + out.replace(/\\/g, "/"),
  ],
  { encoding: "utf8" }
);
if (!fs.existsSync(pdf)) throw new Error("PDF was not created.\n" + run.stderr);
fs.rmSync(profile, { recursive: true, force: true });

console.log("Wrote", path.resolve(pdf), `(${Math.round(fs.statSync(pdf).size / 1024)} KB)`);
if (missing.length) {
  console.log("\nStill to fill in details.json (shown highlighted in the PDF):");
  missing.forEach((m) => console.log("  -", m));
}
