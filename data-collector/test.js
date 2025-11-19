/**
 * connection-monitor-full.js
 *
 * Gabungan versi rapih dari monitor PLC + polling + API + fallback port (502 -> 5000).
 *
 * STRATEGI BARU: Verifikasi Port hanya 1x di awal (initialConnectionCheck).
 * Port yang ditemukan (502 atau 5000) akan digunakan sampai server di-restart.
 *
 * Fitur Utama:
 * 1. Initial Check (net.Socket) dengan Fallback Port (502 -> 5000) - HANYA 1X SAAT STARTUP.
 * 2. Modbus Polling (ModbusRTU) menggunakan port yang diverifikasi.
 * 3. HTTP API untuk Connection Status dan Data Terbaru.
 * 4. Graceful handling error dengan menutup koneksi Modbus client yang rusak saat read gagal.
 *
 * Usage:
 * - node connection-monitor-full.js
 * - Pastikan config.js export: { PLCS, DATA_POINTS_MAP, POLLING_INTERVAL }
 * - Pastikan services/calibration.js dan database/db-client.js tersedia
 */

const ModbusRTU = require("modbus-serial");
const http = require("http");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { DateTime } = require("luxon");

// Asumsi: File config.js, services/calibration.js, dan database/db-client.js tersedia
const { PLCS, DATA_POINTS_MAP, POLLING_INTERVAL } = require("./config");
const { calibrate } = require("./services/calibration");
const { saveHistoricalData } = require("./database/db-client");

// ============================================================
// CONFIG / CONSTANTS
// ============================================================
const API_PORT = Number(process.env.API_PORT || 3001);
const JAKARTA_TIMEZONE = "Asia/Jakarta";
const DELAY_BETWEEN_PLCS_MS = Number(process.env.DELAY_BETWEEN_PLCS_MS || 200);
const PRIMARY_PORT = Number(process.env.PRIMARY_PORT || 502);
const FALLBACK_PORT = Number(process.env.FALLBACK_PORT || 5000);
const DEFAULT_POLLING_INTERVAL = Number(
  process.env.POLLING_INTERVAL || POLLING_INTERVAL || 10000
);
const TCP_TIMEOUT_MS = 2500; // Timeout untuk net.Socket check

// ============================================================
// UTILS
// ============================================================
/**
 * Menambahkan delay
 * @param {number} ms - Milidetik
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrapper untuk console.log dengan timestamp ISO
 */
function safeLog(...args) {
  console.log(new Date().toISOString(), ...args);
}

// ============================================================
// PLC LIST (Initial State)
// ============================================================
const plcList = PLCS.map((plc) => {
  const client = new ModbusRTU();
  // Set timeout untuk operasi Modbus read/write
  client.setTimeout(2000);

  // Mencegah crash jika terjadi error socket internal
  client.on("error", () => {});
  if (client._client) client._client.on("error", () => {});

  return {
    ...plc,
    client, // ModbusRTU Client instance
    isConnected: false,
    lastLatency: null,
    lastCheckTime: null,
    // currentPort akan di-update oleh initialConnectionCheck
    currentPort: plc.port || PRIMARY_PORT,
  };
});

// ============================================================
// FRONTEND FILES / ALIAS
// ============================================================
const DASHBOARD_FILE = path.join(__dirname, "public", "data.html");
const ALIAS_FILE = path.join(__dirname, "alias.json");
const CONNECTION_PAGE = path.join(__dirname, "public", "connection-test.html");

if (!fs.existsSync(ALIAS_FILE)) {
  fs.writeFileSync(ALIAS_FILE, JSON.stringify({}, null, 2), "utf8");
}

function loadAliases() {
  try {
    return JSON.parse(fs.readFileSync(ALIAS_FILE, "utf8"));
  } catch (err) {
    return {};
  }
}

function saveAliases(data) {
  fs.writeFileSync(ALIAS_FILE, JSON.stringify(data, null, 2), "utf8");
}

