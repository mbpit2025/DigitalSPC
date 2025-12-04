// alarm/alarm-checker.js
const { DateTime } = require("luxon");
const { dbQuery } = require("../database/db-client");
const { POLLING_INTERVAL } = require("../config");

const JAKARTA_TZ = "Asia/Jakarta";
const CHECK_INTERVAL_MS = POLLING_INTERVAL;     // interval cek alarm
const ALARM_ACTIVE_DELAY_MS = 5000 * 12;        // 1 menit
const ALARM_RESOLVE_DELAY_MS = 5000 * 36;       // 3 menit
const AUTO_RESYNC_INTERVAL_MS = 60_000;         // resync ke DB setiap 1 menit

// Mapping PLC tag → parameter standard
const TAG_TO_PARAM_MAP = {
  1: { data2: "HOT_TEMP", data3: "HOT_TEMP", data4: "COLD_TEMP", data5: "COLD_TEMP", data6: "COLD_TEMP", data7: "COLD_TEMP", data8: "HOT_TEMP", data9: "HOT_TEMP" },
  4: { data2: "HOT_TEMP", data3: "HOT_TEMP", data4: "COLD_TEMP", data5: "COLD_TEMP", data6: "COLD_TEMP", data7: "COLD_TEMP", data8: "HOT_TEMP", data9: "HOT_TEMP" },
  2: { data2: "PR_UP_TEMP", data3: "PR_OT_TEMP", data4: "PM1_UP_TEMP", data5: "PM1_OT_TEMP", data6: "PM2_UP_TEMP", data7: "PM2_OT_TEMP", data8: "CM_UP_TEMP", data9: "CM_OT_TEMP" },
  5: { data2: "PR_UP_TEMP", data3: "PR_OT_TEMP", data4: "PM1_UP_TEMP", data5: "PM1_OT_TEMP", data6: "PM2_UP_TEMP", data7: "PM2_OT_TEMP", data8: "CM_UP_TEMP", data9: "CM_OT_TEMP" },
  3: { data2: "CH_UP_TEMP", data3: "CH_OT_TEMP" },
  6: { data2: "CH_UP_TEMP", data3: "CH_OT_TEMP" }
};

// State sementara alarm
const alarmStates = new Map();

// =============================================
// Helper: Ambil model yang sedang aktif per line
// =============================================
async function getActiveModels() {
  const sql = `
    SELECT line_name, model_id
    FROM line_model_status 
    WHERE status = 'RUNNING'
    GROUP BY line_name
  `;
  const rows = await dbQuery(sql);

  const result = {};
  for (const r of rows) result[r.line_name] = r.model_id;

  return result;
}

// =============================================
// Helper: Ambil standard dari DB
// =============================================
async function getStandardByModel(model_id) {
  const sql = `SELECT parameter_name, min_value, max_value FROM standard WHERE model_id = ?`;
  const rows = await dbQuery(sql, [model_id]);

  const map = {};
  for (const r of rows) {
    map[r.parameter_name] = { min: r.min_value, max: r.max_value };
  }
  return map;
}

