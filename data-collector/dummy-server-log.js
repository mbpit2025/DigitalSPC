// ============================================================================
// 🛠️ Dummy Server (Modbus Simulator + History Processor)
// ============================================================================

require("dotenv").config();
const { DateTime } = require("luxon");

const {
  PLCS,
  DATA_POINTS_MAP,
  POLLING_INTERVAL,
  GLOBAL_DEFAULT_RANGE,
} = require("./config");

const { pushLatestData } = require("./websocket/ws-emitter");
const { saveHistoricalDataLog, dbQuery } = require("./database/db-client");
const {
  initTableForToday,
  startDailyCleaner,
  historyProcessorLoopLog,
} = require("./functions/databasefunction");



// ============================================================================
// 🔁 TAG → PARAMETER MAPPING (berdasarkan standard)
// ============================================================================
const TAG_TO_PARAM_MAP = {
  "1": { data2: "HOT_TEMP", data3: "HOT_TEMP", data4: "COLD_TEMP", data5: "COLD_TEMP", data6: "COLD_TEMP", data7: "COLD_TEMP", data8: "HOT_TEMP", data9: "HOT_TEMP" },
  "4": { data2: "HOT_TEMP", data3: "HOT_TEMP", data4: "COLD_TEMP", data5: "COLD_TEMP", data6: "COLD_TEMP", data7: "COLD_TEMP", data8: "HOT_TEMP", data9: "HOT_TEMP" },

  "2": { data2: "PR_UP_TEMP", data3: "PR_OT_TEMP", data4: "PM1_UP_TEMP", data5: "PM1_OT_TEMP", data6: "PM2_UP_TEMP", data7: "PM2_OT_TEMP", data8: "CM_UP_TEMP", data9: "CM_OT_TEMP" },
  "5": { data2: "PR_UP_TEMP", data3: "PR_OT_TEMP", data4: "PM1_UP_TEMP", data5: "PM1_OT_TEMP", data6: "PM2_UP_TEMP", data7: "PM2_OT_TEMP", data8: "CM_UP_TEMP", data9: "CM_OT_TEMP" },

  "3": { data2: "CH_UP_TEMP", data3: "CH_OT_TEMP" },
  "6": { data2: "CH_UP_TEMP", data3: "CH_OT_TEMP" },
};


// ============================================================================
// 🧠 GLOBAL CACHE
// ============================================================================
let activeModelsCache = {};      // { "B1-01": 13 }
let activeModelNameCache = {};   // { "B1-01": "ML515" }
let standardsCache = {};         // { "B1-01": { HOT_TEMP: { min, max } } }


// ============================================================================
// ⚙️ ENV CONFIG
// ============================================================================
const ENABLE_POLLING = process.env.ENABLE_POLLING === "true";
const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER === "true";

const START_HOUR = parseInt(process.env.START_HOUR || "7", 10);
const START_MINUTE = parseInt(process.env.START_MINUTE || "0", 10);

const END_HOUR = parseInt(process.env.END_HOUR || "23", 10);
const END_MINUTE = parseInt(process.env.END_MINUTE || "50", 10);

const JAKARTA_TIMEZONE = "Asia/Jakarta";


// ============================================================================
// 🖨️ DISPLAY CONFIG
// ============================================================================
console.log("=========================================");
console.log("🕒 Dummy Server Configuration");
console.log(`- ENABLE_POLLING   : ${ENABLE_POLLING}`);
console.log(`- ENABLE_SCHEDULER : ${ENABLE_SCHEDULER}`);
console.log(`- START_TIME       : ${START_HOUR}:${String(START_MINUTE).padStart(2, "0")} WIB`);
console.log(`- END_TIME         : ${END_HOUR}:${String(END_MINUTE).padStart(2, "0")} WIB`);
console.log("=========================================");


// ============================================================================
// 🔧 UTIL: Random Decimal in Range
// ============================================================================
function randomInRangeDecimal(min, max) {
  const scaledMin = Math.ceil(min * 10);
  const scaledMax = Math.floor(max * 10);
  const rand = Math.floor(Math.random() * (scaledMax - scaledMin + 1)) + scaledMin;
  return parseFloat((rand / 10).toFixed(1));
}


// ============================================================================
// 🔄 REFRESH STANDARD & MODEL STATUS DARI DB
// ============================================================================
async function refreshStandards() {
  try {
    const activeModels = {};
    const activeModelNames = {};
    const standards = {};

    // ▶ Ambil model aktif
    const modelRows = await dbQuery(`
      SELECT line_name, model_id, model_name
      FROM line_model_status
      WHERE status = 'RUNNING'
      GROUP BY line_name
    `);

    for (const r of modelRows) {
      activeModels[r.line_name] = r.model_id;
      activeModelNames[r.line_name] = r.model_name;
    }

    // ▶ Ambil standard tiap model
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
    activeModelNameCache = activeModelNames;
    standardsCache = standards;

    console.log(`✅ Standards refreshed (${Object.keys(standardsCache).length} line updated)`);

  } catch (err) {
    console.error("[STANDARDS] Failed:", err.message || err);
  }
}