let HTML_TEMPLATE = "<h1>Dashboard Missing</h1>";
try {
  HTML_TEMPLATE = fs.readFileSync(DASHBOARD_FILE, "utf8");
} catch {
  // keep default template if not found
}

// ============================================================
// === TEST KONEKSI (VERSI LAMA) ================================
// Mempertahankan fungsi asli (Legacy Test)
// ============================================================
async function testConnection(plc) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let done = false;

    socket.setTimeout(TCP_TIMEOUT_MS);

    socket.connect(plc.port, plc.ip, () => {
      if (done) return;
      done = true;

      socket.destroy();
      plc.isConnected = true;
      plc.lastLatency = Date.now() - start;
      plc.lastCheckTime = new Date().toISOString();
      resolve();
    });

    const handleFailure = () => {
      if (done) return;
      done = true;

      plc.isConnected = false;
      plc.lastLatency = null;
      plc.lastCheckTime = new Date().toISOString();
      socket.destroy();
      resolve();
    };

    socket.on("timeout", handleFailure);
    socket.on("error", handleFailure);
  });
}

// ============================================================
// Wrapper: Fallback Port Logic (502 -> 5000)
// ============================================================
async function testConnectionWithFallback(plc) {
  // Simpan port konfigurasi asli
  const originalPort = plc.port || plc.currentPort || PRIMARY_PORT;

  // 1. Coba Primary Port
  plc.port = PRIMARY_PORT;
  await testConnection(plc);

  if (plc.isConnected) {
    plc.currentPort = PRIMARY_PORT;
    safeLog(
      `[CONNECT CHECK] ${plc.name} OK on ${PRIMARY_PORT} (${plc.lastLatency}ms)`
    );
    return;
  }

  // 2. Coba Fallback Port jika Primary gagal
  plc.port = FALLBACK_PORT;
  await testConnection(plc);

  if (plc.isConnected) {
    plc.currentPort = FALLBACK_PORT;
    safeLog(
      `[CONNECT CHECK] ${plc.name} OK on fallback ${FALLBACK_PORT} (${plc.lastLatency}ms)`
    );
    return;
  }

  // 3. Kedua-duanya gagal
  // Kembalikan field plc.port ke nilai awal agar konfigurasi stabil
  plc.port = originalPort;
  // Tetapkan currentPort sebagai port yang terakhir dicoba (meski gagal)
  plc.currentPort = originalPort;
  safeLog(
    `[CONNECT CHECK] ${plc.name} unreachable on ${PRIMARY_PORT}/${FALLBACK_PORT}`
  );
  return;
}

// ============================================================
// INITIAL ONE-TIME CONNECTION CHECK
// Digunakan hanya saat startup untuk menentukan port (502 atau 5000)
// ============================================================
async function initialConnectionCheck() {
  safeLog("[INIT CHECK] Starting one-time connection check with fallback...");
  for (const plc of plcList) {
    try {
      // Gunakan wrapper yang mencoba primary lalu fallback
      await testConnectionWithFallback(plc);
      // short delay between PLCs
      await delay(DELAY_BETWEEN_PLCS_MS);
    } catch (err) {
      // Defensive catch, although testConnectionWithFallback should not throw
      plc.isConnected = false;
      plc.lastLatency = null;
      plc.lastCheckTime = new Date().toISOString();
      safeLog(
        `[ERROR] initialConnectionCheck for ${plc.name}:`,
        err && err.message ? err.message : err
      );
    }
  }
  safeLog("[INIT CHECK] One-time check complete. Port determined.");
}


// ============================================================
// CONNECT ALL MODBUS CLIENTS (initial connect)
// ============================================================
async function connectModbus(plc) {
  try {
    // Gunakan currentPort yang sudah ditentukan oleh initialConnectionCheck
    const usePort = plc.currentPort || PRIMARY_PORT;
    plc.client.setID(Number(plc.unitId));
    // connectTCP akan mencoba menyambung, atau me-resolve jika sudah tersambung
    await plc.client.connectTCP(plc.ip, { port: usePort });

    plc.isConnected = true;
    plc.lastCheckTime = new Date().toISOString();
    safeLog(`[PLC CONNECTED] ${plc.name} (${plc.ip}:${usePort})`);
  } catch (err) {
    plc.isConnected = false;
    plc.lastCheckTime = new Date().toISOString();
    safeLog(
      `[PLC ERROR] Initial connect ${plc.name}: ${
        err && err.message ? err.message : err
      }`
    );
  }
}

