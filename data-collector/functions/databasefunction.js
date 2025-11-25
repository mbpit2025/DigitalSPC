// data-collector/functions/databasefunction.js
const {
  saveHistoricalData,
  processAndStoreHistory,
} = require("../database/db-client");

const {
  PLCS,
  DATA_POINTS_MAP,
  POLLING_INTERVAL,
  GLOBAL_DEFAULT_RANGE,
  HISTORY_WINDOW_MINUTES,
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



module.exports = { initTableForToday, startDailyCleaner, historyProcessorLoop };