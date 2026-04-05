/**
 * Script de migration Supabase – FactureCheck
 * Usage : node scripts/migrate.mjs
 */

import https from "https";
import fs   from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, "..");

// ── Lecture du .env.local ─────────────────────────────────────────────────

const envFile = path.join(ROOT, ".env.local");
const env     = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY || "";
const PROJECT_REF  = new URL(SUPABASE_URL).hostname.split(".")[0];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

// ── Appel HTTP générique ──────────────────────────────────────────────────

function post(hostname, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      {
        hostname,
        path,
        method : "POST",
        headers: {
          "Content-Type"  : "application/json",
          "Content-Length": Buffer.byteLength(payload),
          Authorization   : `Bearer ${token}`,
          apikey          : token,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ── Exécution SQL (essaie 2 endpoints) ───────────────────────────────────

async function execSQL(sql) {
  // Endpoint 1 : pg-meta interne au projet
  const r1 = await post(
    `${PROJECT_REF}.supabase.co`,
    "/pg/query",
    { query: sql },
    SERVICE_KEY
  ).catch(() => null);

  if (r1 && r1.status >= 200 && r1.status < 300) return { ok: true };

  // Endpoint 2 : Management API Supabase
  const r2 = await post(
    "api.supabase.com",
    `/v1/projects/${PROJECT_REF}/database/query`,
    { query: sql },
    SERVICE_KEY
  ).catch(() => null);

  if (r2 && r2.status >= 200 && r2.status < 300) return { ok: true };

  return {
    ok    : false,
    status: r2?.status ?? r1?.status ?? 0,
    body  : r2?.body   ?? r1?.body   ?? "no response",
  };
}

// ── Migrations à exécuter ─────────────────────────────────────────────────

const MIGRATIONS = [
  "001_waitlist.sql",
  "002_uploads.sql",
  "003_storage.sql",
  "004_ocr_fields.sql",
  "005_extraction_fields.sql",
  "006_compliance.sql",
  "007_billing.sql",
];

// ── Main ──────────────────────────────────────────────────────────────────

console.log(`\n🚀  FactureCheck → migrations → ${SUPABASE_URL}\n`);

let ok = 0, fail = 0;

for (const file of MIGRATIONS) {
  const filePath = path.join(ROOT, "migrations", file);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️   ${file} introuvable — ignoré`);
    continue;
  }

  process.stdout.write(`▶   ${file} ... `);
  const sql = fs.readFileSync(filePath, "utf8");

  const result = await execSQL(sql).catch((err) => ({
    ok: false, status: 0, body: err.message,
  }));

  if (result.ok) {
    console.log("✅");
    ok++;
  } else {
    console.log(`❌  HTTP ${result.status}`);
    try {
      const parsed = JSON.parse(result.body);
      console.error("    →", parsed.message || parsed.error || result.body);
    } catch {
      console.error("    →", result.body?.slice(0, 200));
    }
    fail++;
  }
}

console.log(`\n${ok} migration(s) réussie(s), ${fail} échec(s).`);

if (fail > 0) {
  console.log(`
⚠️  Certaines migrations ont échoué.
L'API Management Supabase nécessite peut-être un Personal Access Token (PAT).

👉  Solution alternative (copier-coller dans le SQL Editor) :
    https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new

    Le SQL consolidé est dans : migrations/ (exécuter dans l'ordre 001→007)
`);
}
