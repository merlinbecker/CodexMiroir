// sonar-radar.mjs
// Node >= 18 (fetch), ESM. Schlank, verständlich, mit dd.mm-Labels und relativen LOC.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/* ========= Konfiguration (ENV) ========= */
const SONAR_BASE   = process.env.SONAR_BASE   || "https://sonarcloud.io";
const SONAR_TOKEN  = process.env.SONAR_TOKEN;               // erforderlich
const PROJECT_KEY  = process.env.SONAR_PROJECT_KEY;         // erforderlich
const BRANCH       = process.env.SONAR_BRANCH || "main";
const OUTPUT_MD    = process.env.OUTPUT_MD    || "codequality/report.md";
const METRICS      = process.env.SONAR_METRICS
  || "security_rating,reliability_rating,sqale_rating,coverage,duplicated_lines_density,ncloc";
/** Vergangenheitsfenster: ab welcher Analyse anfangen (1 = vorletzte) */
const PREV_OFFSET  = Number.isFinite(+process.env.SONAR_PREV_OFFSET) ? Math.max(1, +process.env.SONAR_PREV_OFFSET) : 1;
/** Wie viele vergangene Analysen als Serien zeichnen */
const PREV_COUNT   = Number.isFinite(+process.env.SONAR_PREV_COUNT)  ? Math.max(1, +process.env.SONAR_PREV_COUNT)  : 1;

if (!SONAR_TOKEN || !PROJECT_KEY) {
  console.error("Fehlt: SONAR_TOKEN und/oder SONAR_PROJECT_KEY"); process.exit(2);
}

/* ========= Helfer ========= */
const AUTH = { Authorization: "Basic " + Buffer.from(`${SONAR_TOKEN}:`).toString("base64") };

async function fetchJson(url, fallback) {
  try {
    const res = await fetch(url, { headers: AUTH });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  } catch {
    return fallback;
  }
}

const val     = (arr, metric) => arr.find(x => x.metric === metric)?.value ?? "No data";
const histVal = (arr, metric) => arr.find(x => x.metric === metric)?.history?.[0]?.value ?? "No data";

const toRating5 = v => v && !isNaN(+v) ? Math.max(0, Math.min(5, 6 - parseInt(v, 10))) : 0; // A=1 → 5
const toPct5    = v => v && !isNaN(+v) ? Math.round(parseFloat(v) / 20) : 0;                  // 0..100 → 0..5

const emojiRate = v => ["❌","🟥","🟨","🟨","🟩","🟩"][v] ?? "❓";
const emojiDup  = v => v >= 4 ? "🟩" : v >= 2 ? "🟨" : "🟥";

const dateDE    = iso => { const d=new Date(iso), p=n=>String(n).padStart(2,"0"); return `${p(d.getUTCDate())}.${p(d.getUTCMonth()+1)}`; };
const shortLoc  = n => n > 999 ? (Math.round(n/100)/10)+"k" : String(n); // 1532 -> "15.3k", 950 -> "950"
const curveId   = s => "p_" + s.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 40);

/** Relative LOC-Score: min LOC → 5, max LOC → 1 (linear 1..5) */
function locScoreRelative(loc, minLoc, maxLoc) {
  if (minLoc === maxLoc) return 5;
  return Math.max(1, Math.min(5, 1 + Math.round(((maxLoc - loc) / (maxLoc - minLoc)) * 4)));
}

function buildVector(measures, locNum, pickFn, minLoc, maxLoc) {
  return {
    s: toRating5(pickFn(measures, "security_rating")),
    r: toRating5(pickFn(measures, "reliability_rating")),
    m: toRating5(pickFn(measures, "sqale_rating")),
    c: toPct5(pickFn(measures, "coverage")),
    d: 5 - toPct5(pickFn(measures, "duplicated_lines_density")),
    l: locScoreRelative(locNum, minLoc, maxLoc),
  };
}

