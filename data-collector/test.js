const ModbusRTU = require("modbus-serial");
const http = require("http");

const { PLCS, DATA_POINTS_MAP, POLLING_INTERVAL } = require("./config");

const {
    saveHistoricalData,
    getLastDataTimestamp,
    cleanDataOlderThanToday,
    processAndStoreHistory,
} = require("./database/db-client");

const { DateTime } = require("luxon");
const cron = require("node-cron");

const JAKARTA_TIMEZONE = "Asia/Jakarta";
const CHECK_HISTORY_INTERVAL_MS = 15000;
const HISTORY_WINDOW_MINUTES = 20;
const API_PORT = 3001; // Port untuk API dan Dashboard

// Inisialisasi Klien PLC
const clients = PLCS.map((plc) => ({
    ...plc,
    client: new ModbusRTU(),
    isConnected: false,
}));

// --- Variabel Global untuk Menyimpan Data Terbaru (In-Memory Store) ---
let latestDataStore = [];
let lastUpdateTimestamp = null;

/**
 * @function storeLatestData
 * @description Menyimpan data terbaru ke memori.
 */
function storeLatestData(data) {
    latestDataStore = data; // Timpa data lama dengan data terbaru
    lastUpdateTimestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();
}

// -------------------------------------------------------------
// --- HTML TEMPLATE UNTUK FRONT-END DASHBOARD (LAYOUT HORIZONTAL) ---
// -------------------------------------------------------------
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PLC Latest Data Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #20232a; color: #f0f0f0; }
        h1 { color: #61dafb; }
        h2 { color: #f0f0f0; border-bottom: 2px solid #007bff; padding-bottom: 5px; margin-top: 10px; font-size: 1.2em;}
        #timestamp-container { margin-bottom: 20px; font-size: 0.9em; }
        #last-updated { font-weight: bold; margin-right: 20px; }
        #countdown { color: #ffeb3b; font-weight: bold; }

        /* --- PERUBAHAN UTAMA UNTUK LAYOUT HORIZONTAL --- */
        #plc-data-dashboard {
            display: flex; /* Menggunakan Flexbox */
            flex-direction: row; /* Menyusun item secara horizontal */
            gap: 20px; /* Jarak antar tabel */
            flex-wrap: nowrap; /* Mencegah tabel turun baris jika lebar cukup */
            overflow-x: auto; /* Memungkinkan scrolling horizontal jika terlalu banyak tabel */
        }
        .plc-table-container {
            min-width: 350px; /* Lebar minimum agar tabel tidak terlalu sempit */
            max-width: 400px; /* Batas lebar maksimum */
            flex-shrink: 0; /* Penting: mencegah tabel menyusut */
            margin-bottom: 20px;
        }
        /* ------------------------------------------------ */

        table { width: 100%; border-collapse: collapse; margin-top: 10px; background-color: #282c34; }
        th, td { border: 1px solid #3c4049; padding: 10px; text-align: left; font-size: 0.9em; }
        th { background-color: #007bff; color: white; }
        tr:nth-child(even) { background-color: #31363f; }
        .alert { color: #ff9800; background-color: #554100; font-weight: bold; text-align: center!important; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Real-Time Modbus Data Collector</h1>
    
    <div id="timestamp-container">
        <span id="last-updated">Loading...</span>
        | Refresh in: <span id="countdown">30</span>s ⏳
    </div>
    
    <div id="plc-data-dashboard">
        </div>

    <script>
        const API_URL = '/api/latest-data';
        const REFRESH_INTERVAL_MS = 30000; // 30 seconds refresh
        let countdownTimer;

        // Fungsi untuk memulai atau mengatur ulang penghitung waktu mundur
        function startCountdown() {
            clearInterval(countdownTimer); // Hentikan timer sebelumnya
            let seconds = REFRESH_INTERVAL_MS / 1000;
            const countdownEl = document.getElementById('countdown');
            countdownEl.textContent = seconds;

            countdownTimer = setInterval(() => {
                seconds--;
                countdownEl.textContent = seconds > 0 ? seconds : '0';

                if (seconds <= 0) {
                    clearInterval(countdownTimer);
                }
            }, 1000);
        }
        
        function groupDataByPlc(data) {
            return data.reduce((acc, item) => {
                const name = item.plc_name;
                if (!acc[name]) {
                    acc[name] = [];
                }
                acc[name].push(item);
                return acc;
            }, {});
        }

        async function fetchData() {
            try {
                // Hentikan dan mulai ulang counter setelah fetch berhasil
                startCountdown(); 
                
                const response = await fetch(API_URL);
                const result = await response.json();

                const dashboardContainer = document.getElementById('plc-data-dashboard');
                const lastUpdatedEl = document.getElementById('last-updated');
                dashboardContainer.innerHTML = ''; // Bersihkan semua tabel

                if (result.status === 'success' && result.data.length > 0) {
                    lastUpdatedEl.textContent = 'Last Data Poll: ' + new Date(result.timestamp).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
                    
                    const groupedData = groupDataByPlc(result.data);

                    for (const plcName in groupedData) {
                        const plcData = groupedData[plcName];
                        
                        // 1. Buat kontainer untuk PLC ini
                        const container = document.createElement('div');
                        container.className = 'plc-table-container';
                        
                        // 2. Tambahkan Judul PLC
                        const title = document.createElement('h2');
                        title.textContent = plcName; // Cukup nama PLC tanpa awalan "PLC: "
                        container.appendChild(title);
                        
                        // 3. Buat Struktur Tabel
                        const table = document.createElement('table');
                        table.innerHTML = \`
                            <thead>
                                <tr>
                                    <th>Tag Name</th>
                                    <th>Value</th>
                                    <th>Timestamp (WIB)</th>
                                </tr>
                            </thead>
                            <tbody></tbody>
                        \`;
                        const tbody = table.querySelector('tbody');
                        
                        // 4. Isi Baris Data
                        plcData.forEach(item => {
                            const row = tbody.insertRow();
                            row.insertCell().textContent = item.tag_name;
                            row.insertCell().textContent = item.value;
                            row.insertCell().textContent = new Date(item.timestamp).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
                        });

                        container.appendChild(table);
                        dashboardContainer.appendChild(container);
                    }
                } else if (result.status === 'warning' || result.data[0]?.type === 'ALERT') {
                    // Handle ALERT/Warning
                    lastUpdatedEl.textContent = 'Last Status Check: ' + new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
                    
                    const alertDiv = document.createElement('div');
                    alertDiv.className = 'alert';
                    alertDiv.textContent = result.message || result.data[0].message;
                    dashboardContainer.appendChild(alertDiv);

                } else {
                    lastUpdatedEl.textContent = 'No Data Available';
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                document.getElementById('last-updated').textContent = 'Koneksi API Gagal atau Server Offline!';
                clearInterval(countdownTimer); // Hentikan timer jika error
            }
        }

        // Jalankan sekali saat load, lalu set interval
        fetchData();
        setInterval(fetchData, REFRESH_INTERVAL_MS);
    </script>
</body>
</html>
`;

// -------------------------------------------------------------
// --- SETUP SERVER HTTP UNTUK API GET & HTML (TETAP SAMA) ---
// -------------------------------------------------------------

const server = http.createServer((req, res) => {
    // 1. API Endpoint (JSON Data)
    if (req.method === "GET" && req.url === "/api/latest-data") {
        res.setHeader("Content-Type", "application/json");

        let responseData;
        
        if (latestDataStore.length > 0) {
            responseData = {
                status: "success",
                timestamp: lastUpdateTimestamp,
                data: latestDataStore,
            };
            res.statusCode = 200;
        } else {
            responseData = {
                status: "warning",
                timestamp: lastUpdateTimestamp || new Date().toISOString(),
                message: "Tidak ada data PLC terbaru tersedia. Coba lagi nanti.",
                data: [],
            };
            res.statusCode = 200;
        }

        res.end(JSON.stringify(responseData));
    } 
    // 2. Root Path (HTML Dashboard)
    else if (req.method === "GET" && req.url === "/") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        res.end(HTML_TEMPLATE);
    } 
    // 3. 404 Not Found
    else {
        res.statusCode = 404; // Not Found
        res.setHeader("Content-Type", "text/plain");
        res.end("Endpoint Not Found");
    }
});

server.listen(API_PORT, () => {
    console.log(`[API SERVER] Server API berjalan di http://localhost:${API_PORT}`);
    console.log(`[FRONT-END] Dashboard tersedia di http://localhost:${API_PORT}/`);
});


// -------------------------------------------------------------
// --- FUNGSI-FUNGSI PENGUMPUL DATA (TETAP SAMA) ---
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
        const values = response.data;
        const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();

        DATA_POINTS_MAP.forEach((point, index) => {
            const rawValue = values[index];
            dataFromPlc.push({
                plc_id: String(plc.id),
                plc_name: plc.name,
                tag_name: point.tag_name,
                value: rawValue,
                timestamp,
            });
        });
    } catch (e) {
        console.error(`[PLC ERROR] Kesalahan Polling ${plc.name}: ${e.message}`);
        plc.isConnected = false;
    }

    return dataFromPlc;
}


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
        // 1. Simpan ke DB
        await saveHistoricalData(allLatestData);

        // 2. Simpan ke memori untuk diakses via API GET dan Dashboard
        storeLatestData(allLatestData);
    } else {
        // 🚨 Jika semua gagal, simpan alert ke memori
        storeLatestData([
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

async function historyProcessorLoop() {
    console.log("[HISTORY] History Processor started (Not Fully Implemented).");
    // ... Implementasi historyProcessorLoop
}


async function startCollector() {
    console.log("=========================================");
    console.log("🚀 Real Modbus Collector & History Processor started.");

    await connectAllPlcs();

    if (clients.some((c) => c.isConnected)) {
        console.log("Koneksi PLC berhasil. Memulai loop akuisisi dan history data.");
        pollingLoop();
        historyProcessorLoop();
    } else {
        console.error("Semua PLC GAGAL terhubung. Retry dalam 10 detik.");

        // 🚨 Kirim notifikasi awal gagal total
        storeLatestData([
            {
                type: "ALERT",
                message: "Collector gagal terhubung ke semua PLC saat startup. Mencoba kembali.",
                timestamp: new Date().toISOString(),
            },
        ]);

        setTimeout(startCollector, 10000);
    }
    console.log("=========================================");
}

startCollector();