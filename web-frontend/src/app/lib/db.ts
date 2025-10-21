import mysql, { RowDataPacket } from 'mysql2/promise';

export interface PlcData extends RowDataPacket {
  id: number;
  plc_id: number;
  plc_name: string;
  tag_name: string;
  value: number;
  timestamp: string;
}

// Cegah pool dibuat berulang kali (sangat penting di Next.js)
const globalForMySQL = globalThis as unknown as {
  pool: mysql.Pool | undefined;
};

export const pool =
  globalForMySQL.pool ||
  mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3307,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== 'production') globalForMySQL.pool = pool;

// --- Fungsi query ---
export async function dbQuery<T>(
  query: string,
  values: (string | number | null)[] = []
): Promise<T[]> {
  try {
    const [rows] = await pool.execute<T[] & RowDataPacket[]>(query, values);
    return rows as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw new Error('Gagal mengeksekusi query database.');
  }
}
