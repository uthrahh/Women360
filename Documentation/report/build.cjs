// Builds "Final Project Report.pdf" from report.template.html and details.json.
//
//   node Documentation/report/build.cjs
//
// Edit details.json (or put overrides in a git-ignored details.local.json) and
// re-run. Anything still containing "TO FILL" is highlighted in the PDF and
// listed here. Put the college logo at img/vit-logo.png (or .jpg/.svg).
//
// Needs Google Chrome or Microsoft Edge to print the PDF. The contents page is
// linked to the sections; its page numbers are filled in by a second pass that
// reads the first PDF (this needs Python with PyMuPDF; without it the links
// still work and the numbers are left out).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const dir = __dirname;
const localFile = path.join(dir, "details.local.json");
const details = {
  ...JSON.parse(fs.readFileSync(path.join(dir, "details.json"), "utf8")),
  ...(fs.existsSync(localFile) ? JSON.parse(fs.readFileSync(localFile, "utf8")) : {}),
};
const template = fs.readFileSync(path.join(dir, "report.template.html"), "utf8");
const escape = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
const htmlFile = path.join(dir, "report.html");

function logoMarkup(missing) {
  const found = ["png", "jpg", "jpeg", "svg"].map((e) => `img/vit-logo.${e}`).find((p) => fs.existsSync(path.join(dir, p)));
  // The official logo is white artwork made for dark backgrounds, so it sits on a dark band.
  if (found) return `<div class="logo-band"><img class="logo" src="${found}" alt="VIT Chennai logo"></div>`;
  missing.push("logo: save the VIT Chennai logo as Documentation/report/img/vit-logo.png");
  return `<mark>[VIT CHENNAI LOGO: add img/vit-logo.png]</mark>`;
}

// Section headings get an id so the contents page can link to them.
function withIds(html) {
  const sections = [];
  const out = html.replace(/<h2>(\d+)\. ([^<]+)<\/h2>/g, (_, n, title) => {
    sections.push({ id: `s${n}`, n, title });
    return `<h2 id="s${n}">${n}. ${title}</h2>`;
  });
  return { html: out, sections };
}

function render(pages, missing) {
  let html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key === "LOGO") return logoMarkup(missing);
    if (key === "TOC") return "@@TOC@@";
    if (!(key in details)) throw new Error(`details.json has no "${key}"`);
    const value = String(details[key]);
    if (/TO FILL/i.test(value)) {
      missing.push(`${key}: ${value}`);
      return `<mark>${escape(value)}</mark>`;
    }
    return escape(value);
  });
  const { html: withAnchors, sections } = withIds(html);
  const toc = sections
    .map((s) => `    <li><a href="#${s.id}"><span><span class="num">${s.n}.</span>${s.title}</span><span class="pg">${pages[s.id] ?? ""}</span></a></li>`)
    .join("\n");
  return { html: withAnchors.replace("@@TOC@@", toc), sections };
}

function print(html) {
  fs.writeFileSync(htmlFile, html);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "w360-report-"));
  const run = spawnSync(
    browser,
    [
      "--headless=new",
      "--disable-gpu",
      `--user-data-dir=${profile}`,
      "--no-pdf-header-footer",
      "--virtual-time-budget=20000",
      `--print-to-pdf=${pdf}`,
      "file:///" + htmlFile.replace(/\\/g, "/"),
    ],
    { encoding: "utf8" }
  );
  fs.rmSync(profile, { recursive: true, force: true });
  if (!fs.existsSync(pdf)) throw new Error("PDF was not created.\n" + run.stderr);
}

// Page on which each numbered section starts (the first page after the contents).
function findPages(sections) {
  const script = [
    "import pymupdf, json, sys",
    "d = pymupdf.open(sys.argv[1])",
    "wanted = json.loads(sys.argv[2])",
    "out = {}",
    "for i in range(2, len(d)):",
    "    lines = [l.strip() for l in d[i].get_text().splitlines()]",
    "    for w in wanted:",
    "        if w['id'] not in out and w['text'] in lines:",
    "            out[w['id']] = i + 1",
    "print(json.dumps(out))",
  ].join("\n");
  const wanted = JSON.stringify(sections.map((s) => ({ id: s.id, text: `${s.n}. ${s.title.replace(/&amp;/g, "&")}` })));
  const run = spawnSync("python", ["-I", "-c", script, pdf, wanted], { encoding: "utf8" });
  if (run.status !== 0) return null;
  try {
    return JSON.parse(run.stdout.trim());
  } catch {
    return null;
  }
}

const missing = [];
let { html, sections } = render({}, missing);
print(html);

let pages = findPages(sections);
if (pages) {
  for (let pass = 0; pass < 3; pass++) {
    ({ html } = render(pages, []));
    print(html);
    const again = findPages(sections);
    if (!again || JSON.stringify(again) === JSON.stringify(pages)) break;
    pages = again;
  }
} else {
  console.log("Contents page numbers skipped (Python with PyMuPDF not found); the links still work.");
}

console.log("Wrote", path.resolve(pdf), `(${Math.round(fs.statSync(pdf).size / 1024)} KB)`);
if (missing.length) {
  console.log("\nStill to fill in (shown highlighted in the PDF):");
  [...new Set(missing)].forEach((m) => console.log("  -", m));
}
