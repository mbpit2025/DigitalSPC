const { PLCS, DATA_POINTS_MAP, POLLING_INTERVAL, GLOBAL_DEFAULT_RANGE } = require("./config");
const { pushLatestData } = require("./websocket/ws-emitter");
const {
  saveHistoricalData,
  getLastDataTimestamp,
  cleanDataOlderThanToday,
  processAndStoreHistory,
} = require("./database/db-client");

const { DateTime } = require("luxon");
const cron = require("node-cron");

// Konstanta
const JAKARTA_TIMEZONE = "Asia/Jakarta";
const CHECK_HISTORY_INTERVAL_MS = 15000;
const HISTORY_WINDOW_MINUTES = 20;

// Dummy Scheduler
const START_HOUR = 7;
const START_MINUTE = 0;
const END_HOUR = 23;
const END_MINUTE = 50;

// Inisialisasi waktu pemrosesan ke kelipatan 10 menit terdekat
let lastProcessedTime = DateTime.now()
  .setZone(JAKARTA_TIMEZONE)
  .startOf("minute")
  .minus({ minutes: DateTime.now().minute % HISTORY_WINDOW_MINUTES });

console.log(
  `[INIT] Waktu awal pemrosesan history: ${lastProcessedTime.toFormat(
    "yyyy-MM-dd HH:mm:ss"
  )} WIB`
);

// -------------------------------------------------------------
// #1 Inisialisasi dan Pembersihan Harian
// -------------------------------------------------------------
async function initTableForToday() {
  try {
    const lastTimestamp = await getLastDataTimestamp();
    const today = DateTime.now().setZone(JAKARTA_TIMEZONE);
    if (!lastTimestamp) {
      console.log("[INIT] Tabel kosong, siap menyimpan data baru.");
      return;
    }

    const lastDate = DateTime.fromJSDate(lastTimestamp).setZone(
      JAKARTA_TIMEZONE
    );
    console.log(
      `[INIT INFO] Tanggal Terakhir: ${lastDate.toISODate()} | Hari Ini: ${today.toISODate()}`
    );

    if (!lastDate.hasSame(today, "day")) {
      console.log(
        `[INIT] Data terakhir (${lastDate.toISODate()}) bukan hari ini — membersihkan tabel...`
      );
      const deleted = await cleanDataOlderThanToday();
      console.log(`[INIT CLEANUP] ${deleted} baris dihapus.`);
    } else {
      console.log("[INIT] Data terakhir masih hari ini — tidak ada penghapusan.");
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

// -------------------------------------------------------------
// #2 Pemrosesan History Tiap 10 Menit
// -------------------------------------------------------------
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
      const startTime = lastProcessedTime.toJSDate();
      const endTime = nextTime.toJSDate();
      const results = await processAndStoreHistory(startTime, endTime);

      if (results.processed > 0) {
        console.log(
          `[HISTORY] ${results.processed} grup data dipindahkan setiap ${HISTORY_WINDOW_MINUTES} menit`
        );
      } else {
        console.log("[HISTORY] Tidak ada data baru untuk diproses.");
      }

      lastProcessedTime = nextTime;
    } catch (err) {
      console.error("[HISTORY ERROR]", err);
    }
  }

  setTimeout(historyProcessorLoop, CHECK_HISTORY_INTERVAL_MS);
}

// -------------------------------------------------------------
// #3 Dummy Data Generator
// -------------------------------------------------------------
function randomInRangeDecimal(min, max) {

    const scaledMin = Math.ceil(min * 10);
    const scaledMax = Math.floor(max * 10);

    const randomNumberScaled = Math.floor(Math.random() * (scaledMax - scaledMin + 1)) + scaledMin;

    // Bagi angka acak dengan 10 untuk mendapatkan 1 angka desimal
    return randomNumberScaled / 10;
}

function generateDummyData() {
    const data = [];
    const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO(); 

    PLCS.forEach((plc) => {
        DATA_POINTS_MAP.forEach((point) => {
            const tagName = point.tag_name;
            let range = GLOBAL_DEFAULT_RANGE; // Mulai dengan rentang default global

            // 1. Cek apakah PLC ini memiliki konfigurasi tagRanges kustom
            if (plc.tagRanges) {
                let foundCustomRange = false;
                
                // 2. Iterasi melalui semua kunci di tagRanges (misalnya 'data1|data2|data3')
                for (const key in plc.tagRanges) {
                    // Jika kunci bukan 'default' dan nama tag cocok dengan pola kunci
                    if (key !== 'default' && key.split('|').includes(tagName)) {
                        range = plc.tagRanges[key];
                        foundCustomRange = true;
                        break; // Rentang ditemukan, keluar dari loop
                    }
                }

                // 3. Jika rentang kustom tag spesifik tidak ditemukan, gunakan 'default' dari PLC tersebut
                if (!foundCustomRange && plc.tagRanges.default) {
                    range = plc.tagRanges.default;
                }
            }
            
            // Terapkan rentang akhir
            const min = range.min;
            const max = range.max;

            data.push({
                plc_id: plc.id,
                plc_name: plc.name,
                tag_name: tagName,
                // Gunakan rentang yang telah ditentukan
                value: randomInRangeDecimal(min, max), 
                timestamp,
            });
        });
    });

    return data;
}

