import { Chart } from 'chart.js';

/**
 * Menyesuaikan sumbu Y berdasarkan data saat ini tanpa mengubah zoom/pan X.
 */
export function autoAdjustYAxis(chart: Chart<'line'>) {
  if (!chart || !chart.data.datasets.length) return;

  const xScale = chart.scales.x;
  // const yScale = chart.scales.y;

  // Ambil rentang waktu (X) yang sedang terlihat
  const visibleMin = xScale.min as number;
  const visibleMax = xScale.max as number;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  chart.data.datasets.forEach((dataset) => {
    const points = dataset.data as { x: number; y: number }[];
    points.forEach((p) => {
      if (p.x >= visibleMin && p.x <= visibleMax) {
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    });
  });

  // Kalau tidak ada data valid di rentang X
  if (!isFinite(minY) || !isFinite(maxY)) return;

  // Tambahkan sedikit margin biar tidak terlalu mepet
  const margin = (maxY - minY) * 0.1;
  const newMin = minY - margin;
  const newMax = maxY + margin;

  // Update axis Y tanpa mengubah zoom X
  const yOptions = chart.options.scales?.y;
  if (yOptions) {
    yOptions.min = newMin;
    yOptions.max = newMax;
  }

  chart.update('none'); // Update tanpa animasi
}
