// server.js
// ============================================================
// DEPENDENCIES
// ============================================================
const ModbusRTU = require("modbus-serial");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");
const { exec } = require("child_process");

const { PLCS, DATA_POINTS_MAP, POLLING_INTERVAL } = require("./config");
const { calibrate } = require("./services/calibration");
const { saveHistoricalData } = require("./database/db-client");
const { pushLatestData } = require("./websocket/ws-emitter");
const {startAlarmChecker} = require("./alarm/alarm-checker")
const { initTableForToday, startDailyCleaner, historyProcessorLoop } = require("./functions/databasefunction");
const { dbQuery } = require("./database/db-client");


// ============================================================
// CONFIG / CONST
// ============================================================
const API_PORT = 3001;
const JAKARTA_TIMEZONE = "Asia/Jakarta";
const DELAY_BETWEEN_PLCS_MS = 200; // jeda antar PLC saat polling

// Reconnect/backoff
const RECONNECT_DELAY = 3000; // ms initial
const RETRY_BACKOFF_STEP = 2000;
const MAX_RETRY_INTERVAL = 15000;

// ============================================================
// UTILS
// ============================================================
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
}

// ============================================================
// FRONTEND FILES
// ============================================================
const DASHBOARD_FILE = path.join(__dirname, "public", "data.html");
const ALIAS_FILE = path.join(__dirname, "alias.json");
const CONNECTION_PAGE = path.join(__dirname, "public", "connection-test.html");

if (!fs.existsSync(ALIAS_FILE)) fs.writeFileSync(ALIAS_FILE, JSON.stringify({}, null, 2), "utf8");