async function pollingLoop() {
  const currentTime = DateTime.now().setZone(JAKARTA_TIMEZONE);
  const endOfDay = currentTime.set({ 
    hour: END_HOUR, 
    minute: END_MINUTE, 
    second: 0, 
    millisecond: 0 
  });

    // Cek apakah sudah melewati batas akhir (18:00 WIB)
  if (currentTime >= endOfDay) {
    console.log(`[DUMMY STOP] 🛑 Waktu sudah ${END_HOUR}:${END_MINUTE} WIB. Menghentikan data generator.`);
    // Menjadwalkan ulang untuk besok pagi pada 07:05 WIB
    schedulePollingStart(true); 
    return; // Keluar dari loop saat ini
  }

  const data = generateDummyData();
  // pushLatestData(data);

  try {
    await saveHistoricalData(data);
    console.log(`[DUMMY - Menyimpan setiap ${CHECK_HISTORY_INTERVAL_MS / 1000} detik]`)
  } catch (err) {
    console.error("[DUMMY ERROR] Gagal menyimpan data:", err);
  }

  setTimeout(pollingLoop, POLLING_INTERVAL);
}

/**
 * Menjadwalkan pollingLoop untuk mulai berjalan pada 07:05 WIB.
 * @param {boolean} isReschedule - True jika dipanggil dari pollingLoop (untuk hari berikutnya).
 */
function schedulePollingStart(isReschedule = false) {
  const NOW = DateTime.now().setZone(JAKARTA_TIMEZONE);
  
  // Tentukan waktu target hari ini pada 07:05 WIB
  let targetTime = NOW.set({ 
    hour: START_HOUR, 
    minute: START_MINUTE, 
    second: 0, 
    millisecond: 0 
  });

  // Jika sedang dijadwalkan ulang ATAU waktu target hari ini sudah terlewat, jadwalkan untuk besok.
  // if (isReschedule || NOW >= targetTime) {
  //   targetTime = targetTime.plus({ days: 1 });
  //   const logPrefix = isReschedule ? "[RE-SCHEDULE]" : "[INIT]";
  //   console.log(
  //     `${logPrefix} Start Time: ${START_HOUR}:${START_MINUTE} WIB hari ini sudah terlewat. Menjadwalkan start besok pada ${targetTime.toFormat(
  //       "yyyy-MM-dd HH:mm:ss"
  //     )}.`
  //   );
  // } else {
  //   console.log(
  //     `[INIT] Menjadwalkan start pada ${targetTime.toFormat(
  //       "yyyy-MM-dd HH:mm:ss"
  //     )} WIB.`
  //   );
  // }

  // Hitung waktu tunggu dalam milidetik
  const delayMs = targetTime.diff(NOW).toMillis();

  if (delayMs > 0) {
    console.log(
      `[INIT] Dummy Data Generator akan mulai dalam ${Math.ceil(
        delayMs / 60000
      )} menit...`
    );

    setTimeout(() => {
      console.log(
        `\n[TIMER START] ⏱️ Waktu ${START_HOUR}:${START_MINUTE} WIB tercapai, memulai Dummy Data Generator.`
      );
      pollingLoop(); // Mulai loop polling data
    }, delayMs);
  } else {
    // Jika start time di masa lalu/sekarang, dan ini BUKAN re-schedule (berarti server baru start)
    if (!isReschedule) {
        console.log(`[INIT] Memulai pollingLoop segera (Start time sudah lewat).`);
        pollingLoop();
    }
  }
}

async function startDummyCollector() {
  console.log("=========================================");
  console.log("🚀 Dummy Collector & History Processor started.");

  await initTableForToday();
  startDailyCleaner();
  
  // 1. Ganti pemanggilan pollingLoop() langsung dengan penjadwalan
  schedulePollingStart(); 
  
  historyProcessorLoop();

  console.log("=========================================");
}


startDummyCollector();
