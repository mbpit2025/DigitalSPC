// alarm/alarm-checker.js
const { DateTime } = require("luxon");
const { dbQuery } = require("../database/db-client");
const {
  POLLING_INTERVAL,
} = require("../config");

const JAKARTA_TZ = "Asia/Jakarta";
const CHECK_INTERVAL_MS = POLLING_INTERVAL; // cek setiap 5 detik
const ALARM_ACTIVE_DELAY_MS = 5000; // 1 menit
const ALARM_RESOLVE_DELAY_MS = 5000; // 3 menit
const AUTO_RESYNC_INTERVAL_MS = 60_000;

// mapping tag_name PLC ke parameter standard
const TAG_TO_PARAM_MAP = {
  1: { // PLC ID 1
    data2: "HOT_TEMP",
    data3: "HOT_TEMP",
    data4: "COLD_TEMP",
    data5: "COLD_TEMP",
    data6: "COLD_TEMP",
    data7: "COLD_TEMP",
    data8: "HOT_TEMP",
    data9: "HOT_TEMP",
  },
  4: { // PLC ID 1
    data2: "HOT_TEMP",
    data3: "HOT_TEMP",
    data4: "COLD_TEMP",
    data5: "COLD_TEMP",
    data6: "COLD_TEMP",
    data7: "COLD_TEMP",
    data8: "HOT_TEMP",
    data9: "HOT_TEMP",
  },
  2: { // PLC ID 1
    data2: "PR_UP_TEMP",
    data3: "PR_OT_TEMP",
    data4: "PM1_UP_TEMP",
    data5: "PM1_OT_TEMP",
    data6: "PM2_UP_TEMP",
    data7: "PM2_OT_TEMP",
    data8: "CM_UP_TEMP",
    data9: "CM_OT_TEMP",
  },
  5: { // PLC ID 1
    data2: "PR_UP_TEMP",
    data3: "PR_OT_TEMP",
    data4: "PM1_UP_TEMP",
    data5: "PM1_OT_TEMP",
    data6: "PM2_UP_TEMP",
    data7: "PM2_OT_TEMP",
    data8: "CM_UP_TEMP",
    data9: "CM_OT_TEMP",
  },
  3: {
    data2: "CH_UP_TEMP",
    data3: "CH_OT_TEMP",
  },
  6: {
    data2: "CH_UP_TEMP",
    data3: "CH_OT_TEMP",
  }
  

};

// state sementara untuk tiap alarm
const alarmStates = new Map();

async function getActiveModels() {
  const sql = `
    SELECT line_name, model_id, model_name, status 
    FROM line_model_status 
    WHERE status = 'RUNNING' 
    GROUP BY line_name
  `;
  const rows = await dbQuery(sql);
  const result = {};
  for (const r of rows) result[r.line_name] = r.model_id;
  return result;
}

async function getStandardByModel(model_id) {
  const sql = `SELECT parameter_name, min_value, max_value FROM standard WHERE model_id = ?`;
  const rows = await dbQuery(sql, [model_id]);
  const map = {};
  for (const r of rows) {
    map[r.parameter_name] = { min: r.min_value, max: r.max_value };
  }
  return map;
}

