// Core service untuk Polling Modbus TCP/IP, Logging DB, dan Push Real-time via WS

const ModbusRTU = require("modbus-serial");
const { PLCS, DATA_POINTS_MAP, POLLING_INTERVAL } = require("./config");
const { pushLatestData } = require("./websocket/ws-emitter");
const {
  saveHistoricalData,
  getLastDataTimestamp, // Diperlukan untuk inisialisasi dan pembersihan harian
  cleanDataOlderThanToday, // Diperlukan untuk pembersihan harian
  processAndStoreHistory, // Diperlukan untuk pemrosesan historis
} = require("./database/db-client");

const { DateTime } = require("luxon");
const cron = require("node-cron");
const { calibrate } = require("./services/calibration");
const net = require("net");


// =============================================================
// KONSTANTA & INISIALISASI WAKTU
// =============================================================

const JAKARTA_TIMEZONE = "Asia/Jakarta";
const CHECK_HISTORY_INTERVAL_MS = 15000; // Cek setiap 15 detik apakah sudah waktunya memproses history
const HISTORY_WINDOW_MINUTES = 20; // Periode agregasi data

// Inisialisasi waktu pemrosesan ke kelipatan 20 menit terdekat, untuk memastikan
// pemrosesan dimulai tepat waktu pada interval 20 menit (misalnya 14:00, 14:20, dst.)
let lastProcessedTime = DateTime.now()
  .setZone(JAKARTA_TIMEZONE)
  .startOf("minute")
  .minus({ minutes: DateTime.now().minute % HISTORY_WINDOW_MINUTES });

console.log(
  `[INIT] Waktu awal pemrosesan history: ${lastProcessedTime.toFormat(
    "yyyy-MM-dd HH:mm:ss"
  )} WIB`
);

// Inisialisasi klien Modbus untuk setiap PLC
const clients = PLCS.map((plc) => {
  const client = new ModbusRTU();
  client.setTimeout(5000); // timeout 5 detik
  return { ...plc, client, isConnected: false };
});

// =============================================================
// #1 INISIALISASI DB & PEMBERSIHAN HARIAN
// =============================================================

/**
 * Memeriksa data terakhir di DB. Jika data terakhir bukan hari ini,
 * tabel dibersihkan untuk memulai logging data baru.
 */
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

/**
 * Menjadwalkan pembersihan harian tepat pada pukul 00:01 WIB.
 */
function startDailyCleaner() {
  cron.schedule(
    "1 0 * * *", // Setiap hari pada 00:01
    async () => {
      console.log("\n[CRON] Menjalankan pembersihan harian...");
      await initTableForToday();
      console.log("[CRON] Pembersihan selesai.\n");
    },
    { timezone: JAKARTA_TIMEZONE }
  );
  console.log("✅ CRON Pembersihan harian dijadwalkan pukul 00:01 WIB.");
}

// =============================================================
// #2 PEMROSESAN HISTORY (AGREGASI 20-MENIT)
// =============================================================

/**
 * Loop yang berjalan setiap CHECK_HISTORY_INTERVAL_MS untuk mengecek
 * apakah sudah waktunya memproses dan mengagregasi data historis.
 */
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
      // Fungsi ini akan mengambil data real-time antara startTime dan endTime,
      // menghitung agregasi (mis. AVG), dan menyimpannya ke tabel history.
      const results = await processAndStoreHistory(startTime, endTime);

      if (results.processed > 0) {
        console.log(
          `[HISTORY] ${results.processed} grup data dipindahkan setiap ${HISTORY_WINDOW_MINUTES} menit`
        );
      } else {
        console.log("[HISTORY] Tidak ada data baru untuk diproses dalam periode ini.");
      }

      lastProcessedTime = nextTime;
    } catch (err) {
      console.error("[HISTORY ERROR] Gagal saat memproses history:", err);
    }
  }

  // Menggunakan setTimeout untuk rekursi non-blocking
  setTimeout(historyProcessorLoop, CHECK_HISTORY_INTERVAL_MS);
}