// ============================================================================
// 🎲 GENERATE DUMMY DATA
// ============================================================================
const statusTracker = {}; 
// State lokal untuk melacak durasi abnormal/normal per tag
const alarmStatesLocal = new Map(); // key: `${plc_id}_${tag_name}`

function generateDummyData() {
  if (!Array.isArray(PLCS) || PLCS.length === 0) {
    console.error("❌ PLCS is empty");
    return [];
  }

  const now = DateTime.now().setZone(JAKARTA_TIMEZONE);
  const timestamp = now.toISO();
  const nowMs = now.toMillis();
  const results = [];

  // Helper: simpan alarm ke DB jika perlu
  async function handleAlarmCheck(plcId, tagName, value, stdMin, stdMax) {
    const key = `${plcId}_${tagName}`;
    const state = alarmStatesLocal.get(key) || {
      lastAbnormal: null,
      lastNormal: null,
      hasActiveAlarm: false,
    };

    const isAbnormal = value < stdMin || value > stdMax;
    const alarmType = value < stdMin ? "LOW" : "HIGH";
    const threshold = value < stdMin ? stdMin : stdMax;

    // ========== JIKA ABNORMAL ==========
    if (isAbnormal) {
      if (!state.lastAbnormal) state.lastAbnormal = now;
      const abnormalDuration = now.diff(state.lastAbnormal).as("milliseconds");

      // Cek apakah sudah ada alarm aktif di DB (untuk menghindari duplikat)
      if (!state.hasActiveAlarm) {
        const activeAlarm = await dbQuery(
          `SELECT 1 FROM alarm_log WHERE plc_id = ? AND tag_name = ? AND status = 'ACTIVE'`,
          [plcId, tagName]
        );

        state.hasActiveAlgarm = activeAlarm.length > 0;
      }

      // Jika belum ada alarm aktif, dan durasi ≥ 10 detik → buat alarm baru
      if (!state.hasActiveAlarm && abnormalDuration >= 10_000) {
        await dbQuery(
          `
          INSERT INTO alarm_log 
          (plc_id, tag_name, alarm_type, violated_value, treshold_value, alarm_time, status)
          VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
          `,
          [plcId, tagName, alarmType, value, threshold, now.toISO()]
        );

        console.log(`🚨 [ALARM INSERTED] PLC ${plcId}-${tagName} = ${value} out of [${stdMin}–${stdMax}]`);
        state.hasActiveAlarm = true;
        state.lastNormal = null;
      }
    }

    // ========== JIKA NORMAL ==========
    else {
      // Reset abnormal timer
      state.lastAbnormal = null;

      // Jika sebelumnya punya alarm aktif, mulai hitung durasi normal
      if (state.hasActiveAlarm) {
        if (!state.lastNormal) state.lastNormal = now;
        const normalDuration = now.diff(state.lastNormal).as("milliseconds");

        if (normalDuration >= 15_000) {
          // Resolve alarm
          await dbQuery(
            `UPDATE alarm_log 
             SET status = 'RESOLVED', resolved_at = ? 
             WHERE plc_id = ? AND tag_name = ? AND status = 'ACTIVE'`,
            [now.toISO(), plcId, tagName]
          );

          console.log(`✅ [ALARM RESOLVED] PLC ${plcId}-${tagName} back to normal`);
          state.hasActiveAlarm = false;
          state.lastNormal = null;
        }
      } else {
        // Jika tidak pernah abnormal, reset semua
        state.lastNormal = null;
      }
    }

    alarmStatesLocal.set(key, state);
  }
// Log hanya data yang sedang dalam status alarm aktif
    const activeAlarms = Array.from(alarmStatesLocal.entries())
      .filter(([, state]) => state.hasActiveAlarm)
      .map(([key, state]) => ({ key, ...state }));

    if (activeAlarms.length > 0) {
      console.log("🔔 [ACTIVE ALARMS]", activeAlarms);
    } else {
      console.log("🔕 Tidak ada alarm aktif saat ini.");
    }

  // Iterasi data
  PLCS.forEach((plc) => {
    DATA_POINTS_MAP.forEach((point) => {
      const tagName = point.tag_name;
      const key = `${plc.id}|${tagName}`;
      const lineName = parseInt(plc.id) <= 3 ? "B1-01" : "B1-02";
      const param = TAG_TO_PARAM_MAP?.[plc.id]?.[tagName];

      // === GENERATE VALUE (dari config) ===
      let genMin, genMax;
      let range = plc.tagRanges?.default || GLOBAL_DEFAULT_RANGE;
      if (plc.tagRanges) {
        for (const keyRange in plc.tagRanges) {
          if (keyRange !== "default" && keyRange.split("|").includes(tagName)) {
            range = plc.tagRanges[keyRange];
            break;
          }
        }
      }
      genMin = range.min;
      genMax = range.max;
      const value = randomInRangeDecimal(genMin, genMax);

      // === REPORT MIN/MAX (dari standard) ===
      let reportMin = genMin;
      let reportMax = genMax;
      if (lineName && param && standardsCache?.[lineName]?.[param]) {
        reportMin = standardsCache[lineName][param].min;
        reportMax = standardsCache[lineName][param].max;
      }

      // === STATUS LOGIC (berdasarkan standard) ===
      let status = "normal";
      const inRange = value >= reportMin && value <= reportMax;
      if (inRange) {
        delete statusTracker[key];
        status = "normal";
      } else {
        if (!statusTracker[key]) {
          statusTracker[key] = { firstOut: nowMs };
          status = "warning";
        } else {
          const diff = nowMs - statusTracker[key].firstOut;
          status = diff >= 10_000 ? "abnormal" : "warning";
        }
      }

      // === HANDLE ALARM (async side-effect) ===
      // Jalankan pengecekan alarm secara async (tanpa menunggu)
      handleAlarmCheck(plc.id, tagName, value, reportMin, reportMax, lineName).catch(console.error);

      // === PUSH DATA ===
      results.push({
        line_name: lineName,
        model_id: activeModelsCache[lineName] || null,
        model_name: activeModelNameCache[lineName] || null,
        plc_id: plc.id,
        plc_name: plc.name,
        tag_name: tagName,
        value,
        min: reportMin,
        max: reportMax,
        status,
        timestamp,
      });
    });
  });

  return results;
}

