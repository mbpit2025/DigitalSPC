// ─── 1. DEKLARASI MODUL ───────────────────────────────
const mysql = require("mysql2/promise");
const { DateTime } = require("luxon");
const fs = require('fs');
const path = require('path');

const JAKARTA_TIMEZONE = "Asia/Jakarta";

// ─── 2. POOL MYSQL (singleton) ────────────────────────
const globalForMySQL = globalThis;
const pool =
  globalForMySQL._mysqlPool ||
  mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "mmspwi2",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    port: 3306,
  });

if (!globalForMySQL._mysqlPool) {
  globalForMySQL._mysqlPool = pool;
  console.log("[DB] Pool MySQL dibuat (singleton).");
}

// ─── 3. FUNGSI BANTU (harus di atas fungsi utama!) ────

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getLogFilePathForTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error(`Timestamp tidak valid: ${timestamp}`);
  }
  return path.join(__dirname, 'logs', `plc-${formatDate(date)}.log`);
}

function getDateRange(start, end) {
  const dates = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);

  while (current <= endDay) { // <= agar mencakup hari terakhir
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

async function dbQuery(sql, params = []) {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (err) {
    console.error("[DB ERROR] Query gagal:", err);
    throw err;
  }
}


// ─── 4. FUNGSI UTAMA ──────────────────────────────────

async function saveHistoricalData(data) {
  if (!Array.isArray(data) || data.length === 0) return;

  try {
    // Batch insert agar cepat & koneksi efisien
    const values = data.map((row) => [
      row.line_name,
      row.model_name,
      row.plc_id,
      row.plc_name,
      row.tag_name,
      row.value,
      row.min,
      row.max,
      row.timestamp,
    ]);

    const query = `
      INSERT INTO plc_data (line_name, model_name, plc_id, plc_name, tag_name, value, min, max, timestamp)
      VALUES ?
    `;

    await pool.query(query, [values]);

    console.log(`[DB] ${data.length} baris disimpan ke plc_data.`);

    // Auto cleanup
    const deleted = await cleanDataOlderThanToday();
    if (deleted > 0) {
      console.log(`[DB CLEANUP AUTO] ${deleted} baris data lama dihapus otomatis.`);
    }
  } catch (err) {
    console.error("[DB ERROR] Gagal menyimpan data:", err);
  }
}


async function saveHistoricalDataLog(data) {
  if (!Array.isArray(data) || data.length === 0) return;

  try {
    const groups = new Map();

    for (const row of data) {
      if (!row?.timestamp) {
        console.warn("[LOG] Data tanpa timestamp diabaikan:", row);
        continue;
      }
      const logPath = getLogFilePathForTimestamp(row.timestamp);
      if (!groups.has(logPath)) groups.set(logPath, []);
      groups.get(logPath).push(row);
    }

    for (const [logPath, rows] of groups) {
      await fs.promises.mkdir(path.dirname(logPath), { recursive: true });
      const logLines = rows
        .map((row) =>
          JSON.stringify({
            line_name: row.line_name,
            model_name: row.model_name,
            plc_id: row.plc_id,
            plc_name: row.plc_name,
            tag_name: row.tag_name,
            value: row.value,
            min: row.min,
            max: row.max,
            status : row.status,
            timestamp: row.timestamp,
          })
        )
        .join("\n") + "\n";
      await fs.promises.appendFile(logPath, logLines, "utf8");
    }

    console.log(`[LOG] ${data.length} baris disimpan ke file log harian.`);
  } catch (err) {
    console.error("[FILE ERROR] Gagal menyimpan data ke log harian:", err);
  }
}

// -------------------------------------------------------------
// ✅ Ambil Timestamp Terakhir dari plc_data
// -------------------------------------------------------------
async function getLastDataTimestamp() {
  try {
    const [rows] = await pool.query(
      "SELECT timestamp FROM plc_data ORDER BY timestamp DESC LIMIT 1"
    );
    return rows.length > 0 ? new Date(rows[0].timestamp) : null;
  } catch (err) {
    console.error("[DB ERROR] Gagal mengambil timestamp terakhir:", err);
    return null;
  }
}

// -------------------------------------------------------------
// ✅ Hapus semua data sebelum hari ini (00:00 WIB)
// -------------------------------------------------------------
async function cleanDataOlderThanToday() {
  const todayStartJakarta = DateTime.now()
    .setZone(JAKARTA_TIMEZONE)
    .startOf("day")
    .toUTC()
    .toJSDate();

  try {
    const [result] = await pool.query(
      "DELETE FROM plc_data WHERE timestamp < ?",
      [todayStartJakarta]
    );
    return result.affectedRows || 0;
  } catch (err) {
    console.error("[DB ERROR] Gagal menghapus data lama:", err);
    return 0;
  }
}

// -------------------------------------------------------------
// ✅ Proses & Simpan ke plc_history (setiap 10 menit)
// -------------------------------------------------------------
async function processAndStoreHistory(startTime, endTime) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const insertQuery = `
      INSERT INTO plc_history (
        plc_id, 
        tag_name, 
        avg_value, 
        line_name, 
        model_name, 
        min, 
        max, 
        start_time, 
        end_time
      )
      SELECT
        plc_id,
        tag_name,
        AVG(value) AS avg_value,
        MIN(line_name) AS line_name,
        MIN(model_name) AS model_name,
        MIN(min) AS min,
        MIN(max) AS max,
        ? AS start_time,
        ? AS end_time
      FROM plc_data
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY plc_id, tag_name
      ON DUPLICATE KEY UPDATE
        avg_value = VALUES(avg_value),
        end_time = VALUES(end_time),
        line_name = VALUES(line_name),
        model_name = VALUES(model_name),
        min = VALUES(min),
        max = VALUES(max);
    `;

    const params = [startTime, endTime, startTime, endTime];
    const [result] = await conn.query(insertQuery, params);

    await conn.commit();
    console.log(`[DB HISTORY] ${result.affectedRows} baris diproses ke plc_history.`);
    return { processed: result.affectedRows || 0 };
  } catch (err) {
    await conn.rollback();
    console.error("[DB ERROR] Gagal memproses data history:", err);
    throw err;
  } finally {
    conn.release();
  }
}



