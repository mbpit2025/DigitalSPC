// dummy-server.js
require("dotenv").config();
const { DateTime } = require("luxon");
const {
  PLCS,
  DATA_POINTS_MAP,
  POLLING_INTERVAL,
  GLOBAL_DEFAULT_RANGE,
} = require("./config");
const { pushLatestData } = require("./websocket/ws-emitter");
const { saveHistoricalData } = require("./database/db-client");
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
// 🧠 GLOBAL CACHE (harus di luar fungsi!)
// ============================================================
let activeModelsCache = {};      // { "B1-01": 13, "B1-02": 14 }
let activeModelNameCache = {};  // { "B1-01": "ML515", ... }
let standardsCache = {};         // { "B1-01": { "HOT_TEMP": { min: 80, max: 90 }, ... } }

// ============================================================
// ⚙️ CONFIGURABLE SETTINGS via .env
// ============================================================
const ENABLE_POLLING = process.env.ENABLE_POLLING === "true";
const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER === "true";

const START_HOUR = parseInt(process.env.START_HOUR || "7", 10);
const START_MINUTE = parseInt(process.env.START_MINUTE || "0", 10);
const END_HOUR = parseInt(process.env.END_HOUR || "23", 10);
const END_MINUTE = parseInt(process.env.END_MINUTE || "50", 10);
const JAKARTA_TIMEZONE = "Asia/Jakarta";

// ============================================================
// 🕒 Log Info Jadwal Aktif
// ============================================================
console.log("=========================================");
console.log("🕒 Dummy Server Configuration");
console.log(`- ENABLE_POLLING   : ${ENABLE_POLLING}`);
console.log(`- ENABLE_SCHEDULER : ${ENABLE_SCHEDULER}`);
console.log(`- START_TIME       : ${START_HOUR}:${START_MINUTE.toString().padStart(2, "0")} WIB`);
console.log(`- END_TIME         : ${END_HOUR}:${END_MINUTE.toString().padStart(2, "0")} WIB`);
console.log("=========================================");

// ============================================================
// 📏 UTILS
// ============================================================
function randomInRangeDecimal(min, max) {
  const scaledMin = Math.ceil(min * 10);
  const scaledMax = Math.floor(max * 10);
  const rand = Math.floor(Math.random() * (scaledMax - scaledMin + 1)) + scaledMin;
  return parseFloat((rand / 10).toFixed(1));
}

// ============================================================
// 🔄 REFRESH STANDARDS & MODELS (dari database)
// ============================================================
async function refreshStandards() {
  try {
    const activeModels = {};
    const activeModelName = {};
    const standards = {};

    // Dapatkan model aktif per line
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

    // Dapatkan standar per model
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

    // Update cache global
    activeModelsCache = activeModels;
    activeModelNameCache = activeModelName;
    standardsCache = standards;

    console.log(`✅ Standards refreshed: ${Object.keys(standardsCache).length} line(s)`);
  } catch (err) {
    console.error("[STANDARDS] Failed to load:", err.message || err);
  }
}

// ============================================================
// 🎲 GENERATE DUMMY DATA
// ============================================================
function generateDummyData() {
  if (!Array.isArray(PLCS) || PLCS.length === 0) {
    console.error("❌ PLCS is empty!");
    return [];
  }

  const data = [];
  const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();

  PLCS.forEach((plc) => {
    DATA_POINTS_MAP.forEach((point) => {
      const tagName = point.tag_name;

      // ➤ Tentukan line_name berdasarkan plc.id
      const line_name = parseInt(plc.id) <= 3 ? "B1-01" : "B1-02";

      // ➤ Mapping tag → parameter fisik (e.g., data2 → HOT_TEMP)
      const paramName = TAG_TO_PARAM_MAP[plc.id]?.[tagName];

      let min = null, max = null;

      // 🔍 Coba dari standardsCache (prioritas utama)
      if (paramName && standardsCache[line_name]?.[paramName]) {
        const std = standardsCache[line_name][paramName];
        min = std.min;
        max = std.max;
      }

      // 🔄 Fallback ke tagRanges jika tidak ada di DB
      if (min === null || max === null) {
        if (plc.tagRanges) {
          let range = plc.tagRanges.default || GLOBAL_DEFAULT_RANGE;
          for (const key in plc.tagRanges) {
            if (key !== "default" && key.split("|").includes(tagName)) {
              range = plc.tagRanges[key];
              break;
            }
          }
          min = range.min;
          max = range.max;
        } else {
          min = GLOBAL_DEFAULT_RANGE.min;
          max = GLOBAL_DEFAULT_RANGE.max;
        }
      }

      // 🎯 Generate nilai acak dalam rentang
      const value = randomInRangeDecimal(min, max);

      // 📦 Kemas data
      data.push({
        line_name,
        model_id: activeModelsCache[line_name] || null,
        model_name: activeModelNameCache[line_name] || null,
        plc_id: plc.id,
        plc_name: plc.name,
        tag_name: tagName,
        value,
        min,
        max,
        timestamp,
      });
    });
  });

  return data;
}

