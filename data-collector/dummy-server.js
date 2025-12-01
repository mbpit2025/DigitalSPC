
require("dotenv").config();
const { DateTime } = require("luxon");
const {
  PLCS,
  DATA_POINTS_MAP,
  POLLING_INTERVAL,
  GLOBAL_DEFAULT_RANGE,
} = require("./config");
const { pushLatestData } = require("./websocket/ws-emitter");
const {
  saveHistoricalData,
} = require("./database/db-client");
const {startAlarmChecker} = require("./alarm/alarm-checker")
const { initTableForToday, startDailyCleaner, historyProcessorLoop } = require("./functions/databasefunction");
const { dbQuery } = require("./database/db-client");

// 🔁 Reuse mapping dari alarm checker
const TAG_TO_PARAM_MAP = {
  1: { data2: "HOT_TEMP", data3: "HOT_TEMP", data4: "COLD_TEMP", data5: "COLD_TEMP", data6: "COLD_TEMP", data7: "COLD_TEMP", data8: "HOT_TEMP", data9: "HOT_TEMP" },
  4: { data2: "HOT_TEMP", data3: "HOT_TEMP", data4: "COLD_TEMP", data5: "COLD_TEMP", data6: "COLD_TEMP", data7: "COLD_TEMP", data8: "HOT_TEMP", data9: "HOT_TEMP" },
  2: { data2: "PR_UP_TEMP", data3: "PR_OT_TEMP", data4: "PM1_UP_TEMP", data5: "PM1_OT_TEMP", data6: "PM2_UP_TEMP", data7: "PM2_OT_TEMP", data8: "CM_UP_TEMP", data9: "CM_OT_TEMP" },
  5: { data2: "PR_UP_TEMP", data3: "PR_OT_TEMP", data4: "PM1_UP_TEMP", data5: "PM1_OT_TEMP", data6: "PM2_UP_TEMP", data7: "PM2_OT_TEMP", data8: "CM_UP_TEMP", data9: "CM_OT_TEMP" },
  3: { data2: "CH_UP_TEMP", data3: "CH_OT_TEMP" },
  6: { data2: "CH_UP_TEMP", data3: "CH_OT_TEMP" }
};

// Cache untuk standar per line — akan diisi sekali per polling loop
let standardsCache = {};
let activeModelsCache = {};

// =====================================================
// ⚙️ CONFIGURABLE SETTINGS via .env
// =====================================================
const ENABLE_POLLING = process.env.ENABLE_POLLING === "true";
const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER === "true";

const START_HOUR = parseInt(process.env.START_HOUR || "7", 10);
const START_MINUTE = parseInt(process.env.START_MINUTE || "0", 10);
const END_HOUR = parseInt(process.env.END_HOUR || "23", 10);
const END_MINUTE = parseInt(process.env.END_MINUTE || "50", 10);

const JAKARTA_TIMEZONE = "Asia/Jakarta";

// =====================================================
// 🕒 Log Info Jadwal Aktif
// =====================================================
console.log("=========================================");
console.log("🕒 Configuration Summary");
console.log(`- ENABLE_POLLING   : ${ENABLE_POLLING}`);
console.log(`- ENABLE_SCHEDULER : ${ENABLE_SCHEDULER}`);
console.log(
  `- START_TIME       : ${START_HOUR}:${START_MINUTE
    .toString()
    .padStart(2, "0")} WIB`
);
console.log(
  `- END_TIME         : ${END_HOUR}:${END_MINUTE
    .toString()
    .padStart(2, "0")} WIB`
);
console.log("=========================================");


// =====================================================
// 🔄 #3 Dummy Data Generator
// =====================================================
function randomInRangeDecimal(min, max) {
  const scaledMin = Math.ceil(min * 10);
  const scaledMax = Math.floor(max * 10);
  const randomNumberScaled =
    Math.floor(Math.random() * (scaledMax - scaledMin + 1)) + scaledMin;
  return randomNumberScaled / 10;
}

// function getTagsForPLC(plcId){
//   const plcCells = Object.values(PLCS).filter((cell) => cell.plcId === plcId);

//   const tags = new Set();
//   plcCells.forEach((cell) => {
//     Object.values(cell).forEach((v) => {
//       if (typeof v === "string" && v.startsWith("data")) {
//         tags.add(v);
//       }
//     });
//   });

//   return Array.from(tags);
// }