async function processAndStoreHistoryLog(startTime, endTime) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const dateRange = getDateRange(startTime, endTime);
    const startTs = new Date(startTime).getTime();
    const endTs = new Date(endTime).getTime();

    // Use Map to aggregate values per (plc_id || tag_name)
    const grouped = new Map();

    // Stream each file to avoid reading huge file into memory
    for (const date of dateRange) {
      const logPath = getLogFilePathForTimestamp(date);
      if (!fs.existsSync(logPath)) continue;

      const fileStream = fs.createReadStream(logPath, { encoding: "utf8" });
      let buffer = "";

      for await (const chunk of fileStream) {
        buffer += chunk;
        let lines = buffer.split("\n");
        buffer = lines.pop(); // leftover

        for (const line of lines) {
          if (!line || !line.trim()) continue;

          let row;
          try {
            row = JSON.parse(line);
          } catch (e) {
            // invalid line, skip
            continue;
          }

          const ts = new Date(row.timestamp).getTime();
          if (isNaN(ts) || ts < startTs || ts >= endTs) continue;

          const key = `${row.plc_id}||${row.tag_name}`;
          if (!grouped.has(key)) {
            grouped.set(key, {
              plc_id: row.plc_id,
              tag_name: row.tag_name,
              values: [],
              line_name: row.line_name,
              model_name: row.model_name,
              min_limit: row.min,
              max_limit: row.max,
            });
          }

          const val = parseFloat(row.value);
          if (!isNaN(val)) grouped.get(key).values.push(val);
        }
      }

      // handle leftover in buffer (last line without newline)
      if (buffer && buffer.trim()) {
        try {
          const row = JSON.parse(buffer);
          const ts = new Date(row.timestamp).getTime();
          if (!isNaN(ts) && ts >= startTs && ts < endTs) {
            const key = `${row.plc_id}||${row.tag_name}`;
            if (!grouped.has(key)) {
              grouped.set(key, {
                plc_id: row.plc_id,
                tag_name: row.tag_name,
                values: [],
                line_name: row.line_name,
                model_name: row.model_name,
                min_limit: row.min,
                max_limit: row.max,
              });
            }
            const val = parseFloat(row.value);
            if (!isNaN(val)) grouped.get(key).values.push(val);
          }
        } catch (e) {
          // ignore invalid leftover
        }
      }
    } // end for dateRange

    // Prepare batched inserts
    const MAX_BATCH = 200; // safe batch size
    let batch = [];
    let totalProcessed = 0;

    const insertHistoryBatch = async (connection, rows) => {
      if (!rows || rows.length === 0) return;
      const sql = `
        INSERT INTO plc_history (
          plc_id, tag_name, avg_value, line_name, model_name, min, max, start_time, end_time
        ) VALUES ?
        ON DUPLICATE KEY UPDATE
          avg_value = VALUES(avg_value),
          end_time  = VALUES(end_time),
          line_name = VALUES(line_name),
          model_name = VALUES(model_name),
          min = VALUES(min),
          max = VALUES(max);
      `;
      await connection.query(sql, [rows]);
    };

    for (const g of grouped.values()) {
      if (!g.values || g.values.length === 0) continue;

      const avg = g.values.reduce((a, b) => a + b, 0) / g.values.length;
      batch.push([
        g.plc_id,
        g.tag_name,
        avg,
        g.line_name,
        g.model_name,
        g.min_limit,
        g.max_limit,
        startTime,
        endTime,
      ]);

      if (batch.length >= MAX_BATCH) {
        await insertHistoryBatch(conn, batch);
        totalProcessed += batch.length;
        batch = [];
      }
    }

    // insert remaining
    if (batch.length > 0) {
      await insertHistoryBatch(conn, batch);
      totalProcessed += batch.length;
    }

    await conn.commit();
    console.log(`[DB HISTORY] ${totalProcessed} baris diproses ke plc_history (log mode).`);
    return { processed: totalProcessed };
  } catch (err) {
    await conn.rollback();
    console.error("[HISTORY ERROR] Gagal memproses data history:", err);
    throw err;
  } finally {
    conn.release();
  }
}



module.exports = {
  saveHistoricalData,
  getLastDataTimestamp,
  cleanDataOlderThanToday,
  processAndStoreHistory,
  dbQuery,
  saveHistoricalDataLog,
  processAndStoreHistoryLog,
};
