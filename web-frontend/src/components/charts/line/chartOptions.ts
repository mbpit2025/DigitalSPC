import { LineAnnotation } from "@/types/chartjs";
import { ChartOptions } from "chart.js";

export const getRealtimeChartOptions = (
  chartTitle: string,
  annotationLines: Record<string, LineAnnotation>
): ChartOptions<'line'> => ({
  responsive: true,
  plugins: {
    title: {
      display: true,
      text: chartTitle,
    },
    annotation: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      annotations: annotationLines as any,
    },
  },
  scales: {
    x: { type: 'time' },
    y: { beginAtZero: false },
  },
});
