/**
 * server.js
 * --- FULL VERSION dengan kalibrasi eksternal ---
 */

const ModbusRTU = require("modbus-serial");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { DateTime } = require("luxon");

// 🔥 IMPORT KALIBRASI
const { calibrate } = require("./services/calibration");

// ============================================================
// KONFIGURASI DATA POINTS (TANPA FUNGSI KALIBRASI ‼)
// ============================================================
const DATA_POINTS_MAP = [
  { tag_name: "data1", alias_base: "Speed Conveyor" }, 
  { tag_name: "data2", alias_base: "Hot 1" }, 
  { tag_name: "data3", alias_base: "Hot 2" },
  { tag_name: "data4", alias_base: "Cold 1" },
  { tag_name: "data5", alias_base: "Cold 2" },
  { tag_name: "data6", alias_base: "Cold 3 " },
  { tag_name: "data7", alias_base: "Cold 4" },
  { tag_name: "data8", alias_base: "Hot 3" },
  { tag_name: "data9", alias_base: "Hot 4" },
];

// ============================================================
// KONFIGURASI PLC & SERVER
// ============================================================
const API_PORT = Number(process.env.API_PORT || 3005);
const JAKARTA_TIMEZONE = "Asia/Jakarta";
const REGISTER_COUNT = DATA_POINTS_MAP.length; 
const START_REGISTER = 5000;

const PLCS_CONFIG = [
  { name: "PLC_A", ip: "10.2.13.74", port: 5000, unitId: 1, startRegister: START_REGISTER, count: REGISTER_COUNT },
  { name: "PLC_B", ip: "10.2.13.75", port: 5000, unitId: 2, startRegister: START_REGISTER, count: REGISTER_COUNT },
  { name: "PLC_C", ip: "10.2.13.76", port: 5000, unitId: 3, startRegister: START_REGISTER, count: REGISTER_COUNT },
  { name: "PLC_D", ip: "10.2.13.77", port: 5000, unitId: 4, startRegister: START_REGISTER, count: REGISTER_COUNT },
  { name: "PLC_E", ip: "10.2.13.78", port: 5000, unitId: 5, startRegister: START_REGISTER, count: REGISTER_COUNT },
  { name: "PLC_F", ip: "10.2.13.95", port: 5000, unitId: 6, startRegister: START_REGISTER, count: REGISTER_COUNT },
];

const POLLING_INTERVAL_MS = 1000;
const CONNECTION_TIMEOUT_MS = 5000;
const DELAY_BETWEEN_PLCS_MS = 200;

// Membuat instance client Modbus untuk setiap PLC
const plcClients = PLCS_CONFIG.map(plc => ({
  ...plc,
  client: new ModbusRTU(),
  isConnected: false,
}));

// ============================================================
// DATA STORE GLOBAL
// ============================================================
let latestDataStore = { status: "success", timestamp: null, data: [] };
let connectionSummary = { total_plcs: PLCS_CONFIG.length, plcs_connected: 0, status_details: [] };

const CONNECTION_HISTORY_LIMIT = 50;
let connectionHistory = [];

// ============================================================
// UTILITAS
// ============================================================
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function safeLog(...args) { console.log(new Date().toISOString(), ...args); }
const DASHBOARD_FILE = path.join(__dirname, "public", "dashboard.html");

// ============================================================
// KONEKSI PLC
// ============================================================
async function connectClient(plc) {
  const { client, ip, port, unitId, name } = plc;
  client.setTimeout(CONNECTION_TIMEOUT_MS);
  client.setID(unitId);

  try {
    await client.connectTCP(ip, { port });
    plc.isConnected = true;
    safeLog(`[CONNECTED] ${name} (${ip}:${port})`);
  } catch (err) {
    plc.isConnected = false;
    safeLog(`[ERROR] ${name} failed to connect: ${err.message}`);
  }
}

async function initialConnectAll() {
  safeLog("Starting initial connection for all PLCs...");
  await Promise.allSettled(plcClients.map(connectClient));
  safeLog("Initial connection phase complete.");
}

