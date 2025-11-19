//============================================================
// DEPENDENCIES
// ============================================================
const ModbusRTU = require("modbus-serial");
const http = require("http");
const fs = require("fs");
const path = require("path");
const net = require("net");
const { DateTime } = require("luxon");

const { PLCS, DATA_POINTS_MAP, POLLING_INTERVAL } = require("./config");
const { calibrate } = require("./services/calibration");
const { saveHistoricalData } = require("./database/db-client");

// ============================================================
const API_PORT = 3001;
const JAKARTA_TIMEZONE = "Asia/Jakarta";
const DELAY_BETWEEN_PLCS_MS = 200;

// ============================================================
// UTILS
// ============================================================
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// SINGLE PLC LIST (FIXED VERSION)
// ============================================================
const plcList = PLCS.map(plc => {
  const client = new ModbusRTU();
  client.setTimeout(2000);

  client.on("error", () => {});
  if (client._client) client._client.on("error", () => {});

  return {
    ...plc,
    client,
    isConnected: false,
    lastLatency: null,
    lastCheckTime: null
  };
});

// ============================================================
// FRONTEND FILES
// ============================================================
const DASHBOARD_FILE = path.join(__dirname, "public", "data.html");
const ALIAS_FILE = path.join(__dirname, "alias.json");
const CONNECTION_PAGE = path.join(__dirname, "public", "connection-test.html");

if (!fs.existsSync(ALIAS_FILE))
  fs.writeFileSync(ALIAS_FILE, JSON.stringify({}, null, 2), "utf8");

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
} catch {}


// ============================================================
// TEST KONEKSI (FAST SOCKET CHECK)
// ============================================================
async function testConnection(plc) {
  return new Promise(resolve => {
    const start = Date.now();
    const socket = new net.Socket();
    let done = false;

    socket.setTimeout(2500);

    socket.connect(plc.port, plc.ip, () => {
      if (done) return;
      done = true;

      socket.destroy();
      plc.isConnected = true;
      plc.lastLatency = Date.now() - start;
      plc.lastCheckTime = new Date().toISOString();
      resolve();
    });

    socket.on("timeout", () => {
      if (done) return;
      done = true;

      plc.isConnected = false;
      plc.lastLatency = null;
      plc.lastCheckTime = new Date().toISOString();
      socket.destroy();
      resolve();
    });

    socket.on("error", () => {
      if (done) return;
      done = true;

      plc.isConnected = false;
      plc.lastLatency = null;
      plc.lastCheckTime = new Date().toISOString();
      socket.destroy();
      resolve();
    });
  });
}

async function periodicCheck() {
  for (const plc of plcList) {
    await testConnection(plc);
  }
  setTimeout(periodicCheck, 10000);
}


// ============================================================
// CONNECT ALL MODBUS CLIENTS
// ============================================================
async function connectModbus(plc) {
  try {
    plc.client.setID(Number(plc.unitId));
    await plc.client.connectTCP(plc.ip, { port: plc.port });

    plc.isConnected = true;
    console.log(`[PLC CONNECTED] ${plc.name} (${plc.ip})`);
  } catch (err) {
    plc.isConnected = false;
    console.log(`[PLC ERROR] ${plc.name}: ${err.message}`);
  }
}

async function connectAllPlcs() {
  console.log("[PLC] Connecting...");
  for (const plc of plcList) await connectModbus(plc);
}


// ============================================================
// MODBUS POLLING
// ============================================================
async function readAndProcess(plc) {
  if (!plc.isConnected) return [];

  try {
    const START = DATA_POINTS_MAP[0].register;
    const COUNT = DATA_POINTS_MAP.length;

    const res = await plc.client.readHoldingRegisters(START, COUNT);
    const values = res.data || [];

    plc.isConnected = true; // Update status (FIX)
    const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
    const result = [];

    DATA_POINTS_MAP.forEach((p, idx) => {
      const raw = values[idx];
      if (raw == null) return;

      let calibrated = calibrate(String(plc.id), p.tag_name, raw);
      if (idx >= 1 && idx <= 8) calibrated = Number((calibrated / 10).toFixed(1));

      result.push({
        plc_id: String(plc.id),
        plc_name: plc.name,
        tag_name: p.tag_name,
        raw_value: raw,
        value: calibrated,
        timestamp
      });
    });

    return result;

  } catch (e) {
    plc.isConnected = false;
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
  const all = [];

  for (const plc of plcList) {
    const result = await readAndProcess(plc);
    if (result.length > 0) all.push(...result);

    await delay(DELAY_BETWEEN_PLCS_MS);
  }

  if (all.length > 0) {
    await saveHistoricalData(all);
    storeLatestData(all);
  }

  setTimeout(pollingLoop, POLLING_INTERVAL);
}


// ============================================================
// HTTP SERVER (API)
// ============================================================
const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);

  // API: latest-data
  if (parsed.pathname === "/api/latest-data") {
    const aliases = loadAliases();
    const merged = latestDataStore.map(d => ({
      ...d,
      alias: aliases[`${d.plc_name}_${d.tag_name}`] || ""
    }));

    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ status: "success", timestamp: lastUpdateTimestamp, data: merged }));
  }

  // API Update Alias
  if (parsed.pathname === "/api/update-alias" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => (body += chunk));
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
      } catch {
        res.writeHead(500);
        return res.end("Invalid JSON");
      }
    });
    return;
  }

  // API: connection-status
  if (parsed.pathname === "/api/connection-status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: "success",
      timestamp: new Date().toISOString(),
      data: plcList.map(p => ({
        plc_id: p.id,
        plc_name: p.name,
        ip: p.ip,
        port: p.port,
        isConnected: p.isConnected,
        latency: p.lastLatency,
        lastCheckTime: p.lastCheckTime
      }))
    }));
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
  periodicCheck();
  connectAllPlcs();
  pollingLoop();
});