async function connectAllPlcs() {
  safeLog("[PLC] Connecting all Modbus clients (initial)...");
  for (const plc of plcList) {
    // Pastikan Modbus client menggunakan last known good port (currentPort)
    await connectModbus(plc);
  }
}

// ============================================================
// MODBUS POLLING (Read Data)
// ============================================================
async function readAndProcess(plc) {
  // Gunakan isConnected sebagai indikator bahwa ada koneksi Modbus yang valid.
  // Jika PLC tidak berhasil dikoneksikan saat startup, bacaan akan dilewati.
  if (!plc.isConnected) {
    // Hapus log SKIP READ jika terlalu berisik, atau tambahkan logika reconnect
    // if (plc.lastCheckTime && (Date.now() - new Date(plc.lastCheckTime).getTime() > 60000))
    // safeLog(`[SKIP READ] ${plc.name} is not connected.`);
    return [];
  }

  try {
    // Karena kita tidak menjalankan periodicCheck berulang, currentPort diasumsikan benar.
    const requiredPort = plc.currentPort || PRIMARY_PORT;

    // Upaya sambungan defensif: jika klien terputus karena alasan Modbus, coba sambung lagi
    // connectTCP() akan resolve jika klien sudah terhubung.
    await plc.client
      .connectTCP(plc.ip, { port: requiredPort })
      .catch((e) => {
        // Log ini menunjukkan kegagalan RECONNECT, bukan kegagalan READ
        safeLog(`[RECONNECT TRY] ${plc.name} failed: ${e.message}`);
        // Kita tidak throw di sini; biarkan readHoldingRegisters gagal
      });

    const START = DATA_POINTS_MAP[0].register;
    const COUNT = DATA_POINTS_MAP.length;

    // Operasi read Modbus
    const res = await plc.client.readHoldingRegisters(START, COUNT);
    const values = res.data || [];

    plc.isConnected = true; // Konfirmasi status berhasil
    const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
    const result = [];

    // Proses dan kalibrasi data
    DATA_POINTS_MAP.forEach((p, idx) => {
      const raw = values[idx];
      if (raw == null) return;

      let calibrated = calibrate(String(plc.id), p.tag_name, raw);
      // Logic kalibrasi spesifik (idx 1-8 dibagi 10)
      if (idx >= 1 && idx <= 8)
        calibrated = Number((calibrated / 10).toFixed(1));

      result.push({
        plc_id: String(plc.id),
        plc_name: plc.name,
        tag_name: p.tag_name,
        raw_value: raw,
        value: calibrated,
        timestamp,
      });
    });

    return result;
  } catch (e) {
    // Jika operasi Modbus gagal, ini menandakan socket rusak/terputus.
    
    // 1. Catat kegagalan
    plc.isConnected = false;
    plc.lastCheckTime = new Date().toISOString();
    safeLog(
      `[READ ERROR] ${plc.name}: ${e && e.message ? e.message : e}`
    );
    
    // 2. 🔥 Tindakan Kunci: Tutup koneksi secara eksplisit
    try {
      plc.client.close();
      safeLog(`[CLOSED] ${plc.name} Modbus client socket closed after failure.`);
    } catch (closeError) {
      // Abaikan jika sudah tertutup
    }
    
    return [];
  }
}

// ============================================================
// LATEST DATA STORE
// ============================================================
let latestDataStore = [];
let lastUpdateTimestamp = null;

function storeLatestData(data) {
  latestDataStore = data;
  lastUpdateTimestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
}

