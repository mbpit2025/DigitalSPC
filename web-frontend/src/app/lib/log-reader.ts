// src/lib/log-reader.ts
import * as fs from "fs/promises";
import * as path from "path";

interface DataPoint {
    line_name: string;
    model_id: string;
    model_name: string;
    plc_id: string;
    plc_name: string;
    tag_name: string;
    value: number;
    min: number | null;
    max: number | null;
    status: string;
    timestamp: string; // Assuming a timestamp is always present
}

// Path absolut ke folder log
// (berdasarkan struktur: root/data-collector/database/logs)
const LOGS_DIR = path.join(
  process.cwd(),
  "..",
  "data-collector",
  "database",
  "logs"
);

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function getPlcDataFromLogs(plc_id: string, limit: number = 1000) {
  const today = new Date();
  const dates: string[] = [];

  // Ambil 3 hari terakhir
  for (let i = 0; i < 3; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(formatDate(d));
  }

  const allRecords: DataPoint[] = [];

  for (const dateStr of dates) {
    const logFile = `plc-${dateStr}.log`;
    const logPath = path.join(LOGS_DIR, logFile);

    try {
      const content = await fs.readFile(logPath, "utf8");

      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.length > 0);

      const records = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(
          (r) => r && r.plc_id?.toString() === plc_id?.toString()
        );

      allRecords.push(...records);
    } catch (err: unknown) {
      const maybeErr = err as { code?: string; message?: string };
      if (maybeErr.code !== "ENOENT") {
        console.warn(`Gagal membaca file: ${logPath}`, maybeErr.message ?? String(err));
      }
    }
  }

  // Urutkan dari terbaru
  allRecords.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return allRecords.slice(0, limit);
}