// ============================================================
// POLLING DATA DENGAN KALIBRASI
// ============================================================
async function readAndProcess(plc) {
  const { client, name, ip, port, unitId, startRegister, count } = plc;
  const nowISO = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
  const resultTags = [];
  let plcStatus = "CONNECTED";
  let errorInfo = null;

  if (!plc.isConnected) {
    try {
      client.setID(unitId);
      await client.connectTCP(ip, { port });
      plc.isConnected = true;
      safeLog(`[RECONNECTED] ${name} successful reconnect.`);
    } catch (err) {
      plc.isConnected = false;
      plcStatus = "SKIPPED (CONNECTION FAILED)";
      errorInfo = err.message;
      return { status: plcStatus, plc_info: { name, ip, port, unitId }, tags: [], error: errorInfo };
    }
  }

  try {
    const res = await client.readHoldingRegisters(startRegister, count);
    const readTimestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();

    DATA_POINTS_MAP.forEach((point, index) => {
      const raw = res.data[index];

      // 🔥 KALIBRASI DI SINI
      const calibratedValue = calibrate(unitId, point.tag_name, raw);

      resultTags.push({
        plc_id: String(unitId),
        plc_name: name,
        tag_name: point.tag_name,
        value: calibratedValue,
        timestamp: readTimestamp,
        alias: `${point.tag_name} | ${point.alias_base || ''}`
      });
    });

  } catch (err) {
    plc.isConnected = false;
    plcStatus = "DISCONNECTED (READ FAILURE)";
    errorInfo = err.message;
    try { client.close(); } catch (_) {}
  }

  return { status: plcStatus, plc_info: { name, ip, port, unitId }, tags: resultTags, error: errorInfo };
}

// ============================================================
// LOOP POLLING
// ============================================================
async function pollingLoop() {
  safeLog("Polling...");
  let allTags = [];
  let connectedCount = 0;
  const statusDetails = [];
  const pollTimestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();

  for (const plc of plcClients) {
    const result = await readAndProcess(plc);

    if (result.status === "CONNECTED") {
      connectedCount++;
      allTags.push(...result.tags);
    }

    statusDetails.push({
    name: result.plc_info.name,
    ip: result.plc_info.ip,
    port: result.plc_info.port,
    unitId: result.plc_info.unitId,
    status: result.status,
    error: result.error,
    timestamp: pollTimestamp
    });

    await delay(DELAY_BETWEEN_PLCS_MS);
  }

  latestDataStore = { status: "success", timestamp: pollTimestamp, length: allTags.length, data: allTags };
  connectionSummary = { total_plcs: PLCS_CONFIG.length, plcs_connected: connectedCount, status_details: statusDetails };

  // 🔥 RIWAYAT
    connectionHistory.push({
    timestamp: pollTimestamp,
    statuses: statusDetails.map(s => ({
        unitId: s.unitId,
        isConnected: s.status === "CONNECTED"
    }))
    });
    if (connectionHistory.length > CONNECTION_HISTORY_LIMIT) connectionHistory.shift();

  setTimeout(pollingLoop, POLLING_INTERVAL_MS);
}

// ============================================================
// HTTP SERVER
// ============================================================
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const parsed = new URL(req.url, `http://${req.headers.host}`);

  if (parsed.pathname === "/api/latest-data") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(latestDataStore, null, 2));
  }

  if (parsed.pathname === "/api/connection-status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(connectionSummary));
  }

  if (parsed.pathname === "/api/connection-history") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(connectionHistory));
  }

  if (parsed.pathname === "/" || parsed.pathname === "/dashboard.html") {
    if (!fs.existsSync(DASHBOARD_FILE)) return res.end("Dashboard not found!");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(fs.readFileSync(DASHBOARD_FILE, "utf8"));
  }

  res.writeHead(404);
  res.end("404 Not Found");
});

// ============================================================
// START
// ============================================================
async function startMonitoring() {
  await initialConnectAll();
  await delay(500);
  pollingLoop();
  server.listen(API_PORT, () => safeLog(`SERVER READY http://localhost:${API_PORT}`));
}
startMonitoring();
