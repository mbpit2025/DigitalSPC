const mysql = require("mysql2/promise");
const { DateTime } = require("luxon");

const JAKARTA_TIMEZONE = "Asia/Jakarta";

// 🔒 Gunakan singleton agar pool tidak dibuat berulang kali
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

// -------------------------------------------------------------
// ✅ Simpan Data Mentah (lebih efisien & aman)
// -------------------------------------------------------------
async function saveHistoricalData(data) {
  if (!Array.isArray(data) || data.length === 0) return;

  try {
    // Batch insert agar cepat & koneksi efisien
    const values = data.map((row) => [
      row.plc_id,
      row.plc_name,
      row.tag_name,
      row.value,
      row.timestamp,
    ]);

    const query = `
      INSERT INTO plc_data (plc_id, plc_name, tag_name, value, timestamp)
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
      INSERT INTO plc_history (plc_id, tag_name, avg_value, start_time, end_time)
      SELECT
        plc_id,
        tag_name,
        AVG(value) AS avg_value,
        ? AS start_time,
        ? AS end_time
      FROM plc_data
      WHERE timestamp >= ? AND timestamp < ?
      GROUP BY plc_id, tag_name
      ON DUPLICATE KEY UPDATE
        avg_value = VALUES(avg_value),
        end_time = VALUES(end_time);
    `;

    const params = [startTime, endTime, startTime, endTime];
    const [res] = await conn.query(insertQuery, params);

    await conn.commit();
    console.log(`[DB HISTORY] ${res.affectedRows} baris diproses ke plc_history.`);

    return { processed: res.affectedRows, deleted: 0 };
  } catch (err) {
    await conn.rollback();
    console.error("[DB ERROR] Gagal memproses data history:", err);
    throw err;
  } finally {
    conn.release();
  }
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

module.exports = {
  saveHistoricalData,
  getLastDataTimestamp,
  cleanDataOlderThanToday,
  processAndStoreHistory,
  dbQuery
};