// ============================================================================
// 🔄 POLLING LOOP
// ============================================================================
async function pollingLoop() {
  if (!ENABLE_POLLING) {
    console.log("⏸️ Polling disabled");
    return;
  }

  const now = DateTime.now().setZone(JAKARTA_TIMEZONE);
  const endOfDay = now.set({ hour: END_HOUR, minute: END_MINUTE, second: 0, millisecond: 0 });

  // Scheduler stop
  if (ENABLE_SCHEDULER && now >= endOfDay) {
    console.log(`⏹️ Reached end-time (${END_HOUR}:${END_MINUTE}). Rescheduling...`);
    schedulePollingStart(true);
    return;
  }

  // Refresh standard + generate dummy data
  await refreshStandards();
  const data = generateDummyData();

  // console.log({data_dummy: data})

  try {
    pushLatestData(data);
    await saveHistoricalDataLog(data);
    console.log(`✅ Generated & saved ${data.length} points`);
  } catch (err) {
    console.error("❌ Failed to process data:", err.message);
  }

  setTimeout(pollingLoop, POLLING_INTERVAL);
}


// ============================================================================
// 🕰️ DAILY SCHEDULER
// ============================================================================
function schedulePollingStart(isReschedule = false) {
  const now = DateTime.now().setZone(JAKARTA_TIMEZONE);
  let target = now.set({
    hour: START_HOUR,
    minute: START_MINUTE,
    second: 0,
    millisecond: 0,
  });

  if (isReschedule || now >= target) {
    target = target.plus({ days: 1 });
    console.log(`⏭️ Next start: ${target.toFormat("yyyy-MM-dd HH:mm")}`);
  }

  const delayMs = target.diff(now).toMillis();

  if (delayMs > 0) {
    console.log(`⏳ Starting in ${Math.ceil(delayMs / 60000)} minute(s)`);
    setTimeout(() => {
      console.log(`▶️ Started at scheduled time`);
      pollingLoop();
    }, delayMs);
  } else {
    console.log("▶️ Starting immediately");
    pollingLoop();
  }
}


// ============================================================================
// 🚀 ENTRY POINT
// ============================================================================
async function startDummyCollector() {
  console.log("=========================================");
  console.log("🚀 Dummy Data Generator Started");

  try {
    await initTableForToday();
    startDailyCleaner();
    historyProcessorLoopLog();
  } catch (err) {
    console.error("❌ Initialization failed:", err.message);
    return;
  }

  if (ENABLE_POLLING) {
    if (ENABLE_SCHEDULER) {
      console.log("🕒 Scheduler enabled");
      schedulePollingStart();
    } else {
      console.log("🟢 Scheduler disabled — running continuously");
      pollingLoop();
    }
  } else {
    console.log("⚠️ Polling disabled (ENABLE_POLLING=false)");
  }

  console.log("=========================================");
}

startDummyCollector();
