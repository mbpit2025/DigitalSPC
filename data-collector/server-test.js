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

const { PLCS, DATA_POINTS_MAP, POLLING_INTERVAL, GLOBAL_DEFAULT_RANGE } = require("./config");
const { calibrate } = require("./services/calibration");
const { saveHistoricalData } = require("./database/db-client");
const { pushLatestData } = require("./websocket/ws-emitter");
const { startAlarmChecker } = require("./alarm/alarm-checker");
const { initTableForToday, startDailyCleaner, historyProcessorLoop } = require("./functions/databasefunction");
const { dbQuery } = require("./database/db-client");

// ============================================================
// 🔁 TAG MAPPING: dataX → parameter fisik (sesuai tabel `standard`)
// ============================================================
const TAG_TO_PARAM_MAP = {
  "1": { data2: "HOT_TEMP", data3: "HOT_TEMP", data4: "COLD_TEMP", data5: "COLD_TEMP", data6: "COLD_TEMP", data7: "COLD_TEMP", data8: "HOT_TEMP", data9: "HOT_TEMP" },
  "4": { data2: "HOT_TEMP", data3: "HOT_TEMP", data4: "COLD_TEMP", data5: "COLD_TEMP", data6: "COLD_TEMP", data7: "COLD_TEMP", data8: "HOT_TEMP", data9: "HOT_TEMP" },
  "2": { data2: "PR_UP_TEMP", data3: "PR_OT_TEMP", data4: "PM1_UP_TEMP", data5: "PM1_OT_TEMP", data6: "PM2_UP_TEMP", data7: "PM2_OT_TEMP", data8: "CM_UP_TEMP", data9: "CM_OT_TEMP" },
  "5": { data2: "PR_UP_TEMP", data3: "PR_OT_TEMP", data4: "PM1_UP_TEMP", data5: "PM1_OT_TEMP", data6: "PM2_UP_TEMP", data7: "PM2_OT_TEMP", data8: "CM_UP_TEMP", data9: "CM_OT_TEMP" },
  "3": { data2: "CH_UP_TEMP", data3: "CH_OT_TEMP" },
  "6": { data2: "CH_UP_TEMP", data3: "CH_OT_TEMP" }
};

// ============================================================
// CONFIG / GLOBALS
// ============================================================
const API_PORT = 3001;
const JAKARTA_TIMEZONE = "Asia/Jakarta";
const DELAY_BETWEEN_PLCS_MS = 200;

// Reconnect/backoff
const RECONNECT_DELAY = 3000;
const RETRY_BACKOFF_STEP = 2000;
const MAX_RETRY_INTERVAL = 15000;

// ---------- CACHE GLOBAL ----------
let activeModelsCache = {};
let activeModelNameCache = {};
let standardsCache = {};

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

if (!fs.existsSync(ALIAS_FILE)) {
  fs.writeFileSync(ALIAS_FILE, JSON.stringify({}, null, 2), "utf8");
}