async function testTcpConnection(ip, port, timeout = 2000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    // Timeout
    socket.setTimeout(timeout);

    socket
      .connect(port, ip, () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ isConnected: true, latency });
      })
      .on("timeout", () => {
        socket.destroy();
        resolve({ isConnected: false, latency: null });
      })
      .on("error", () => {
        resolve({ isConnected: false, latency: null });
      });
  });
}


// =============================================================
// #3 MODBUS POLLING CORE LOGIC
// =============================================================

/**
 * Menghubungkan semua klien Modbus.
 */
async function checkTcpBeforeModbus(plc) {
  const tcp = await testTcpConnection(plc.ip, plc.port);

  if (!tcp.isConnected) {
    plc.isConnected = false;
    console.error(`[TCP ERROR] ${plc.name} (${plc.ip}) tidak bisa dihubungi.`);
    return false;
  }

  console.log(`[TCP OK] ${plc.name} latency ${tcp.latency}ms`);
  return true;
}


async function connectAllPlcs() {
  console.log("[PLC] Mencoba koneksi awal ke PLC...");
  const connectionPromises = clients.map(async (plc) => {
    try {
      plc.client.setID(String(plc.unitId));
      await plc.client.connectTCP(plc.ip, { port: plc.port });
      plc.isConnected = true;
      console.log(`[PLC SUCCESS] Terhubung ke ${plc.name} (${plc.ip}:${plc.port})`);
    } catch (e) {
      plc.isConnected = false;
      console.error(`[PLC ERROR] Gagal terhubung ke ${plc.name} (${plc.ip}): ${e.message}`);
    }
  });
  await Promise.allSettled(connectionPromises);
}

/**
 * Membaca register dari satu PLC.
 */
async function readAndProcess(plc) {

    const readPromises = clients.map(async (plc) => {
    const ok = await checkTcpBeforeModbus(plc);
    if (!ok) return []; 
    return readAndProcess(plc);
  });

  if (!plc.isConnected) {
    try {
      // Coba reconnect jika terputus
      await plc.client.connectTCP(plc.ip, { port: plc.port });
      plc.isConnected = true;
      plc.client.setID(String(plc.unitId));
      console.log(`[PLC RECONNECT] Berhasil terhubung kembali ke ${plc.name}`);
    } catch (e) {
      console.warn(`[PLC FAILED] Gagal membaca ${plc.name}: Koneksi terputus.`);
      return [];
    }
  }

  const dataFromPlc = [];
  // Asumsi semua data point yang ingin diambil berurutan mulai dari register pertama
  const START_REGISTER = DATA_POINTS_MAP[0].register;
  const TOTAL_COUNT = DATA_POINTS_MAP.length;

  try {
    // Membaca semua register dalam satu panggilan Modbus
    const response = await plc.client.readHoldingRegisters(START_REGISTER, TOTAL_COUNT);
    const values = Array.isArray(response.data) ? response.data : (response.data || []);
    const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();

    DATA_POINTS_MAP.forEach((point, index) => {
      const rawValue = typeof values[index] !== "undefined" ? values[index] : null;

      if (rawValue === null) {
        console.warn(`[PLC READ] ${plc.name} - index ${index} (${point.tag_name}) => value missing`);
        return;
      }

      let calibratedValue;
      try {
        calibratedValue = calibrate(String(plc.id), point.tag_name, rawValue);
      } catch (err) {
        console.error(`[KALIBRASI ERROR] ${plc.name} ${point.tag_name}: ${err.message}`);
        calibratedValue = processedValue; // fallback
      }

      let displayValue = calibratedValue;
      if (index >= 1 && index <= 8) {
        displayValue = Number((calibratedValue / 10).toFixed(1));
      }

      console.log(`[KALIBRASI DEBUG] PLC=${plc.name} (${plc.id}) Tag=${point.tag_name} Raw=${rawValue} Processed=${rawValue} Calibrated=${displayValue}`);


      dataFromPlc.push({
        plc_id: String(plc.id), // Pastikan format ID sesuai
        plc_name: plc.name,
        tag_name: point.tag_name,
        value: displayValue,
        timestamp, // Tambahkan timestamp untuk data real-time
      });
    });
  } catch (e) {
    console.error(`[PLC ERROR] Kesalahan Polling ${plc.name}: ${e.message}`);
    plc.isConnected = false; // Set status terputus jika ada error saat polling
  }

  return dataFromPlc;
}