function loadAliases() {
  try {
    return JSON.parse(fs.readFileSync(ALIAS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveAliases(data) {
  fs.writeFileSync(ALIAS_FILE, JSON.stringify(data, null, 2), "utf8");
}

let HTML_TEMPLATE = "<h1>Dashboard Missing</h1>";
try {
  HTML_TEMPLATE = fs.readFileSync(DASHBOARD_FILE, "utf8");
} catch (e) {
  // tetap gunakan default template
}

// ============================================================
// PING / CONNECTION TEST (informational only)
// ============================================================
function pingHost(ip) {
  // Platform-specific ping command - timeout units differ between OS
  const pingCommand =
    process.platform === "win32"
      ? `ping -n 1 -w 2500 ${ip}` // -n 1: one echo, -w 2500ms timeout
      : `ping -c 1 -W 2 ${ip}`; // -c 1: one echo, -W 2 seconds timeout (Linux/macOS)

  return new Promise((resolve) => {
    const start = Date.now();
    exec(pingCommand, (error, stdout, stderr) => {
      const latency = Date.now() - start;
      const checkTime = new Date().toISOString();

      if (error) {
        return resolve({ isConnected: false, lastLatency: null, lastCheckTime: checkTime });
      }

      const out = String(stdout || "");
      // Basic negative detection for Windows and general output
      if (out.includes("100% loss") || out.includes("Request timed out")) {
        return resolve({ isConnected: false, lastLatency: null, lastCheckTime: checkTime });
      }

      return resolve({ isConnected: true, lastLatency: latency, lastCheckTime: checkTime });
    });
  });
}

async function testConnectionPing(plc) {
  try {
    const result = await pingHost(plc.ip);
    plc.lastLatency = result.lastLatency;
    plc.lastCheckTime = result.lastCheckTime;
  } catch {
    plc.lastLatency = null;
    plc.lastCheckTime = new Date().toISOString();
  }
}

async function periodicCheck() {
  for (const plc of plcList) {
    testConnectionPing(plc).catch(() => {});
  }
  setTimeout(periodicCheck, 10000);
}

// ============================================================
// PLC LIST: create client per PLC
// ============================================================
const plcList = PLCS.map((plc) => {
  const client = new ModbusRTU();
  client.setTimeout(5000);

  return {
    ...plc,
    client,
    isConnected: false,
    lastLatency: null,
    lastCheckTime: null,
    _reconnecting: false,
    _backoff: RECONNECT_DELAY,
  };
});

// Helper kecil untuk attach event ke underlying socket (jika ada)
function attachSocketHandlers(plc) {
  // Attach high-level client error event
  try {
    plc.client.on("error", (err) => {
      plc.isConnected = false;
      console.warn(`[${plc.name}] client error: ${err && err.message ? err.message : err}`);
      safeReconnect(plc).catch(() => {});
    });
  } catch {}

  // If underlying socket exists, attach close/error to it
  try {
    if (plc.client._client && plc.client._client.on) {
      plc.client._client.on("close", () => {
        plc.isConnected = false;
        console.warn(`[${plc.name}] underlying socket closed`);
        safeReconnect(plc).catch(() => {});
      });

      plc.client._client.on("error", (err) => {
        plc.isConnected = false;
        console.warn(`[${plc.name}] underlying socket error: ${err && err.message ? err.message : err}`);
        safeReconnect(plc).catch(() => {});
      });
    }
  } catch {}
}

// initially attach what we can
for (const plc of plcList) {
  attachSocketHandlers(plc);
}

// ============================================================
// SAFE RECONNECT MECHANISM
// ============================================================
async function safeReconnect(plc) {
  // prevent concurrent reconnect attempts
  if (plc._reconnecting) return;
  plc._reconnecting = true;

  const delayTime = plc._backoff || RECONNECT_DELAY;
  console.log(`⚠️  [${plc.name}] attempting reconnect in ${delayTime}ms...`);
  await delay(delayTime);

  try {
    // try to close old client socket gracefully
    try {
      // close the modbus client if possible
      // client.close supports callback or returns undefined; wrap in try/catch
      plc.client.close(() => {});
    } catch (e) {}

    // create new client instance to avoid zombie sockets piling up
    plc.client = new ModbusRTU();
    plc.client.setTimeout(5000);

    // connect
    await plc.client.connectTCP(plc.ip, { port: Number(plc.port) });
    plc.client.setID(Number(plc.unitId));

    // reset states
    plc.isConnected = true;
    plc._backoff = RECONNECT_DELAY;
    plc._reconnecting = false;

    // attach socket handlers for this new client
    attachSocketHandlers(plc);

    console.log(`🔌 [${plc.name}] reconnected`);
  } catch (err) {
    plc.isConnected = false;
    plc._reconnecting = false;
    // increase backoff with cap
    plc._backoff = Math.min((plc._backoff || RECONNECT_DELAY) + RETRY_BACKOFF_STEP, MAX_RETRY_INTERVAL);
    console.warn(`[${plc.name}] reconnect failed: ${err && err.message ? err.message : err}. next try in ${plc._backoff}ms`);
    // schedule next reconnect attempt
    setTimeout(() => safeReconnect(plc).catch(() => {}), plc._backoff);
  }
}

// ============================================================
// CONNECT ALL PLCs (initial)
// ============================================================
async function connectModbus(plc) {
  try {
    try {
      plc.client.close(() => {});
    } catch {}

    plc.client = plc.client || new ModbusRTU();
    plc.client.setTimeout(2000);
    await plc.client.connectTCP(plc.ip, { port: Number(plc.port) });
    plc.client.setID(Number(plc.unitId));

    plc.isConnected = true;
    plc._backoff = RECONNECT_DELAY;
    attachSocketHandlers(plc);

    console.log(`[CONNECTING PLC] ${plc.name} (${plc.ip}:${plc.port})`);
  } catch (err) {
    plc.isConnected = false;
    console.warn(`[CONNECTING ERROR] ${plc.name}: ${err && err.message ? err.message : err}`);
    // schedule reconnect but don't block
    setTimeout(() => safeReconnect(plc).catch(() => {}), plc._backoff || RECONNECT_DELAY);
  }
}

async function connectAllPlcs() {
  console.log("[PLC] Connecting all configured PLCs...");
  for (const plc of plcList) {
    // small delay to avoid simultaneously spamming network
    await connectModbus(plc);
    await delay(300);
  }
}

// 🔍 Ambil model aktif dan standar terkini (sekali per loop)
async function refreshStandards() {
  try {
    const activeModels = {};
    const activeModelName = {}; // lokal
    const standards = {};

    const modelRows = await dbQuery(`
      SELECT line_name, model_id, model_name 
      FROM line_model_status 
      WHERE status = 'RUNNING' 
      GROUP BY line_name
    `);
    for (const r of modelRows) {
      activeModels[r.line_name] = r.model_id;
      activeModelName[r.line_name] = r.model_name;
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
          max: parseFloat(r.max_value)
        };
      }
      standards[line] = paramMap;
    }

    // Simpan ke cache global
    activeModelsCache = activeModels;
    activeModelNameCache = activeModelName; 
    standardsCache = standards;

    // Opsional: log untuk debug
    // console.log("✅ Standards & models refreshed:", { activeModelsCache, activeModelNameCache, standardsCache: JSON.stringify(standardsCache) });
  } catch (err) {
    console.error("[STANDARD ERROR] Gagal memuat standar:", err);
  }
}

// ============================================================
// MODBUS POLLING
// ============================================================
async function readAndProcess(plc) {
  if (!plc.isConnected) return [];

  await refreshStandards(); 

  try {
    const START = DATA_POINTS_MAP[0].register;
    const COUNT = DATA_POINTS_MAP.length;

    const res = await plc.client.readHoldingRegisters(START, COUNT);
    const values = res && res.data ? res.data : [];

    plc.isConnected = true; // still alive
    const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
    const result = [];

DATA_POINTS_MAP.forEach((p, idx) => {
  const raw = values[idx];
  if (raw == null) return;

  let calibrated = calibrate(String(plc.id), p.tag_name, raw);
  if (idx >= 1 && idx <= 8) {
    calibrated = Number((calibrated / 10).toFixed(1));
  }

  // Ambil line_name dari PLC atau dari DATA_POINTS_MAP (tergantung desain Anda)
  // Misalnya: asumsikan setiap tag punya `line_name`, atau gunakan `plc.line_name`
  const line_name = p.line_name || plc.line_name; // pastikan ini valid

  // Ambil min/max dari cache standar jika tersedia
  let min = null;
  let max = null;
  if (standardsCache[line_name] && standardsCache[line_name][p.tag_name]) {
    min = standardsCache[line_name][p.tag_name].min;
    max = standardsCache[line_name][p.tag_name].max;
  }

  result.push({
    line_name: line_name,
    model_id: activeModelsCache[line_name] || null,
    model_name: activeModelNameCache[line_name] || null,
    plc_id: plc.id,
    plc_name: plc.name,
    tag_name: p.tag_name,       
    value: calibrated,           
    min: min,
    max: max,
    timestamp: timestamp,
  });
});

    return result;
  } catch (e) {
    // baca error -> tandai disconnect & trigger reconnect
    plc.isConnected = false;
    console.warn(`[${plc.name}] read error: ${e && e.message ? e.message : e}`);
    // Fire-and-forget reconnect path
    safeReconnect(plc).catch(() => {});
    return [];
  }
}

let latestDataStore = [];
let lastUpdateTimestamp = null;

function storeLatestData(data) {
  latestDataStore = data;
  lastUpdateTimestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
}

async function pollingLoop() {
  try {
    const all = [];

    for (const plc of plcList) {
      // Skip quickly if known disconnected, but still occasionally try to reconnect via safeReconnect scheduled earlier
      if (plc.isConnected) {
        const result = await readAndProcess(plc);
        if (result.length > 0) all.push(...result);
      } else {
        // optional: attempt very cheap check like readCoils? but avoid heavy ops here
        // We'll rely on safeReconnect scheduling separately.
      }
      await delay(DELAY_BETWEEN_PLCS_MS);
    }

    if (all.length > 0) {
      try {
        await saveHistoricalData(all);
      } catch (dbErr) {
        console.warn("Failed to save historical data:", dbErr && dbErr.message ? dbErr.message : dbErr);
      }
      storeLatestData(all);
    }
  } catch (loopErr) {
    console.error("Polling loop error:", loopErr && loopErr.message ? loopErr.message : loopErr);
  } finally {
    // schedule next polling
    setTimeout(pollingLoop, POLLING_INTERVAL);
  }
}

// ============================================================
// HTTP SERVER (API)
// ============================================================
const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);

  // API: latest-data
  if (parsed.pathname === "/api/latest-data") {
    const aliases = loadAliases();
    const merged = latestDataStore.map((d) => ({
      ...d,
      alias: aliases[`${d.plc_name}_${d.tag_name}`] || "",
    }));

    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    try {
      pushLatestData(merged);
      return res.end(JSON.stringify({ status: "success", timestamp: lastUpdateTimestamp, data: merged }));
    } catch (e) {
      // ignore websocket push errors
    }
  }

  // API: update-alias
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
        res.writeHead(500);
        return res.end("Invalid JSON");
      }
    });
    return;
  }

  // API: connection-status
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
          port: p.port,
          isConnected: p.isConnected, // actual modbus connection
          isReachable: !!p.lastLatency, // ping info
          latency: p.lastLatency,
          lastCheckTime: p.lastCheckTime,
        })),
      })
    );
  }

  // Dashboard
  if (parsed.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(HTML_TEMPLATE);
  }

  // Connection Page
  if (parsed.pathname === "/connection") {
    if (!fs.existsSync(CONNECTION_PAGE)) {
      res.writeHead(404);
      return res.end("connection-test.html NOT FOUND");
    }

    const html = fs.readFileSync(CONNECTION_PAGE, "utf8");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(html);
  }

  res.writeHead(404);
  res.end("Not Found");
});

// ============================================================
// START SERVER
// ============================================================
server.listen(API_PORT, () => {
  console.log(`🚀 SERVER RUNNING → http://localhost:${API_PORT}`);
  initTableForToday().then(() => {
    startDailyCleaner();
  });

  // Start background tasks
  periodicCheck(); // ping info
  connectAllPlcs(); // initial connect + schedules for reconnect
  pollingLoop(); // main polling loop
  startAlarmChecker()
  historyProcessorLoop()
});