function loadAliases() {
  try {
    return JSON.parse(fs.readFileSync(ALIAS_FILE, "utf8"));
  } catch (e) {
    console.warn("⚠️ Failed to load alias.json, using empty object.");
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
  console.warn("⚠️ data.html not found — using fallback template.");
}

// ============================================================
// PING / CONNECTION TEST
// ============================================================
function pingHost(ip) {
  const pingCommand =
    process.platform === "win32"
      ? `ping -n 1 -w 2500 ${ip}`
      : `ping -c 1 -W 2 ${ip}`;

  return new Promise((resolve) => {
    const start = Date.now();
    exec(pingCommand, (error, stdout) => {
      const latency = Date.now() - start;
      const checkTime = new Date().toISOString();

      if (error || stdout.includes("100% loss") || stdout.includes("Request timed out")) {
        return resolve({ isConnected: false, lastLatency: null, lastCheckTime: checkTime });
      }

      resolve({ isConnected: true, lastLatency: latency, lastCheckTime: checkTime });
    });
  });
}

async function testConnectionPing(plc) {
  try {
    const result = await pingHost(plc.ip);
    Object.assign(plc, result);
  } catch (err) {
    plc.isConnected = false;
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
// PLC CLIENT SETUP
// ============================================================
const plcList = PLCS.map((plc) => ({
  ...plc,
  client: new ModbusRTU(),
  isConnected: false,
  lastLatency: null,
  lastCheckTime: null,
  _reconnecting: false,
  _backoff: RECONNECT_DELAY,
}));

function attachSocketHandlers(plc) {
  try {
    plc.client.removeAllListeners("error");
    plc.client.on("error", (err) => {
      if (!plc._reconnecting) {
        console.warn(`[${plc.name}] client error:`, err?.message || err);
        safeReconnect(plc).catch(() => {});
      }
    });
  } catch {}

  try {
    const socket = plc.client._client;
    if (socket && socket.removeAllListeners) {
      socket.removeAllListeners("close").removeAllListeners("error");
      socket.on("close", () => {
        if (!plc._reconnecting) {
          console.warn(`[${plc.name}] socket closed`);
          safeReconnect(plc).catch(() => {});
        }
      });
      socket.on("error", (err) => {
        if (!plc._reconnecting) {
          console.warn(`[${plc.name}] socket error:`, err?.message || err);
          safeReconnect(plc).catch(() => {});
        }
      });
    }
  } catch {}
}

// ============================================================
// CONNECTION MANAGEMENT
// ============================================================
async function safeReconnect(plc) {
  if (plc._reconnecting) return;
  plc._reconnecting = true;

  const delayTime = plc._backoff || RECONNECT_DELAY;
  await delay(delayTime);

  try {
    await new Promise((resolve) => {
      try {
        plc.client.close(resolve);
      } catch {
        resolve();
      }
    });

    plc.client = new ModbusRTU();
    plc.client.setTimeout(5000);
    await plc.client.connectTCP(plc.ip, { port: Number(plc.port) });
    plc.client.setID(Number(plc.unitId));

    plc.isConnected = true;
    plc._backoff = RECONNECT_DELAY;
    plc._reconnecting = false;

    attachSocketHandlers(plc);
    console.log(`✅ [${plc.name}] reconnected`);
  } catch (err) {
    plc.isConnected = false;
    plc._reconnecting = false;
    plc._backoff = Math.min((plc._backoff || RECONNECT_DELAY) + RETRY_BACKOFF_STEP, MAX_RETRY_INTERVAL);
    console.warn(`[${plc.name}] reconnect failed:`, err?.message || err);
    setTimeout(() => safeReconnect(plc).catch(() => {}), plc._backoff);
  }
}

async function connectModbus(plc) {
  try {
    await new Promise((resolve) => {
      try {
        plc.client.close(resolve);
      } catch {
        resolve();
      }
    });

    plc.client = new ModbusRTU();
    plc.client.setTimeout(5000);
    await plc.client.connectTCP(plc.ip, { port: Number(plc.port) });
    plc.client.setID(Number(plc.unitId));

    plc.isConnected = true;
    plc._backoff = RECONNECT_DELAY;
    attachSocketHandlers(plc);

    console.log(`🔌 [${plc.name}] connected to ${plc.ip}:${plc.port}`);
  } catch (err) {
    plc.isConnected = false;
    console.warn(`❌ [${plc.name}] connection failed:`, err?.message || err);
    setTimeout(() => safeReconnect(plc).catch(() => {}), plc._backoff || RECONNECT_DELAY);
  }
}

async function connectAllPlcs() {
  console.log("📡 Connecting all PLCs...");
  for (const plc of plcList) {
    await connectModbus(plc);
    await delay(300);
  }
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
    for (const plc of plcList) {
      await syncTimeToPlc(plc);
    }
  }, INTERVAL_MS);
}

// ============================================================
// MODBUS POLLING LOOP — ✅ DIPERBARUI DENGAN MAPPING
// ============================================================
async function readAndProcess(plc) {
  if (!plc.isConnected) return [];

  await refreshStandards();

  try {
    const START = DATA_POINTS_MAP[0].register;
    const COUNT = DATA_POINTS_MAP.length;

    const res = await plc.client.readHoldingRegisters(START, COUNT);
    const values = res?.data || [];

    const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
    const result = [];

    DATA_POINTS_MAP.forEach((p, idx) => {
      const raw = values[idx];
      if (raw == null) return;

      // Di pemanggil (misal: parser PLC):
      const rawNum = Number(raw);
      if (isNaN(rawNum)) {
        // console.warn(`[SKIP] Nilai non-numerik: ${raw} (${plc.id}-${p.tag_name})`);
        return raw;
      }

      // Calibration
      let calibrated = calibrate(String(plc.id), p.tag_name, rawNum);
      if (idx >= 0 && idx <= 8) {
        calibrated = Number((calibrated / 10).toFixed(1));
      }

      // ➤ line_name berdasarkan plc.id (atau dari config)
      const line_name = parseInt(plc.id) <= 3 ? "B1-01" : "B1-02";

      // ➤ Mapping tag → parameter fisik
      const paramName = TAG_TO_PARAM_MAP[plc.id]?.[p.tag_name];

      // ➤ Ambil model & standar
      const model_id = activeModelsCache[line_name] || null;
      const model_name = activeModelNameCache[line_name] || null;

      let min = null, max = null;

      // 🔍 Coba dari standardsCache (prioritas utama)
      if (paramName && standardsCache[line_name]?.[paramName]) {
        const std = standardsCache[line_name][paramName];
        min = std.min;
        max = std.max;
      } else {
          min = GLOBAL_DEFAULT_RANGE.min;
          max = GLOBAL_DEFAULT_RANGE.max;
        }

      // 🔄 Fallback ke tagRanges jika tidak ada di DB
      if (min === null || max === null) {
        if (plc.tagRanges) {
          let range = plc.tagRanges.default || { min: 50, max: 55 };
          for (const key in plc.tagRanges) {
            if (key !== "default" && key.split("|").includes(p.tag_name)) {
              range = plc.tagRanges[key];
              break;
            }
          }
          min = range.min;
          max = range.max;
        }
      }

      result.push({
        line_name,
        model_id,
        model_name,
        plc_id: plc.id,
        plc_name: plc.name,
        tag_name: p.tag_name,
        raw_value: raw,
        value: calibrated,
        min,
        max,
        timestamp,
      });
    });

    return result;
  } catch (e) {
    plc.isConnected = false;
    console.warn(`[${plc.name}] read error:`, e?.message || e);
    safeReconnect(plc).catch(() => {});
    return [];
  }
}

// ============================================================
// DATA STORAGE
// ============================================================
let latestDataStore = [];
let lastUpdateTimestamp = null;

function storeLatestData(data) {
  latestDataStore = data;
  lastUpdateTimestamp = nowIso();
}

async function pollingLoop() {
  try {
    const allData = [];

    for (const plc of plcList) {
      if (plc.isConnected) {
        const result = await readAndProcess(plc);
        allData.push(...result);
      }
      await delay(DELAY_BETWEEN_PLCS_MS);
    }

    if (allData.length > 0) {
      try {
        await saveHistoricalData(allData);
      } catch (dbErr) {
        console.warn("💾 Failed to save history:", dbErr?.message || dbErr);
      }
      storeLatestData(allData);
    }
  } catch (err) {
    console.error("🌀 Polling loop crashed:", err);
  } finally {
    setTimeout(pollingLoop, POLLING_INTERVAL);
  }
}

// ============================================================
// HTTP SERVER
// ============================================================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  try {
    if (url.pathname === "/api/latest-data") {
      const aliases = loadAliases();
      const dataWithAlias = latestDataStore.map((d) => ({
        ...d,
        alias: aliases[`${d.plc_name}_${d.tag_name}`] || "",
      }));

      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      try {
        pushLatestData(dataWithAlias);
      } catch (wsErr) {
        console.warn("📡 WS push error:", wsErr.message);
      }
      return res.end(JSON.stringify({ status: "success", timestamp: lastUpdateTimestamp, data: dataWithAlias }));
    }

    if (url.pathname === "/api/update-alias" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const { plc_name, tag_name, alias } = JSON.parse(body);

      if (!plc_name || !tag_name) {
        res.writeHead(400);
        return res.end("Missing plc_name or tag_name");
      }

      const aliases = loadAliases();
      aliases[`${plc_name}_${tag_name}`] = alias;
      saveAliases(aliases);

      res.writeHead(200);
      return res.end("Alias updated");
    }

    if (url.pathname === "/api/connection-status") {
      const status = plcList.map((p) => ({
        plc_id: p.id,
        plc_name: p.name,
        ip: p.ip,
        port: p.port,
        isConnected: p.isConnected,
        isReachable: !!p.lastLatency,
        latency: p.lastLatency,
        lastCheckTime: p.lastCheckTime,
      }));

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "success", timestamp: new Date().toISOString(), data: status }));
    }

    if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(HTML_TEMPLATE);
    }

    if (url.pathname === "/connection") {
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
  } catch (err) {
    console.error("handleRequest error:", err);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

// ============================================================
// STARTUP
// ============================================================
server.listen(API_PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${API_PORT}`);
  await initTableForToday().catch(console.error);
  startTimeSync()
  startDailyCleaner();
  periodicCheck();
  connectAllPlcs();
  pollingLoop();
  startAlarmChecker();
  historyProcessorLoop();
});