// =============================================
// 🚨 MAIN: Cek alarm dari REAL DATABASE
// =============================================
async function checkAlarms() {
  try {
    const now = DateTime.now().setZone(JAKARTA_TZ);

    // Ambil latest PLC dari view
    const latestRows = await dbQuery(`SELECT * FROM v_latest_plc_data`);
    const activeModels = await getActiveModels();

    // Ambil standard tiap line
    const standardsByModel = {};
    for (const line in activeModels) {
      standardsByModel[line] = await getStandardByModel(activeModels[line]);
    }

    for (const row of latestRows) {
      const { plc_id, tag_name, value } = row;
      const val = parseFloat(value);

      const line_name = plc_id <= 3 ? "B1-01" : "B1-02";
      const paramName = TAG_TO_PARAM_MAP[plc_id]?.[tag_name];
      if (!paramName) continue;

      const std = standardsByModel[line_name]?.[paramName];
      if (!std) continue;

      const { min, max } = std;
      const key = `${line_name}_${plc_id}_${tag_name}`;
      const state = alarmStates.get(key) || {
        isActive: false,
        lastAbnormal: null,
        lastNormal: null,
        logged: false,
      };

      const isAbnormal = val < min || val > max;
      const alarm_type = val < min ? "LOW" : "HIGH";
      const treshold = val < min ? min : max;

      // ========== ABNORMAL ==========
      if (isAbnormal) {
        if (!state.lastAbnormal) state.lastAbnormal = now;
        const duration = now.diff(state.lastAbnormal).as("milliseconds");

        if (!state.logged && duration >= ALARM_ACTIVE_DELAY_MS) {
          console.log(`🚨 [ALARM] PLC ${plc_id}-${tag_name} (${val}) out of range [${min}–${max}]`);

          await dbQuery(
            `
            INSERT INTO alarm_log 
            (plc_id, tag_name, alarm_type, violated_value, treshold_value, alarm_time, status)
            VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
            `,
            [plc_id, tag_name, alarm_type, val, treshold, now.toISO()]
          );

          state.isActive = true;
          state.logged = true;
          state.lastNormal = null;
        }
      }

      // ========== NORMAL ==========
      else {
        const rows = await dbQuery(
          `
          SELECT id FROM alarm_log 
          WHERE plc_id=? AND tag_name=? AND status='ACTIVE'
          ORDER BY alarm_time DESC LIMIT 1
          `,
          [plc_id, tag_name]
        );

        if (rows.length > 0) {
          if (!state.lastNormal) state.lastNormal = now;

          const durationNormal = now.diff(state.lastNormal).as("milliseconds");
          if (durationNormal >= ALARM_RESOLVE_DELAY_MS) {
            await dbQuery(
              `UPDATE alarm_log SET status='RESOLVED', resolved_at=? WHERE plc_id=? AND tag_name=? AND status='ACTIVE'`,
              [now.toISO(), plc_id, tag_name]
            );

            console.log(`✅ [RESOLVED] PLC ${plc_id}-${tag_name} kembali normal`);
            state.isActive = false;
            state.logged = false;
            state.lastAbnormal = null;
            state.lastNormal = null;
          }
        } else {
          // reset fresh
          state.lastAbnormal = null;
          state.logged = false;
          state.isActive = false;
        }
      }

      alarmStates.set(key, state);
    }
  } catch (err) {
    console.error("[ALARM ERROR]", err);
  } finally {
    setTimeout(checkAlarms, CHECK_INTERVAL_MS);
  }
}