async function checkAlarms() {
  try {
    const now = DateTime.now().setZone(JAKARTA_TZ);
    console.log(`\n[ALARM CHECK] ${now.toISO()} — Cek alarm dari database`);

    const latestRows = await dbQuery(`SELECT * FROM v_latest_plc_data`);
    console.log(`[CHECK] Ditemukan data terbaru: ${latestRows.length} baris`);

    const activeModels = await getActiveModels();

    const standardsByModel = {};
    for (const line in activeModels) {
      const modelId = activeModels[line];
      standardsByModel[line] = await getStandardByModel(modelId);
    }

    for (const row of latestRows) {
      const { plc_id, tag_name, value } = row;
      const line_name = plc_id <= 3 ? "B1-01" : "B1-02";
      const paramName = TAG_TO_PARAM_MAP[plc_id]?.[tag_name];
      if (!paramName) continue;

      const standard = standardsByModel[line_name]?.[paramName];
      if (!standard) continue;

      const { min, max } = standard;
      const key = `${line_name}_${plc_id}_${tag_name}`;
      const val = parseFloat(value);
      const isAbnormal = val < min || val > max;
      const alarm_type = val < min ? "LOW" : "HIGH";
      const treshold = val < min ? min : max;

      const prevState = alarmStates.get(key) || {
        isActive: false,
        lastAbnormal: null,
        lastNormal: null,
        logged: false,
      };

      console.log(
        `[CHECK] PLC ${plc_id} | Line ${line_name} | Tag ${tag_name} (${paramName}) → Value: ${val}, Min: ${min}, Max: ${max} → ${
          isAbnormal ? "⚠️ ABNORMAL" : "✅ NORMAL"
        }`
      );

      // ======================================================
      // 🚨 Kondisi ABNORMAL
      // ======================================================
      if (isAbnormal) {
        if (!prevState.lastAbnormal) prevState.lastAbnormal = now;
        const duration = now.diff(prevState.lastAbnormal).as("milliseconds");

        if (!prevState.logged && duration >= ALARM_ACTIVE_DELAY_MS) {
          console.log(`🚨 [ALARM] PLC ${plc_id} - ${tag_name} (${val}) out of range [${min}–${max}]`);
          prevState.isActive = true;
          prevState.logged = true;
          prevState.lastNormal = null;

          const insertSql = `
            INSERT INTO alarm_log (plc_id, tag_name, alarm_type, violated_value, treshold_value, alarm_time, status)
            VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
          `;
          await dbQuery(insertSql, [plc_id, tag_name, alarm_type, val, treshold, now.toISO()]);
        }
      }

      // ======================================================
      // ✅ Kondisi NORMAL
      // ======================================================
      else {
        // 🔍 Cek dulu apakah masih ada alarm aktif di DB
        const checkSql = `
          SELECT id FROM alarm_log 
          WHERE plc_id = ? AND tag_name = ? AND status = 'ACTIVE'
          ORDER BY alarm_time DESC LIMIT 1
        `;
        const activeAlarms = await dbQuery(checkSql, [plc_id, tag_name]);

        if (activeAlarms.length > 0) {
          if (!prevState.lastNormal) prevState.lastNormal = now;
          const durationNormal = now.diff(prevState.lastNormal).as("milliseconds");

          if (durationNormal >= ALARM_RESOLVE_DELAY_MS) {
            console.log(`✅ [RESOLVED] PLC ${plc_id} - ${tag_name} kembali normal (Value: ${val}, Range: ${min}–${max})`);

            const updateSql = `
              UPDATE alarm_log 
              SET status = 'RESOLVED', resolved_at = ? 
              WHERE plc_id = ? AND tag_name = ? AND status = 'ACTIVE'
            `;
            await dbQuery(updateSql, [now.toISO(), plc_id, tag_name]);

            prevState.isActive = false;
            prevState.logged = false;
            prevState.lastAbnormal = null;
            prevState.lastNormal = null;
          }
        } else {
          prevState.lastAbnormal = null;
          prevState.isActive = false;
          prevState.logged = false;
        }
      }

      alarmStates.set(key, prevState);
    }
  } catch (err) {
    console.error("[ALARM ERROR]", err);
  } finally {
    setTimeout(checkAlarms, CHECK_INTERVAL_MS);
  }
}


async function resolveFromDatabaseIfNormal() {
  try {
    const now = DateTime.now().setZone(JAKARTA_TZ);
    console.log(`[AUTO-RESYNC] ${now.toISO()} — Cek alarm aktif di DB`);

    const activeSql = `
      SELECT a.id, a.plc_id, a.tag_name, v.value
      FROM alarm_log a
      JOIN v_latest_plc_data v ON v.plc_id = a.plc_id AND v.tag_name = a.tag_name
      WHERE a.status = 'ACTIVE'
    `;
    const rows = await dbQuery(activeSql);

    if (rows.length === 0) return;

    const activeModels = await getActiveModels();
    const standardsByModel = {};
    for (const line in activeModels) {
      const modelId = activeModels[line];
      standardsByModel[line] = await getStandardByModel(modelId);
    }

    for (const r of rows) {
      const { id, plc_id, tag_name, value } = r;
      const line_name = plc_id <= 3 ? "B1-01" : "B1-02";
      const paramName = TAG_TO_PARAM_MAP[plc_id]?.[tag_name];
      if (!paramName) continue;

      const standard = standardsByModel[line_name]?.[paramName];
      if (!standard) continue;

      const val = parseFloat(value);
      const min = parseFloat(standard.min);
      const max = parseFloat(standard.max);

      if (val >= min && val <= max) {
        await dbQuery(
          `UPDATE alarm_log SET status='RESOLVED', resolved_at=? WHERE id=?`,
          [now.toISO(), id]
        );
        console.log(`✅ [AUTO-RESYNC] PLC ${plc_id} ${tag_name} sudah normal, resolved otomatis`);
      }
    }
  } catch (err) {
    console.error("[AUTO-RESYNC ERROR]", err);
  } finally {
    setTimeout(resolveFromDatabaseIfNormal, AUTO_RESYNC_INTERVAL_MS);
  }
}


function startAlarmChecker() {
  console.log("🚨 Alarm Checker dimulai...");
  checkAlarms();
  resolveFromDatabaseIfNormal()
}

module.exports = { startAlarmChecker };