// -------------------------------------------------------------
// SYNC WAKTU KE PLC (setiap 3 menit — bisa disesuaikan)
// -------------------------------------------------------------
async function syncTimeToPlc(plc) {
  try {
    if (!plc.isConnected) {
      await plc.client.connectTCP(plc.ip, { port: plc.port });
      plc.isConnected = true;
      console.log(`[SYNC RECONNECT] Reconnected to ${plc.name}`);
    }

    plc.client.setID(String(plc.unitId));

    const now = DateTime.now().setZone(JAKARTA_TIMEZONE);
    const hour = now.hour;
    const minute = now.minute;
    const day = now.day;

    // Pastikan register sesuai urutan PLC
    await plc.client.writeRegister(201, minute);
    await plc.client.writeRegister(202, hour);
    await plc.client.writeRegister(203, day);

    console.log(`[TIME SYNC] ${plc.name}: ${hour}:${minute} tanggal ${day}`);
  } catch (e) {
    console.error(`[TIME SYNC ERROR] ${plc.name}: ${e.message}`);
    plc.isConnected = false;
  }
}


function startTimeSync() {
  const INTERVAL_MS = 60 * 1000; // 3 menit
  console.log(`⏱️ Sinkronisasi waktu ke PLC setiap ${INTERVAL_MS / 1000}s`);
  setInterval(async () => {
    for (const plc of clients) {
      await syncTimeToPlc(plc);
    }
  }, INTERVAL_MS);
}

/**
 * Loop utama polling untuk akuisisi data real-time.
 */
async function pollingLoop() {
  console.log(`\n--- Memulai siklus Polling (${POLLING_INTERVAL}ms) ---`);
  const startTime = Date.now();
  const allLatestData = [];

  const readPromises = clients.map((plc) => readAndProcess(plc));
  const results = await Promise.all(readPromises);

  results.forEach((data) => {
    allLatestData.push(...data);
  });

  console.log(`[POLL] Total data diambil: ${allLatestData.length}. Eksekusi: ${Date.now() - startTime}ms`);

  if (allLatestData.length > 0) {
    // 1. Simpan ke DB untuk digunakan oleh history processor
    await saveHistoricalData(allLatestData);

    // 2. Dorong ke Web App untuk display real-time
    pushLatestData(allLatestData);
  } else {
    // 🚨 Jika semua gagal, kirim notifikasi ke front-end
    pushLatestData([
      {
        type: "ALERT",
        message: "Semua PLC gagal terhubung atau tidak ada data terbaca.",
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  const elapsedTime = Date.now() - startTime;
  const nextWaitTime = Math.max(0, POLLING_INTERVAL - elapsedTime);
  setTimeout(pollingLoop, nextWaitTime);
}

// =============================================================
// #4 START COLLECTOR
// =============================================================

async function startCollector() {
  console.log("=========================================");
  console.log("🚀 Real Modbus Collector & History Processor started.");

  // #1 Inisialisasi DB dan Pembersihan Harian (PENTING)
  await initTableForToday();
  startDailyCleaner();


  // #2 Koneksi Awal ke PLC
  await connectAllPlcs();

  if (clients.some((c) => c.isConnected)) {
    console.log("Koneksi PLC berhasil. Memulai loop akuisisi dan history data.");
    pollingLoop();
    historyProcessorLoop();
  } else {
    console.error("Semua PLC GAGAL terhubung. Retry dalam 10 detik.");
    pushLatestData([
      {
        type: "ALERT",
        message: "Collector gagal terhubung ke semua PLC saat startup. Mencoba kembali.",
        timestamp: new Date().toISOString(),
      },
    ]);

    setTimeout(startCollector, 10000);
  }

  startTimeSync();
  console.log("=========================================");
}

startCollector();