// ============================================================
// POLLING LOOP
// ============================================================
async function pollingLoop() {
  const all = [];

  for (const plc of plcList) {
    const result = await readAndProcess(plc);
    if (result.length > 0) all.push(...result);

    await delay(DELAY_BETWEEN_PLCS_MS);
  }

  if (all.length > 0) {
    storeLatestData(all);
    try {
      // Simpan ke database secara asinkron
      await saveHistoricalData(all);
    } catch (err) {
      safeLog("[DB SAVE ERROR]", err && err.message ? err.message : err);
    }
  }

  // Atur panggilan polling berikutnya
  setTimeout(pollingLoop, DEFAULT_POLLING_INTERVAL);
}

// ============================================================
// HTTP SERVER (API)
// ============================================================
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle OPTIONS (preflight)
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  const parsed = new URL(req.url, `http://${req.headers.host}`);

  // API Handler: /api/latest-data
  if (parsed.pathname === "/api/latest-data") {
    const aliases = loadAliases();
    const merged = latestDataStore.map((d) => ({
      ...d,
      alias: aliases[`${d.plc_name}_${d.tag_name}`] || "",
    }));

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    return res.end(
      JSON.stringify({
        status: "success",
        timestamp: lastUpdateTimestamp,
        data: merged,
      })
    );
  }

  // API Handler: /api/update-alias (POST)
  if (parsed.pathname === "/api/update-alias" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { plc_name, tag_name, alias } = JSON.parse(body);
        if (!plc_name || !tag_name) {
          res.writeHead(400);
          return res.end("Missing fields");
        }

        const aliases = loadAliases();
        aliases[`${plc_name}_${tag_name}`] = alias;
        saveAliases(aliases);

        res.writeHead(200);
        return res.end("ok");
      } catch (err) {
        safeLog("[ALIAS ERROR]", err);
        res.writeHead(500);
        return res.end("Invalid JSON or internal error");
      }
    });
    return;
  }

  // API Handler: /api/connection-status
  if (parsed.pathname === "/api/connection-status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({
        status: "success",
        timestamp: new Date().toISOString(),
        data: plcList.map((p) => ({
          plc_id: p.id,
          plc_name: p.name,
          ip: p.ip,
          port: p.currentPort,
          isConnected: p.isConnected,
          latency: p.lastLatency,
          lastCheckTime: p.lastCheckTime,
        })),
      })
    );
  }

  // Frontend: / (Dashboard)
  if (parsed.pathname === "/" || parsed.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(HTML_TEMPLATE);
  }

  // Frontend: /connection
  if (parsed.pathname === "/connection") {
    if (!fs.existsSync(CONNECTION_PAGE)) {
      res.writeHead(404);
      return res.end("connection-test.html NOT FOUND");
    }

    const html = fs.readFileSync(CONNECTION_PAGE, "utf8");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(html);
  }

  // 404 Not Found
  res.writeHead(404);
  res.end("Not Found");
});

// ============================================================
// START SERVER
// ============================================================
server.listen(API_PORT, async () => {
  safeLog(`🚀 SERVER RUNNING → http://localhost:${API_PORT}`);

  // 1. Jalankan verifikasi port 1x (blocking/synchronous)
  await initialConnectionCheck();

  // 2. Lakukan koneksi Modbus awal menggunakan port yang telah diverifikasi.
  await connectAllPlcs().catch((err) =>
    safeLog(
      "[CONNECT ALL ERROR]",
      err && err.message ? err.message : err
    )
  );

  // 3. Mulai polling loop Modbus secara berulang (asynchronous)
  pollingLoop();
});

// ============================================================
// Graceful Shutdown Handlers
// ============================================================
const shutdown = (signal) => {
  safeLog(`${signal} received. Shutting down...`);
  try {
    server.close();
    // Tutup semua klien Modbus saat shutdown
    plcList.forEach(plc => {
        try {
            plc.client.close();
        } catch (_) {}
    });
  } catch (_) {}
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  safeLog("[UNCAUGHT EXCEPTION]", err && err.stack ? err.stack : err);
  // Biarkan PM2 atau systemd yang melakukan restart
});
process.on("unhandledRejection", (reason) => {
  safeLog("[UNHANDLED REJECTION]", reason);
});