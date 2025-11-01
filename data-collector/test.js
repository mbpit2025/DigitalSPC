// test.js
const ModbusRTU = require("modbus-serial");
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { DateTime } = require("luxon");
const { calibrate } = require("./services/calibration");

const {
  PLCS,
  DATA_POINTS_MAP,
} = require("./config");

const {
  saveHistoricalData
} = require("./database/db-client");

const JAKARTA_TIMEZONE = "Asia/Jakarta";
const API_PORT = 3002;

// -------------------------------------------------------------
// FILE DASHBOARD DAN ALIAS
// -------------------------------------------------------------
const DASHBOARD_FILE = path.join(__dirname, "data.html");
const ALIAS_FILE = path.join(__dirname, "alias.json");

if (!fs.existsSync(ALIAS_FILE))
  fs.writeFileSync(ALIAS_FILE, JSON.stringify({}, null, 2), "utf8");

function loadAliases() {
  try {
    return JSON.parse(fs.readFileSync(ALIAS_FILE, "utf8"));
  } catch (e) {
    console.error("[ALIAS] Gagal membaca alias.json:", e.message);
    return {};
  }
}

function saveAliases(data) {
  try {
    fs.writeFileSync(ALIAS_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("[ALIAS] Gagal menyimpan alias:", e.message);
  }
}

// -------------------------------------------------------------
// MUAT DASHBOARD
// -------------------------------------------------------------
let HTML_TEMPLATE;
try {
  HTML_TEMPLATE = fs.readFileSync(DASHBOARD_FILE, "utf8");
  console.log(`[FILE] Dashboard dimuat dari ${DASHBOARD_FILE}`);
} catch (err) {
  HTML_TEMPLATE = "<h1>Dashboard file missing!</h1>";
  console.warn("[FILE] Dashboard tidak ditemukan, memakai template fallback.");
}

// -------------------------------------------------------------
// INISIALISASI CLIENT MODBUS
// -------------------------------------------------------------
const clients = PLCS.map((plc) => {
  const client = new ModbusRTU();
  client.setTimeout(2000); // 2 detik timeout per operasi
  return { ...plc, client, isConnected: false };
});

let latestDataStore = [];
let lastUpdateTimestamp = null;

function storeLatestData(data) {
  latestDataStore = data;
  lastUpdateTimestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
}

// -------------------------------------------------------------
// SERVER HTTP
// -------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // GET latest data
  if (req.method === "GET" && parsedUrl.pathname === "/api/latest-data") {
    res.setHeader("Content-Type", "application/json");
    // hindari cache supaya frontend selalu ambil data terbaru
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

    const aliases = loadAliases();
    const dataWithAlias = latestDataStore.map((d) => {
      const key = `${d.plc_name}_${d.tag_name}`;
      return { ...d, alias: aliases[key] || "" };
    });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: "success",
        timestamp: lastUpdateTimestamp,
        data: dataWithAlias,
      })
    );
    return;
  }

  // POST update alias
  if (req.method === "POST" && parsedUrl.pathname === "/api/update-alias") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { plc_name, tag_name, alias } = JSON.parse(body);

        if (!plc_name || !tag_name) {
          res.statusCode = 400;
          res.end(JSON.stringify({ status: "error", message: "Data tidak lengkap" }));
          return;
        }

        const aliases = loadAliases();
        aliases[`${plc_name}_${tag_name}`] = alias;
        saveAliases(aliases);

        console.log(`[ALIAS] ${plc_name}.${tag_name} → "${alias}"`);
        res.statusCode = 200;
        res.end(JSON.stringify({ status: "success", message: "Alias disimpan" }));
      } catch (err) {
        console.error("[API ERROR] update-alias:", err.message);
        res.statusCode = 500;
        res.end(JSON.stringify({ status: "error", message: err.message }));
      }
    });
    return;
  }

  // Serve dashboard HTML
  if (req.method === "GET" && parsedUrl.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML_TEMPLATE);
    return;
  }

  // Not found
  res.statusCode = 404;
  res.end("Endpoint Not Found");
});

server.listen(API_PORT, () => {
  console.log(`[SERVER] Berjalan di http://localhost:${API_PORT}`);
});

