// server.js
const ModbusRTU = require("modbus-serial");
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const net = require("net");
const { DateTime } = require("luxon");
const { calibrate } = require("./services/calibration");

const { PLCS, DATA_POINTS_MAP, POLLING_INTERVAL } = require("./config");
const { saveHistoricalData } = require("./database/db-client");

const JAKARTA_TIMEZONE = "Asia/Jakarta";
const API_PORT = 3001;

// ============================================================
// FILE FRONTEND
// ============================================================
const DASHBOARD_FILE = path.join(__dirname,"public", "data.html");
const ALIAS_FILE = path.join(__dirname, "alias.json");
const CONNECTION_PAGE = path.join(__dirname, "public", "connection-test.html");

if (!fs.existsSync(ALIAS_FILE))
  fs.writeFileSync(ALIAS_FILE, JSON.stringify({}, null, 2), "utf8");

function loadAliases() {
  try {
    return JSON.parse(fs.readFileSync(ALIAS_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveAliases(data) {
  fs.writeFileSync(ALIAS_FILE, JSON.stringify(data, null, 2), "utf8");
}

// ============================================================
// LOAD DASHBOARD
// ============================================================
let HTML_TEMPLATE;
try {
  HTML_TEMPLATE = fs.readFileSync(DASHBOARD_FILE, "utf8");
} catch {
  HTML_TEMPLATE = "<h1>Dashboard file missing!</h1>";
}

// ============================================================
// CLIENT MODBUS + ANTI CRASH SOCKET
// ============================================================
const plcClients = PLCS.map((plc) => {
  const client = new ModbusRTU();
  client.setTimeout(2000);

  // Hindari crash saat timeout/error
  client.on("error", () => {});
  if (client._client) client._client.on("error", () => {});

  return {
    ...plc,
    client,
    isConnected: false,
    lastLatency: null,
    lastCheckTime: null,
  };
});

let latestDataStore = [];
let lastUpdateTimestamp = null;

function storeLatestData(data) {
  latestDataStore = data;
  lastUpdateTimestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
}

// ============================================================
// TEST KONEKSI PLC (FAST CHECK)
// ============================================================
async function testConnection(plc) {
  return new Promise((resolve) => {
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
      socket.destroy();
      plc.isConnected = false;
      plc.lastLatency = null;
      plc.lastCheckTime = new Date().toISOString();
      resolve();
    });

    socket.on("error", () => {
      if (done) return;
      done = true;
      socket.destroy();
      plc.isConnected = false;
      plc.lastLatency = null;
      plc.lastCheckTime = new Date().toISOString();
      resolve();
    });
  });
}

async function periodicCheck() {
  for (const plc of plcClients) await testConnection(plc);
  setTimeout(periodicCheck, 10000);
}

// ============================================================
// KONEKSI MODBUS + POLLING
// ============================================================
async function connectAllPlcs() {
  const promises = plcClients.map(async (plc) => {
    try {
      if (plc.unitId !== undefined) plc.client.setID(String(plc.unitId));
      await plc.client.connectTCP(plc.ip, { port: plc.port });
      plc.isConnected = true;
      console.log(`[PLC OK] ${plc.name}`);
    } catch (err) {
      plc.isConnected = false;
      console.log(`[PLC FAIL] ${plc.name}: ${err.message}`);
    }
  });

  await Promise.allSettled(promises);
}

async function readAndProcess(plc) {
  if (!plc.isConnected) return [];

  try {
    const START_REGISTER = DATA_POINTS_MAP[0].register;
    const TOTAL_COUNT = DATA_POINTS_MAP.length;
    const response = await plc.client.readHoldingRegisters(START_REGISTER, TOTAL_COUNT);

    const values = response.data || [];
    const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
    const results = [];

    DATA_POINTS_MAP.forEach((point, i) => {
      const rawValue = values[i];
      if (rawValue == null) return;

      let calibrated = calibrate(String(plc.id), point.tag_name, rawValue);

      let displayValue = calibrated;
      if (i >= 1 && i <= 8) displayValue = Number((calibrated / 10).toFixed(1));

      results.push({
        plc_id: String(plc.id),
        plc_name: plc.name,
        tag_name: point.tag_name,
        raw_value: rawValue,
        value: displayValue,
        timestamp,
      });
    });

    return results;

  } catch (err) {
    plc.isConnected = false;
    return [];
  }
}

async function pollingLoop() {
  const all = [];
  const results = await Promise.allSettled(plcClients.map(readAndProcess));

  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  if (all.length > 0) {
    await saveHistoricalData(all);
    storeLatestData(all);
  }

  setTimeout(pollingLoop, POLLING_INTERVAL);
}

// ============================================================
// HTTP SERVER
// ============================================================
const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && parsed.pathname === "/api/latest-data") {
    const aliases = loadAliases();
    const merged = latestDataStore.map(d => ({
      ...d,
      alias: aliases[`${d.plc_name}_${d.tag_name}`] || "",
    }));

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    return res.end(JSON.stringify({
      status: "success",
      timestamp: lastUpdateTimestamp,
      data: merged,
    }));
  }

  if (req.method === "POST" && parsed.pathname === "/api/update-alias") {
    let body = "";
    req.on("data", c => body += c);
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
        return res.end("invalid json");
      }
    });
    return;
  }

  if (req.method === "GET" && parsed.pathname === "/api/connection-status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: "success",
      timestamp: new Date().toISOString(),
      data: plcClients.map(p => ({
        plc_id: p.id,
        plc_name: p.name,
        ip: p.ip,
        port: p.port,
        isConnected: p.isConnected,
        latency: p.lastLatency,
        lastCheckTime: p.lastCheckTime,
      })),
    }));
  }

  if (req.method === "GET" && parsed.pathname === "/") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(HTML_TEMPLATE);
  }

  if (req.method === "GET" && parsed.pathname === "/connection") {
    if (!fs.existsSync(CONNECTION_PAGE)) {
      res.writeHead(404);
      return res.end("connection-test.html NOT FOUND");
    }

    const html = fs.readFileSync(CONNECTION_PAGE, "utf8");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(html);
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});


server.listen(API_PORT, () => {
  console.log(`✅ SERVER JALAN DI http://localhost:${API_PORT}`);
  periodicCheck();
  connectAllPlcs();
  pollingLoop();
});
