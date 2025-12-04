// data-collector/functions/databasefunction.js
const {
  processAndStoreHistory,
  processAndStoreHistoryLog,
} = require("../database/db-client");

const {
  POLLING_INTERVAL,
  HISTORY_WINDOW_MINUTES,
  HISTORY_PROCESS_DELAY_MINUTES,
} = require("../config");

const { DateTime } = require("luxon"); // <-- TAMBAHKAN INI
const JAKARTA_TIMEZONE = "Asia/Jakarta"; // <-- TAMBAHKAN INI (Asumsi nilai ini konstan)
const cron = require("node-cron");

const { 
  getLastDataTimestamp,
  cleanDataOlderThanToday } = require("../database/db-client");

async function initTableForToday() {
  try {
    const lastTimestamp = await getLastDataTimestamp();
    const today = DateTime.now().setZone(JAKARTA_TIMEZONE);
    if (!lastTimestamp) {
      console.log("[INIT DB] Tabel kosong, siap menyimpan data baru.");
      return;
    }

    const lastDate = DateTime.fromJSDate(lastTimestamp).setZone(
      JAKARTA_TIMEZONE
    );

    if (!lastDate.hasSame(today, "day")) {
      console.log(
        `[INIT DB] Data terakhir (${lastDate.toISODate()}) bukan hari ini — membersihkan tabel...`
      );
      const deleted = await cleanDataOlderThanToday();
      console.log(`[INIT CLEANUP] ${deleted} baris dihapus.`);
    } else {
      console.log("[INIT DB] Data terakhir masih hari ini — tidak ada penghapusan.");
    }
  } catch (err) {
    console.error("[INIT ERROR] Gagal saat inisialisasi tabel:", err);
  }
}


function startDailyCleaner() {
  cron.schedule(
    "1 0 * * *",
    async () => {
      console.log("\n[CRON] Menjalankan pembersihan harian...");
      await initTableForToday();
      console.log("[CRON] Pembersihan selesai.\n");
    },
    { timezone: JAKARTA_TIMEZONE }
  );
  console.log("✅ CRON Pembersihan harian dijadwalkan pukul 00:01 WIB.");
}

const WINDOW_MINUTES = Number.isFinite(HISTORY_WINDOW_MINUTES) 
  ? HISTORY_WINDOW_MINUTES 
  : 30; // 30 adalah nilai default yang aman

let lastProcessedTime = DateTime.now()
  .setZone(JAKARTA_TIMEZONE)
  .startOf("minute")
  .minus({ minutes: DateTime.now().minute % WINDOW_MINUTES });

async function historyProcessorLoop() {
  const currentTime = DateTime.now().setZone(JAKARTA_TIMEZONE);
  const nextTime = lastProcessedTime.plus({ minutes: HISTORY_WINDOW_MINUTES });

  if (currentTime >= nextTime) {
    console.log(
      `\n--- [HISTORY PROCESS] Periode: ${lastProcessedTime.toFormat(
        "HH:mm"
      )} - ${nextTime.toFormat("HH:mm")} ---`
    );

    try {
      const results = await processAndStoreHistory(
        lastProcessedTime.toJSDate(),
        nextTime.toJSDate()
      );

      if (results.processed > 0) {
        console.log(
          `[HISTORY] ${results.processed} grup data dipindahkan (${HISTORY_WINDOW_MINUTES} menit)`
        );
      } else {
        console.log("[HISTORY] Tidak ada data baru untuk diproses.");
      }

      lastProcessedTime = nextTime;
    } catch (err) {
      console.error("[HISTORY ERROR]", err);
    }
  }

  setTimeout(historyProcessorLoop, POLLING_INTERVAL);
}
let lastProcessedTimestamp = 0;

async function historyProcessorLoopLog() {
  try {
    const now = DateTime.now().setZone(JAKARTA_TIMEZONE);

    // Target: proses menit yang sudah lewat delay waktu
    const targetEnd = now
      .minus({ minutes: HISTORY_PROCESS_DELAY_MINUTES })
      .startOf("minute");

    const targetStart = targetEnd.minus({ minutes: HISTORY_WINDOW_MINUTES });

    const targetEndTs = targetEnd.toMillis();

    // Cegah proses ganda
    if (targetEndTs > lastProcessedTimestamp) {
      console.log(
        `\n--- [HISTORY PROCESS] Periode: ${targetStart.toFormat(
          "HH:mm"
        )} - ${targetEnd.toFormat("HH:mm")} (saat ini: ${now.toFormat(
          "HH:mm:ss"
        )}) ---`
      );

      const result = await processAndStoreHistoryLog(
        targetStart.toJSDate(),
        targetEnd.toJSDate()
      );

      if (result.processed > 0) {
        console.log(`[HISTORY] ${result.processed} grup data berhasil disimpan.`);
      } else {
        console.log("[HISTORY] Tidak ada data untuk periode ini.");
      }

      lastProcessedTimestamp = targetEndTs; // update timestamp terakhir
    }
  } catch (err) {
    console.error("[HISTORY LOOP ERROR]", err);
  }

  setTimeout(historyProcessorLoopLog, POLLING_INTERVAL);
}

// ============================================================
// STANDARDS & MODEL REFRESH
// ============================================================
async function refreshStandards() {
  try {
    const activeModels = {};
    const activeModelName = {};
    const standards = {};

    const modelRows = await dbQuery(`
      SELECT line_name, model_id, model_name 
      FROM line_model_status 
      WHERE status = 'RUNNING' 
      GROUP BY line_name
    `);

    for (const r of modelRows) {
      if (r.line_name) {
        activeModels[r.line_name] = r.model_id;
        activeModelName[r.line_name] = r.model_name;
      }
    }

    for (const [line, modelId] of Object.entries(activeModels)) {
      const rows = await dbQuery(
        `SELECT parameter_name, min_value, max_value FROM standard WHERE model_id = ?`,
        [modelId]
      );
      const paramMap = {};
      for (const r of rows) {
        paramMap[r.parameter_name] = {
          min: parseFloat(r.min_value),
          max: parseFloat(r.max_value),
        };
      }
      standards[line] = paramMap;
    }

    activeModelsCache = activeModels;
    activeModelNameCache = activeModelName;
    standardsCache = standards;
  } catch (err) {
    console.error("🔥 [STANDARDS] Failed to refresh:", err);
  }
}


module.exports = { initTableForToday, startDailyCleaner, historyProcessorLoop, historyProcessorLoopLog, refreshStandards };