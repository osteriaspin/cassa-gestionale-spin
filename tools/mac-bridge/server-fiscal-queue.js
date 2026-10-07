const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const RESTAURANT_ID = "8e83495c-69c2-4f30-9267-15f8bca501df";
const BRIDGE_TOKEN = "SPIN-KUBE-2026-7f4d91c2b8604a2e";
const PRINT_ENABLED = process.env.FISCAL_PRINT_ENABLED === "true";

const WINE = "/Users/osteriaspin/Downloads/Wine Devel.app/Contents/Resources/wine/bin/wine";
const FISCAL_DIR = "/Users/osteriaspin/.wine/drive_c/Program Files/Custom/CeFdll/CeFdll x64";
const FISCAL_EXE = "kube-fiscal.exe";

const VAT_TO_DEPARTMENT = { 22: 1, 10: 2, 4: 3 };
let busy = false;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Mancano SUPABASE_URL o SUPABASE_SECRET_KEY.");
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function rpc(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${name}: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function sanitizeDescription(value) {
  return String(value || "ARTICOLO")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim().slice(0, 44) || "ARTICOLO";
}

function validatePayload(payload) {
  if (!payload || payload.payment !== "CONTANTI") throw new Error("Pagamento non consentito: solo CONTANTI e' abilitato");
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error("Nessun articolo");
  let sum = 0;
  const items = payload.items.map((item, i) => {
    const vat = Number(item.vat);
    const department = VAT_TO_DEPARTMENT[vat];
    const cents = Number(item.lineCents);
    if (!department) throw new Error(`IVA non consentita alla riga ${i + 1}: ${vat}`);
    if (!Number.isInteger(cents) || cents <= 0 || cents > 999999999) throw new Error(`Importo non valido alla riga ${i + 1}`);
    sum += cents;
    return { department, description: sanitizeDescription(item.description), cents };
  });
  if (sum !== Number(payload.totalCents)) throw new Error(`Totale non coerente: righe=${sum}, totale=${payload.totalCents}`);
  return { items, totalCents: sum };
}

function makeReceiptFile(jobId, receipt) {
  const name = `fiscal-${jobId}.txt`;
  const full = path.join(FISCAL_DIR, name);
  const rows = receipt.items.map(x => `ITEM|${x.department}|${x.description}|${x.cents}`);
  fs.writeFileSync(full, rows.join("\n") + "\n", "ascii");
  return { name, full };
}

function runFiscal(receiptFileName) {
  return new Promise((resolve, reject) => {
    const child = spawn(WINE, [FISCAL_EXE, receiptFileName], { cwd: FISCAL_DIR, env: process.env });
    let stdout = "", stderr = "";
    child.stdout.on("data", d => stdout += d.toString());
    child.stderr.on("data", d => stderr += d.toString());
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0 && stdout.includes("FISCAL_OK")) return resolve(stdout);
      reject(new Error(`CeFDLL non ha confermato la stampa (exit ${code}). NON RIPETERE AUTOMATICAMENTE.\n${stdout}\n${stderr}`));
    });
  });
}

async function finish(jobId, success, error = null) {
  await rpc("finish_fiscal_job", {
    p_ristorante_id: RESTAURANT_ID,
    p_token: BRIDGE_TOKEN,
    p_job_id: jobId,
    p_success: success,
    p_error: error
  });
}

async function pollOnce() {
  if (busy) return;
  busy = true;
  let job = null;
  try {
    const result = await rpc("claim_fiscal_job", { p_ristorante_id: RESTAURANT_ID, p_token: BRIDGE_TOKEN });
    job = Array.isArray(result) ? result[0] : null;
    if (!job) return;

    console.log(`\nRicevuto job ${job.id} - ${job.receipt_id}`);
    const receipt = validatePayload(job.payload);

    if (!PRINT_ENABLED) {
      await finish(job.id, false, "Bridge in modalita sicura: FISCAL_PRINT_ENABLED non e' true");
      console.log("BLOCCATO: stampa fiscale non abilitata.");
      return;
    }

    const file = makeReceiptFile(job.id, receipt);
    try {
      const output = await runFiscal(file.name);
      await finish(job.id, true, null);
      console.log(`STAMPATO: ${job.receipt_id} - EUR ${(receipt.totalCents / 100).toFixed(2)}`);
      console.log(output.trim());
    } finally {
      try { fs.unlinkSync(file.full); } catch {}
    }
  } catch (error) {
    console.error("ERRORE:", error.message);
    if (job?.id) {
      try { await finish(job.id, false, error.message); } catch (e) { console.error("Errore aggiornamento coda:", e.message); }
    }
  } finally {
    busy = false;
  }
}

console.log("KUBE Fiscal Queue Bridge");
console.log(`Ristorante: ${RESTAURANT_ID}`);
console.log(`Stampa fiscale: ${PRINT_ENABLED ? "ABILITATA" : "BLOCCATA"}`);
console.log("Polling Supabase ogni 1,5 secondi...");

(async function loop() {
  while (true) {
    await pollOnce();
    await sleep(1500);
  }
})();
