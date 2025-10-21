// src/utils/chartExport.ts
import { Chart } from "chart.js";

/**
 * 🔹 Mengekspor grafik Chart.js sebagai file gambar (PNG atau JPEG)
 */
export const exportChartAsImage = (
  chartInstance: Chart | null,
  format: "png" | "jpeg" = "png",
  filenamePrefix = "grafik_realtime"
) => {
  if (!chartInstance) {
    alert("Grafik belum siap untuk diekspor!");
    return;
  }

  const canvas = chartInstance.canvas;
  const mimeType = format === "png" ? "image/png" : "image/jpeg";
  const filename = `${filenamePrefix}_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.${format}`;

  const dataURL = canvas.toDataURL(mimeType, format === "jpeg" ? 0.9 : 1.0);
  const link = document.createElement("a");
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * 🔹 Mengekspor data time series menjadi file CSV
 * @param dataHistory - Objek berisi data per tag
 * @param tagLabels - Peta nama tag ke label tampilan
 * @param filenamePrefix - Awalan nama file CSV
 */
export const exportDataAsCsv = (
  dataHistory: Record<string, { x: number; y: number }[]>,
  tagLabels: Record<string, string>,
  filenamePrefix = "grafik_realtime"
) => {
  if (!dataHistory || Object.keys(dataHistory).length === 0) {
    alert("Tidak ada data untuk diekspor!");
    return;
  }

  // Gabungkan semua timestamp unik
  const allTimestamps = Array.from(
    new Set(
      Object.values(dataHistory)
        .flat()
        .map((point) => point.x)
    )
  ).sort((a, b) => a - b);

  if (allTimestamps.length === 0) {
    alert("Data kosong, tidak ada yang diekspor.");
    return;
  }

  const tagNames = Object.keys(dataHistory);
  const headers = ["Timestamp", ...tagNames.map((t) => tagLabels[t] || t)];

  const csvRows = [headers.join(",")];
  allTimestamps.forEach((timestamp) => {
    const dateStr = new Date(timestamp).toISOString();
    const rowValues = [dateStr];

    tagNames.forEach((tag) => {
      const point = dataHistory[tag]?.find((p) => p.x === timestamp);
      rowValues.push(point ? point.y.toString() : "");
    });

    csvRows.push(rowValues.join(","));
  });

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const filename = `${filenamePrefix}_${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
