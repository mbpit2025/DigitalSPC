import { ChartOptions } from "chart.js";
import { LineAnnotation } from "@/types/chartjs";
import { AnnotationOptions } from "chartjs-plugin-annotation";

/**
 * Base chart options (default untuk semua chart line).
 */
export const baseLineChartOptions: ChartOptions<"line"> = {
  animation: false,
  responsive: true,
  maintainAspectRatio: false,
  backgroundColor: "#1E1E2F",

  plugins: {
    legend: {
      position: "bottom",
      labels: { color: "#BBBBBB" },
    },
    title: {
      display: false,
      color: "#4A90E2",
      font: { size: 20, weight: "bold" },
    },
    tooltip: {
      mode: "index",
      intersect: false,
      callbacks: {
        label: (context) => {
          let label = context.dataset.label || "";
          const yValue = context.parsed.y;
          label +=
            typeof yValue === "number" && !isNaN(yValue)
              ? ` ${yValue.toFixed(2)}°C`
              : " N/A";
          return label;
        },
      },
    },
    annotation: { annotations: {} },
    zoom: {},
  },

  scales: {
    x: {
      type: "time",
      time: {
        unit: "second",
        tooltipFormat: "yyyy-MM-dd HH:mm:ss",
        displayFormats: {
          second: "HH:mm:ss",
          minute: "HH:mm",
        },
      },
      title: { display: true, text: "Waktu", color: "#BBBBBB" },
      ticks: { color: "#AAAAAA" },
      grid: { color: "rgba(255, 255, 255, 0.1)" },
    },
    y: {
      title: { display: true, text: "Suhu (°C)", color: "#BBBBBB" },
      beginAtZero: false,
      ticks: { color: "#AAAAAA" },
      grid: { color: "rgba(255, 255, 255, 0.1)" },
    },
  },
};

/**
 * Realtime chart options — menambahkan title dinamis, anotasi, dan zoom/pan.
 */
export const getRealtimeChartOptions = (
  titleText: string,
  annotations: Record<string, LineAnnotation>
): ChartOptions<"line"> => {
  const convertedAnnotations = Object.fromEntries(
    Object.entries(annotations).map(([key, value]) => [
      key,
      value as unknown as AnnotationOptions<"line">,
    ])
  );

  return {
    ...baseLineChartOptions,
    plugins: {
      ...baseLineChartOptions.plugins,
      title: {
        ...baseLineChartOptions.plugins!.title!,
        display: true,
        text: titleText,
      },
      annotation: {
        annotations: convertedAnnotations,
      },
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          pinch: {
            enabled: true,
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          mode: ({ chart } : any) => {
            const e =
              chart?.canvas?.ownerDocument?.defaultView?.event as
                | WheelEvent
                | undefined;

            // Jika user menekan Shift → zoom X
            if (e?.shiftKey) return "x";

            // Jika tidak → zoom Y
            return "y";
          },
        },
        pan: {
          enabled: true,
          mode: "xy",
        },
      },
    },
  };
};
