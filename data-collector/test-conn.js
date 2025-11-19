// plc-connection-test.js
const ModbusRTU = require("modbus-serial");
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { PLCS } = require("./config");

const API_PORT = 3001;

// ✅ Membuat client PLC + mencegah crash
const clients = PLCS.map((plc) => {
  const client = new ModbusRTU();
  client.setTimeout(2000);

  // ✅ Cegah unhandled socket errors agar Node tidak crash
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

// ✅ Fungsi connect aman + timeout paksa
async function safeConnect(plc) {
  return new Promise((resolve, reject) => {
    let finished = false;

    plc.client.connectTCP(plc.ip, { port: plc.port })
      .then(() => {
        if (!finished) {
          finished = true;
          resolve();
        }
      })
      .catch((err) => {
        if (!finished) {
          finished = true;
          reject(err);
        }
      });

    // timeout manual 3 detik
    setTimeout(() => {
      if (!finished) {
        finished = true;

        // ✅ disconnect paksa agar socket tidak menggantung
        if (plc.client._client) {
          try { plc.client._client.destroy(); } catch (e) {}
        }

        reject(new Error("Timeout"));
      }
    }, 3000);
  });
}

const net = require("net");

async function testConnection(plc) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let finished = false;

    socket.setTimeout(2500);

    socket.connect(plc.port, plc.ip, () => {
      if (finished) return;
      finished = true;

      socket.destroy();
      plc.isConnected = true;
      plc.lastLatency = Date.now() - startTime;
      plc.lastCheckTime = new Date().toISOString();

      console.log(`[PLC CONNECT] ✅ ${plc.name} (${plc.lastLatency}ms)`);
      resolve();
    });

    socket.on("timeout", () => {
      if (finished) return;
      finished = true;

      socket.destroy();
      plc.isConnected = false;
      plc.lastLatency = null;
      plc.lastCheckTime = new Date().toISOString();

      console.log(`[PLC CONNECT] ❌ ${plc.name}: TIMEOUT`);
      resolve();
    });

    socket.on("error", (err) => {
      if (finished) return;
      finished = true;

      socket.destroy();
      plc.isConnected = false;
      plc.lastLatency = null;
      plc.lastCheckTime = new Date().toISOString();

      console.log(
        `[PLC CONNECT] ❌ ${plc.name}: ${err.code || err.message}`
      );
      resolve();
    });
  });
}


async function periodicCheck() {
  console.log("\n=== 🔄 CEK KONEKSI PLC ===");
  for (const plc of clients) {
    await testConnection(plc);
  }
  setTimeout(periodicCheck, 10000);
}

// ✅ API SERVER
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (req.method === "GET" && parsedUrl.pathname === "/api/connection-status") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");

    return res.end(JSON.stringify({
      status: "success",
      timestamp: new Date().toISOString(),
      data: clients.map((plc) => ({
        plc_id: plc.id,
        plc_name: plc.name,
        ip: plc.ip,
        port: plc.port,
        isConnected: plc.isConnected,
        latency: plc.lastLatency,
        lastCheckTime: plc.lastCheckTime,
      })),
    }));
  }

  if (req.method === "GET" && parsedUrl.pathname === "/") {
    const file = path.join(__dirname, "public", "connection-test.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("connection-test.html NOT FOUND in /public");
    }

    const html = fs.readFileSync(file, "utf8");
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(html);
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(API_PORT, () => {
  console.log(`[SERVER] Test berjalan di http://localhost:${API_PORT}`);
  periodicCheck();
});
