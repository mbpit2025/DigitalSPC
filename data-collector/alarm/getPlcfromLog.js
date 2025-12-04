// ============================================================================
// HISTORY PROCESSOR – Bagian B
// ============================================================================

const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
const { processAndStoreHistoryLog } = require("../database/db-client");

// Lokasi file log
const LOG_FILE = path.join(__dirname, "..", "logs", "plc-log.txt");

// Flag untuk mencegah loop saling memanggil
let isHistoryProcessing = false;

// ---------------------------------------------------------------------------
// Fungsi membaca LOG terbaru
// Format log:
// {"line_name":"B1-01","model_name":"WL574","plc_id":"1","plc_name":"BPM-01","tag_name":"data1","value":53.5,"min":50,"max":55,"timestamp":"2025-12-03T16:42:29.881+07:00"}
// ---------------------------------------------------------------------------
function getPlcDataFromLog() {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];

    const content = fs.readFileSync(LOG_FILE, "utf-8");
    if (!content.trim()) return [];

    const lines = content.trim().split("\n");
    const parsed = [];

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        parsed.push(obj);
      } catch (err) {
        console.error("[LOG PARSE ERROR] Baris rusak:", line);
      }
    }

    return parsed;
  } catch (err) {
    console.error("[READ LOG ERROR]", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fungsi utama memproses HISTORY dari file LOG
// ---------------------------------------------------------------------------
async function historyProcessorLoopLog() {
  if (isHistoryProcessing) {
    console.log("[HISTORY] Skip: proses masih berjalan...");
    return;
  }

  isHistoryProcessing = true;

  try {
    const now = DateTime.local().toFormat("HH:mm:ss");

    const logs = getPlcDataFromLog();
    console.log(`[HISTORY] ${now} | Jumlah log dibaca:`, logs.length);

    for (const entry of logs) {
      await processAndStoreHistoryLog(entry); // <== aman, tidak memanggil loop kembali
    }

  } catch (err) {
    console.error("[HISTORY LOOP ERROR]", err);
  }

  isHistoryProcessing = false;
}

// ---------------------------------------------------------------------------
// Interval Loop
// ---------------------------------------------------------------------------
function startHistoryLoop() {
  console.log("[HISTORY] History Processor aktif setiap 2 detik...");

  setInterval(() => {
    historyProcessorLoopLog();
  }, 2000);
}

module.exports = {
  startHistoryLoop,
  getPlcDataFromLog,
  historyProcessorLoopLog,
};
