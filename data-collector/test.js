const ModbusRTU = require("modbus-serial");
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { DateTime } = require("luxon");

const {
  PLCS,
  DATA_POINTS_MAP,
  POLLING_INTERVAL
} = require("./config");

const {
  saveHistoricalData
} = require("./database/db-client");

const JAKARTA_TIMEZONE = "Asia/Jakarta";
const API_PORT = 3001;

// -------------------------------------------------------------
// 💡 FILE DASHBOARD DAN ALIAS
// -------------------------------------------------------------
const DASHBOARD_FILE = path.join(__dirname, "data.html");
const ALIAS_FILE = path.join(__dirname, "alias.json");

if (!fs.existsSync(ALIAS_FILE))
  fs.writeFileSync(ALIAS_FILE, JSON.stringify({}, null, 2));

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
// 💡 MUAT DASHBOARD
// -------------------------------------------------------------
let HTML_TEMPLATE;
try {
  HTML_TEMPLATE = fs.readFileSync(DASHBOARD_FILE, "utf8");
  console.log(`[FILE] Dashboard dimuat dari ${DASHBOARD_FILE}`);
} catch (err) {
  HTML_TEMPLATE = "<h1>Dashboard file missing!</h1>";
}

// -------------------------------------------------------------
// 💡 INISIALISASI CLIENT MODBUS
// -------------------------------------------------------------
const clients = PLCS.map((plc) => {
  const client = new ModbusRTU();
  client.setTimeout(5000); // timeout 5 detik
  return { ...plc, client, isConnected: false };
});

let latestDataStore = [];
let lastUpdateTimestamp = null;

function storeLatestData(data) {
  latestDataStore = data;
  lastUpdateTimestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
}

// -------------------------------------------------------------
// 💡 SERVER HTTP
// -------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // ✅ GET latest data
  if (req.method === "GET" && parsedUrl.pathname === "/api/latest-data") {
    res.setHeader("Content-Type", "application/json");

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
  }

  // ✅ POST update alias
  else if (req.method === "POST" && parsedUrl.pathname === "/api/update-alias") {
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
  }

  // ✅ Serve dashboard HTML
  else if (req.method === "GET" && parsedUrl.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML_TEMPLATE);
  }

  // ❌ Not found
  else {
    res.statusCode = 404;
    res.end("Endpoint Not Found");
  }
});

server.listen(API_PORT, () => {
  console.log(`[SERVER] Berjalan di http://localhost:${API_PORT}`);
});

// -------------------------------------------------------------
// 💡 LOGIKA MODBUS
// -------------------------------------------------------------
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

async function readAndProcess(plc) {
  if (!plc.isConnected) {
    try {
      await plc.client.connectTCP(plc.ip, { port: plc.port });
      plc.client.setID(String(plc.unitId));
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
    const values = response.data;
    const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();

    DATA_POINTS_MAP.forEach((point, index) => {
      let rawValue = values[index];
      let finalValue = rawValue;

      // ✅ data2 - data9 dibagi 10
      if (index >= 1 && index <= 8)
        finalValue = Number((rawValue / 10).toFixed(1));

      dataFromPlc.push({
        plc_id: String(plc.id),
        plc_name: plc.name,
        tag_name: point.tag_name,
        value: finalValue,
        timestamp,
      });
    });
  } catch (e) {
    console.error(`[PLC ERROR] ${plc.name}: ${e.message}`);
    plc.isConnected = false;
  }

  return dataFromPlc;
}

// -------------------------------------------------------------
// 💡 SYNC WAKTU KE PLC (tiap 3 menit)
// -------------------------------------------------------------
async function syncTimeToPlc(plc) {
  if (!plc.isConnected) return;
  try {
    const now = DateTime.now().setZone(JAKARTA_TIMEZONE);
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
  console.log("⏱️ Sinkronisasi waktu ke PLC setiap 3 menit...");
  setInterval(async () => {
    for (const plc of clients) {
      await syncTimeToPlc(plc);
    }
  }, 3 * 60 * 1000);
}

// -------------------------------------------------------------
// 💡 LOOP POLLING
// -------------------------------------------------------------
async function pollingLoop() {
  const allLatestData = [];
  const results = await Promise.allSettled(clients.map(readAndProcess));

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "fulfilled") allLatestData.push(...results[i].value);
  }

  if (allLatestData.length > 0) {
    await saveHistoricalData(allLatestData);
    storeLatestData(allLatestData);
  }

  setTimeout(pollingLoop, POLLING_INTERVAL);
}

// -------------------------------------------------------------
// 💡 STARTUP
// -------------------------------------------------------------
async function startCollector() {
  console.log("🚀 Memulai Modbus Collector + Alias Server");
  await connectAllPlcs();
  startTimeSync();
  pollingLoop();
}

startCollector();