// -------------------------------------------------------------
// LOGIKA MODBUS
// -------------------------------------------------------------
async function connectAllPlcs() {
  console.log("[PLC] Mencoba koneksi awal ke PLC...");
  const connectionPromises = clients.map(async (plc) => {
    try {
      // unitId di config umumnya number/string
      if (plc.unitId !== undefined) plc.client.setID(String(plc.unitId));
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

async function readAndProcess(plc) {
  // Pastikan koneksi, coba reconnect bila perlu
  if (!plc.isConnected) {
    try {
      await plc.client.connectTCP(plc.ip, { port: plc.port });
      if (plc.unitId !== undefined) plc.client.setID(String(plc.unitId));
      plc.isConnected = true;
      console.log(`[PLC RECONNECT] ${plc.name}`);
    } catch (e) {
      console.warn(`[PLC FAILED] ${plc.name}: ${e.message}`);
      return [];
    }
  }

  const START_REGISTER = DATA_POINTS_MAP[0].register;
  const TOTAL_COUNT = DATA_POINTS_MAP.length;
  const dataFromPlc = [];

  try {
    const response = await plc.client.readHoldingRegisters(START_REGISTER, TOTAL_COUNT);
    const values = Array.isArray(response.data) ? response.data : (response.data || []);
    const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();

    DATA_POINTS_MAP.forEach((point, index) => {
      // Ambil raw; jika tidak ada index di values, gunakan null
      const rawValue = typeof values[index] !== "undefined" ? values[index] : null;

      // Jika rawValue null/undefined, skip entry (atau bisa push null)
      if (rawValue === null) {
        console.warn(`[PLC READ] ${plc.name} - index ${index} (${point.tag_name}) => value missing`);
        return;
      }



      // Terapkan kalibrasi menggunakan processedValue (bukan raw mentah)
      let calibratedValue;
      try {
        calibratedValue = calibrate(String(plc.id), point.tag_name, rawValue);
      } catch (err) {
        console.error(`[KALIBRASI ERROR] ${plc.name} ${point.tag_name}: ${err.message}`);
        calibratedValue = processedValue; // fallback
      }

      // Debug log (ringkas)
      console.log(`[KALIBRASI DEBUG] PLC=${plc.name} (${plc.id}) Tag=${point.tag_name} Raw=${rawValue} Processed=${rawValue} Calibrated=${calibratedValue}`);

            // Scaling dulu (sesuai aturan lama: data2..data9 dibagi 10)
      let displayValue = calibratedValue;
      if (index >= 1 && index <= 8) {
        displayValue = Number((calibratedValue / 10).toFixed(1));
      }

      // Push ke array hasil
      dataFromPlc.push({
        plc_id: String(plc.id),
        plc_name: plc.name,
        tag_name: point.tag_name,
        raw_value: rawValue, // nilai setelah scaling, sebelum formula kalibrasi
        value: displayValue,     // nilai yang akan dibaca frontend
        timestamp,
      });
    });
  } catch (e) {
    console.error(`[PLC ERROR] ${plc.name}: ${e.message}`);
    // Tandai koneksi sebagai false agar next loop mencoba reconnect
    plc.isConnected = false;
  }

  return dataFromPlc;
}

// -------------------------------------------------------------
// SYNC WAKTU KE PLC (setiap 3 menit — bisa disesuaikan)
// -------------------------------------------------------------
async function syncTimeToPlc(plc) {
  if (!plc.isConnected) return;
  try {
    const now = DateTime.now().setZone(JAKARTA_TIMEZONE);
    // tulis minute/hour/day ke register contoh (sesuaikan register jika beda)
    await plc.client.writeRegister(200, now.minute);
    await plc.client.writeRegister(202, now.hour);
    await plc.client.writeRegister(203, now.day);
    console.log(`[TIME SYNC] ${plc.name}: ${now.hour}:${now.minute}, tgl=${now.day}`);
  } catch (e) {
    console.error(`[TIME SYNC ERROR] ${plc.name}: ${e.message}`);
    plc.isConnected = false;
  }
}

function startTimeSync() {
  const INTERVAL_MS = 3 * 60 * 1000; // 3 menit
  console.log(`⏱️ Sinkronisasi waktu ke PLC setiap ${INTERVAL_MS / 1000}s`);
  setInterval(async () => {
    for (const plc of clients) {
      await syncTimeToPlc(plc);
    }
  }, INTERVAL_MS);
}

// -------------------------------------------------------------
// LOOP POLLING
// -------------------------------------------------------------
async function pollingLoop() {
  try {
    const allLatestData = [];
    const results = await Promise.allSettled(clients.map(readAndProcess));

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "fulfilled" && Array.isArray(results[i].value)) {
        allLatestData.push(...results[i].value);
      } else if (results[i].status === "rejected") {
        console.warn(`[POLLING] client index ${i} rejected:`, results[i].reason);
      }
    }

    if (allLatestData.length > 0) {
      try {
        await saveHistoricalData(allLatestData);
      } catch (err) {
        console.error("[DB SAVE] Gagal menyimpan historical data:", err.message);
      }
      storeLatestData(allLatestData);
      // Debug singkat: tampilkan ringkasan, jangan terlalu verbose
      console.log(`[POLLING] ${allLatestData.length} data point tersimpan. Timestamp: ${lastUpdateTimestamp}`);
    }
  } catch (err) {
    console.error("[POLLING ERROR]", err);
  } finally {
    // Polling tiap 1 detik (sesuaikan jika perlu)
    setTimeout(pollingLoop, 1000);
  }
}

// -------------------------------------------------------------
// STARTUP
// -------------------------------------------------------------
async function startCollector() {
  console.log("🚀 Memulai Modbus Collector + Alias Server");
  await connectAllPlcs();
  startTimeSync();
  pollingLoop();
}

startCollector();
