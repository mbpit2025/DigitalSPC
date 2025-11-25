
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
  processAndStoreHistory,
} = require("./database/db-client");
const {startAlarmChecker} = require("./alarm/alarm-checker")
const { initTableForToday, startDailyCleaner, historyProcessorLoop } = require("./functions/databasefunction");

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

function generateDummyData() {
  const data = [];
  const timestamp = DateTime.now().setZone(JAKARTA_TIMEZONE).toISO();

  PLCS.forEach((plc) => {
    DATA_POINTS_MAP.forEach((point) => {
      const tagName = point.tag_name;
      let range = GLOBAL_DEFAULT_RANGE;

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

      const { min, max } = range;

      data.push({
        plc_id: plc.id,
        plc_name: plc.name,
        tag_name: tagName,
        value: randomInRangeDecimal(min, max),
        timestamp,
      });
    });
  });

  return data;
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

  const data = generateDummyData();
  pushLatestData(data);

  try {
    await saveHistoricalData(data);
    console.log(`[DUMMY] Menyimpan setiap ${POLLING_INTERVAL / POLLING_INTERVAL}s`);
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