// 🔥 Generate dummy data sesuai PLCS
function generateDummyData() {
  if (!Array.isArray(PLCS) || PLCS.length === 0) {
    console.error("[DUMMY ERROR] PLCS tidak ditemukan atau kosong!");
    return [];
  }

  const data = [];
  const timestamp = DateTime.now().setZone("Asia/Jakarta").toISO();

  PLCS.forEach((plc) => {
    DATA_POINTS_MAP.forEach((point) => {
      const tagName = point.tag_name;
      let range = GLOBAL_DEFAULT_RANGE;
      let min = null;
      let max = null;

      const line_name = plc.id <= 3 ? "B1-01" : "B1-02";
      const paramName = TAG_TO_PARAM_MAP[plc.id]?.[tagName];

      if (paramName && standardsCache[line_name]?.[paramName]) {
        const std = standardsCache[line_name][paramName];
        min = std.min;
        max = std.max;
        range = { min, max };
      } else {
        if (plc.tagRanges) {
          let foundCustomRange = false;
          for (const key in plc.tagRanges) {
            if (key !== "default" && key.split("|").includes(tagName)) {
              range = plc.tagRanges[key];
              foundCustomRange = true;
              break;
            }
          }
          if (!foundCustomRange && plc.tagRanges.default) {
            range = plc.tagRanges.default;
          }
        }
        min = range.min;
        max = range.max;
      }

      const value = randomInRangeDecimal(min, max);

      data.push({
        line_name: line_name,
        model_id: activeModelsCache[line_name] || null,
        model_name: activeModelNameCache[line_name] || null, // ✅ PERBAIKAN DI SINI
        plc_id: plc.id,
        plc_name: plc.name,
        tag_name: tagName,
        value: value,
        min: min,
        max: max,
        timestamp: timestamp,
      });
    });
  });

  // console.log(JSON.stringify(data, null, 2)); 
  return data;
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
    activeModelNameCache = activeModelName; // <-- SIMPAN KE GLOBAL
    standardsCache = standards;

    // Opsional: log untuk debug
    // console.log("✅ Standards & models refreshed:", { activeModelsCache, activeModelNameCache });
  } catch (err) {
    console.error("[STANDARD ERROR] Gagal memuat standar:", err);
  }
}


async function pollingLoop() {
  if (!ENABLE_POLLING) {
    console.log("⚠️ Polling dinonaktifkan (ENABLE_POLLING=false)");
    return;
  }

  const currentTime = DateTime.now().setZone(JAKARTA_TIMEZONE);
  const endOfDay = currentTime.set({
    hour: END_HOUR,
    minute: END_MINUTE,
    second: 0,
    millisecond: 0,
  });

  if (ENABLE_SCHEDULER && currentTime >= endOfDay) {
    console.log(
      `[DUMMY STOP] 🛑 Sudah mencapai jam ${END_HOUR}:${END_MINUTE} WIB. Menghentikan generator.`
    );
    schedulePollingStart(true);
    return;
  }

  // ✅ Refresh standar sebelum generate data
  await refreshStandards();

  const data = generateDummyData();
  pushLatestData(data); 

  try {
    await saveHistoricalData(data);
    console.log(`[DUMMY] Menyimpan setiap ${POLLING_INTERVAL / 1000} detik`);
  } catch (err) {
    console.error("[DUMMY ERROR] Gagal menyimpan data:", err);
  }

  setTimeout(pollingLoop, POLLING_INTERVAL);
}

function schedulePollingStart(isReschedule = false) {
  const NOW = DateTime.now().setZone(JAKARTA_TIMEZONE);
  let targetTime = NOW.set({
    hour: START_HOUR,
    minute: START_MINUTE,
    second: 0,
    millisecond: 0,
  });

  if (isReschedule || NOW >= targetTime) {
    targetTime = targetTime.plus({ days: 1 });
    console.log(
      `[RE-SCHEDULE] Menjadwalkan start besok: ${targetTime.toFormat(
        "yyyy-MM-dd HH:mm:ss"
      )} WIB`
    );
  } else {
    console.log(
      `[INIT] Menjadwalkan start pada ${targetTime.toFormat(
        "yyyy-MM-dd HH:mm:ss"
      )} WIB`
    );
  }

  const delayMs = targetTime.diff(NOW).toMillis();

  if (delayMs > 0) {
    console.log(
      `[TIMER] Dummy Data Generator akan mulai dalam ${Math.ceil(
        delayMs / 60000
      )} menit`
    );
    setTimeout(() => {
      console.log(
        `\n[START] ⏱️ ${START_HOUR}:${START_MINUTE} WIB — Dummy Generator dimulai.`
      );
      pollingLoop();
    }, delayMs);
  } else if (!isReschedule) {
    console.log(`[INIT] Start time sudah lewat, mulai segera.`);
    pollingLoop();
  }
}

// =====================================================
// 🟢 #4 Entry Point
// =====================================================
async function startDummyCollector() {
  console.log("=========================================");
  console.log("🚀 Dummy Collector & History Processor started.");

  await initTableForToday();
  startDailyCleaner();

  if (ENABLE_POLLING) {
    if (ENABLE_SCHEDULER) {
      console.log("✅ Scheduler aktif — mengikuti jadwal dari .env");
      schedulePollingStart();
    } else {
      console.log("🟢 Scheduler nonaktif — polling langsung berjalan.");
      pollingLoop();
    }
  } else {
    console.log("⏸️ Polling dummy dimatikan (ENABLE_POLLING=false)");
  }

  historyProcessorLoop();
  startAlarmChecker()

  console.log("=========================================");
}

startDummyCollector();