/* ========= Hauptlogik ========= */
(async () => {
  // Aktuelle Metriken
  const curJson = await fetchJson(
    `${SONAR_BASE}/api/measures/component?component=${encodeURIComponent(PROJECT_KEY)}&metricKeys=${encodeURIComponent(METRICS)}`,
    { component: { measures: [] } }
  );
  const currentMeasures = curJson.component?.measures ?? [];
  const currentLoc = parseInt(val(currentMeasures, "ncloc") || "0", 10);

  // Analysen (neueste → älteste), großzügige Page-Size
  const analysesJson = await fetchJson(
    `${SONAR_BASE}/api/project_analyses/search?project=${encodeURIComponent(PROJECT_KEY)}&branch=${encodeURIComponent(BRANCH)}&ps=500`,
    { analyses: [] }
  );
  const analyses = (analysesJson.analyses || []).sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = analyses.length;

  // Fenster bestimmen: bei zu großem Offset auf die ältesten CNT einrasten
  let start = PREV_OFFSET;
  if (start >= total) start = Math.max(0, total - PREV_COUNT);
  const end = Math.min(start + PREV_COUNT - 1, Math.max(0, total - 1));
  const chosen = analyses.slice(start, end + 1).reverse(); // älteste → neueste

  // Vergangenheits-Serien samt LOC sammeln
  const pastSeries = [];
  const allLoc = [currentLoc];
  for (const a of chosen) {
    const t = a.date;
    const histJson = await fetchJson(
      `${SONAR_BASE}/api/measures/search_history?component=${encodeURIComponent(PROJECT_KEY)}&metrics=${encodeURIComponent(METRICS)}&from=${encodeURIComponent(t)}&to=${encodeURIComponent(t)}`,
      { measures: [] }
    );
    const measures = Array.isArray(histJson.measures) ? histJson.measures : [];
    const loc = parseInt(histVal(measures, "ncloc") || "0", 10);
    allLoc.push(loc);
    pastSeries.push({ date: t, loc, measures });
  }

  // Relative LOC-Skala berechnen
  const minLoc = Math.min(...allLoc);
  const maxLoc = Math.max(...allLoc);

  // Serien aufbauen
  const pastCurves = pastSeries.map(p => {
    const label = `${dateDE(p.date)} (${shortLoc(p.loc)} LOC)`;
    const vec = buildVector(p.measures, p.loc, histVal, minLoc, maxLoc);
    return `  curve ${curveId(label)}["${label}"]{${vec.s}, ${vec.r}, ${vec.m}, ${vec.c}, ${vec.d}, ${vec.l}}`;
  });

  const currentVec = buildVector(currentMeasures, currentLoc, val, minLoc, maxLoc);
  const currentLabel = `Aktuell (${shortLoc(currentLoc)} LOC)`;

  // Mermaid-Radar (Achsentitel kompakt)
  const mermaid = [
    "```mermaid",
    "---",
    'title: "Code Quality Metrics"',
    "---",
    "radar-beta",
    '  axis s["Sich"], r["Zuv"], m["Wart"], c["Abd"], d["Dupl"], l["LOC↓"]',
    ...pastCurves,
    `  curve ${curveId(currentLabel)}["${currentLabel}"]{${currentVec.s}, ${currentVec.r}, ${currentVec.m}, ${currentVec.c}, ${currentVec.d}, ${currentVec.l}}`,
    "  max 5",
    "  min 1",
    "```",
  ].join("\n");

  // Markdown
  const md = [
    "# Code Quality Report",
    "",
    "## Quality Metrics Radar",
    "",
    mermaid,
    "",
    "## Current Metrics",
    "",
    "| Metrik | Aktueller Wert | Bewertung |",
    "|--------|----------------|-----------|",
    `| Security Rating | ${val(currentMeasures,"security_rating")} | ${emojiRate(currentVec.s)} |`,
    `| Reliability Rating | ${val(currentMeasures,"reliability_rating")} | ${emojiRate(currentVec.r)} |`,
    `| Maintainability Rating | ${val(currentMeasures,"sqale_rating")} | ${emojiRate(currentVec.m)} |`,
    `| Coverage | ${val(currentMeasures,"coverage")}% | ${emojiRate(currentVec.c)} |`,
    `| Code Duplication | ${val(currentMeasures,"duplicated_lines_density")}% | ${emojiDup(currentVec.d)} |`,
    `| Lines of Code | ${currentLoc} | ${emojiRate(currentVec.l)} |`,
    "",
    "## SonarCloud Badges",
    "",
    `[![Quality Gate Status](${SONAR_BASE}/api/project_badges/measure?project=${encodeURIComponent(PROJECT_KEY)}&metric=alert_status)](${SONAR_BASE}/summary/new_code?id=${encodeURIComponent(PROJECT_KEY)})`,
    `[![Security Rating](${SONAR_BASE}/api/project_badges/measure?project=${encodeURIComponent(PROJECT_KEY)}&metric=security_rating)](${SONAR_BASE}/summary/new_code?id=${encodeURIComponent(PROJECT_KEY)})`,
    `[![Maintainability Rating](${SONAR_BASE}/api/project_badges/measure?project=${encodeURIComponent(PROJECT_KEY)}&metric=sqale_rating)](${SONAR_BASE}/summary/new_code?id=${encodeURIComponent(PROJECT_KEY)})`,
    `[![Reliability Rating](${SONAR_BASE}/api/project_badges/measure?project=${encodeURIComponent(PROJECT_KEY)}&metric=reliability_rating)](${SONAR_BASE}/summary/new_code?id=${encodeURIComponent(PROJECT_KEY)})`,
    "",
    `[![Coverage](${SONAR_BASE}/api/project_badges/measure?project=${encodeURIComponent(PROJECT_KEY)}&metric=coverage)](${SONAR_BASE}/summary/new_code?id=${encodeURIComponent(PROJECT_KEY)})`,
    `[![Duplicated Lines (%)](${SONAR_BASE}/api/project_badges/measure?project=${encodeURIComponent(PROJECT_KEY)}&metric=duplicated_lines_density)](${SONAR_BASE}/summary/new_code?id=${encodeURIComponent(PROJECT_KEY)})`,
    `[![Lines of Code](${SONAR_BASE}/api/project_badges/measure?project=${encodeURIComponent(PROJECT_KEY)}&metric=ncloc)](${SONAR_BASE}/summary/new_code?id=${encodeURIComponent(PROJECT_KEY)})`,
    "",
    `Generated on: ${new Date().toISOString()}`,
    "",
    `> Fenster: offset=${PREV_OFFSET}, count=${PREV_COUNT}. LOC relativ: min=${minLoc} → 5, max=${maxLoc} → 1. Labels: dd.mm (deutsch) + kurze LOC (k).`,
  ].join("\n");

  mkdirSync(dirname(OUTPUT_MD), { recursive: true });
  writeFileSync(OUTPUT_MD, md, "utf8");
  console.log(`✅ ${OUTPUT_MD} (Vergangenheit: ${pastSeries.length} + Aktuell)`);
})().catch(err => { console.error("❌", err.message); process.exit(1); });