// ============================================================
// 🔄 POLLING LOOP
// ============================================================
async function pollingLoop() {
  if (!ENABLE_POLLING) {
    console.log("⏸️ Polling disabled (ENABLE_POLLING=false)");
    return;
  }

  const now = DateTime.now().setZone(JAKARTA_TIMEZONE);
  const endOfDay = now.set({ hour: END_HOUR, minute: END_MINUTE, second: 0, millisecond: 0 });

  if (ENABLE_SCHEDULER && now >= endOfDay) {
    console.log(`[⏹️] Stopped at ${END_HOUR}:${END_MINUTE} WIB. Rescheduling for tomorrow.`);
    schedulePollingStart(true);
    return;
  }

  // 🔁 Refresh standards & generate data
  await refreshStandards();
  const data = generateDummyData();

  // 📤 Kirim ke WebSocket & simpan ke DB
  try {
    pushLatestData(data);
    await saveHistoricalData(data);
    console.log(`[✅] Generated & saved ${data.length} data points`);
  } catch (err) {
    console.error("❌ Failed to save/push data:", err.message);
  }

  setTimeout(pollingLoop, POLLING_INTERVAL);
}

// ============================================================
// 🕰️ SCHEDULER (opsional)
// ============================================================
function schedulePollingStart(isReschedule = false) {
  const now = DateTime.now().setZone(JAKARTA_TIMEZONE);
  let target = now.set({ hour: START_HOUR, minute: START_MINUTE, second: 0, millisecond: 0 });

  if (isReschedule || now >= target) {
    target = target.plus({ days: 1 });
    console.log(`[⏭️] Next start: ${target.toFormat("yyyy-MM-dd HH:mm")} WIB`);
  }

  const delayMs = target.diff(now).toMillis();
  if (delayMs > 0) {
    console.log(`[⏳] Starting in ${Math.ceil(delayMs / 60000)} minute(s)`);
    setTimeout(() => {
      console.log(`\n[▶️] Dummy generator STARTED at ${START_HOUR}:${START_MINUTE} WIB`);
      pollingLoop();
    }, delayMs);
  } else {
    console.log("[▶️] Starting immediately");
    pollingLoop();
  }
}

// ============================================================
// 🚀 ENTRY POINT
// ============================================================
async function startDummyCollector() {
  console.log("=========================================");
  console.log("🚀 Dummy Data Generator Started");

  try {
    await initTableForToday();
    startDailyCleaner();
    historyProcessorLoop();
    startAlarmChecker();
  } catch (err) {
    console.error("❌ Init failed:", err.message);
    return;
  }

  if (ENABLE_POLLING) {
    if (ENABLE_SCHEDULER) {
      console.log("✅ Scheduler enabled — will follow time window");
      schedulePollingStart();
    } else {
      console.log("🟢 Scheduler disabled — running continuously");
      pollingLoop();
    }
  } else {
    console.log("⚠️ Polling disabled (set ENABLE_POLLING=true to enable)");
  }

  console.log("=========================================");
}

// Jalankan
startDummyCollector();