async function checkAlarmsLog() {
  try {
    const now = DateTime.now().setZone(JAKARTA_TZ);

    

    // Ambil latest PLC dari view
    const latestRows = await dbQuery(`SELECT * FROM v_latest_plc_data`);
    const activeModels = await getActiveModels();

    // Ambil standard tiap line
    const standardsByModel = {};
    for (const line in activeModels) {
      standardsByModel[line] = await getStandardByModel(activeModels[line]);
    }

    for (const row of latestRows) {
      const { plc_id, tag_name, value } = row;
      const val = parseFloat(value);

      const line_name = plc_id <= 3 ? "B1-01" : "B1-02";
      const paramName = TAG_TO_PARAM_MAP[plc_id]?.[tag_name];
      if (!paramName) continue;

      const std = standardsByModel[line_name]?.[paramName];
      if (!std) continue;

      const { min, max } = std;
      const key = `${line_name}_${plc_id}_${tag_name}`;
      const state = alarmStates.get(key) || {
        isActive: false,
        lastAbnormal: null,
        lastNormal: null,
        logged: false,
      };

      const isAbnormal = val < min || val > max;
      const alarm_type = val < min ? "LOW" : "HIGH";
      const treshold = val < min ? min : max;

      // ========== ABNORMAL ==========
      if (isAbnormal) {
        if (!state.lastAbnormal) state.lastAbnormal = now;
        const duration = now.diff(state.lastAbnormal).as("milliseconds");

        if (!state.logged && duration >= ALARM_ACTIVE_DELAY_MS) {
          console.log(`🚨 [ALARM] PLC ${plc_id}-${tag_name} (${val}) out of range [${min}–${max}]`);

          await dbQuery(
            `
            INSERT INTO alarm_log 
            (plc_id, tag_name, alarm_type, violated_value, treshold_value, alarm_time, status)
            VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
            `,
            [plc_id, tag_name, alarm_type, val, treshold, now.toISO()]
          );

          state.isActive = true;
          state.logged = true;
          state.lastNormal = null;
        }
      }

      // ========== NORMAL ==========
      else {
        const rows = await dbQuery(
          `
          SELECT id FROM alarm_log 
          WHERE plc_id=? AND tag_name=? AND status='ACTIVE'
          ORDER BY alarm_time DESC LIMIT 1
          `,
          [plc_id, tag_name]
        );

        if (rows.length > 0) {
          if (!state.lastNormal) state.lastNormal = now;

          const durationNormal = now.diff(state.lastNormal).as("milliseconds");
          if (durationNormal >= ALARM_RESOLVE_DELAY_MS) {
            await dbQuery(
              `UPDATE alarm_log SET status='RESOLVED', resolved_at=? WHERE plc_id=? AND tag_name=? AND status='ACTIVE'`,
              [now.toISO(), plc_id, tag_name]
            );

            console.log(`✅ [RESOLVED] PLC ${plc_id}-${tag_name} kembali normal`);
            state.isActive = false;
            state.logged = false;
            state.lastAbnormal = null;
            state.lastNormal = null;
          }
        } else {
          // reset fresh
          state.lastAbnormal = null;
          state.logged = false;
          state.isActive = false;
        }
      }

      alarmStates.set(key, state);
    }
  } catch (err) {
    console.error("[ALARM ERROR]", err);
  } finally {
    setTimeout(checkAlarms, CHECK_INTERVAL_MS);
  }
}

// =============================================
// AUTO RESYNC (REAL DB) — jika alarm aktif tapi data terkini sudah normal
// =============================================
async function resolveFromDatabaseIfNormal() {
  try {
    const now = DateTime.now().setZone(JAKARTA_TZ);

    const activeAlarms = await dbQuery(`
      SELECT a.id, a.plc_id, a.tag_name, v.value
      FROM alarm_log a
      JOIN v_latest_plc_data v ON v.plc_id = a.plc_id AND v.tag_name = a.tag_name
      WHERE a.status = 'ACTIVE'
    `);

    if (activeAlarms.length === 0) return;

    const activeModels = await getActiveModels();
    const standardsByModel = {};

    for (const line in activeModels) {
      standardsByModel[line] = await getStandardByModel(activeModels[line]);
    }

    for (const r of activeAlarms) {
      const { id, plc_id, tag_name, value } = r;
      const line_name = plc_id <= 3 ? "B1-01" : "B1-02";
      const paramName = TAG_TO_PARAM_MAP[plc_id]?.[tag_name];
      if (!paramName) continue;

      const std = standardsByModel[line_name]?.[paramName];
      if (!std) continue;

      const val = parseFloat(value);

      if (val >= std.min && val <= std.max) {
        await dbQuery(
          `UPDATE alarm_log SET status='RESOLVED', resolved_at=? WHERE id=?`,
          [now.toISO(), id]
        );

        console.log(`♻️ [AUTO-RESYNC] PLC ${plc_id}-${tag_name} resolved otomatis`);
      }
    }
  } catch (err) {
    console.error("[AUTO-RESYNC ERROR]", err);
  } finally {
    setTimeout(resolveFromDatabaseIfNormal, AUTO_RESYNC_INTERVAL_MS);
  }
}

// =============================================
// STARTER (REAL MODE ONLY)
// =============================================
function startAlarmChecker() {
  console.log("🚨 Alarm Checker dimulai (REAL MODE)...");
  checkAlarms();
  resolveFromDatabaseIfNormal();
}

module.exports = { startAlarmChecker };
