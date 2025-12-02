import Chart, { ChartOptions } from 'chart.js/auto';

type DataRow = {
  hour?: number;
  day?: string;
  range_3?: number;
  value: number | null;
  tag_name?: string;
  min?: number | null;     
  max?: number | null;     
  model_name?: string;
  line_name?: string;
};

// ===== FILLER UTILITIES =====
function fillDaily(data: DataRow[] = []): { hour: string; value: number | null }[] {
  const baseHour = data.length > 0 ? Number(data[0].hour) : new Date().getHours();
  const result = [];

  for (let i = 0; i < 10; i++) {
    const hourNum = (baseHour + i) % 24;
    const hourLabel = hourNum.toString().padStart(2, "0") + ":00";
    const found = data.find((row) => Number(row.hour) === hourNum);
    result.push({ hour: hourLabel, value: found ? Number(found.value) : null });
  }
  return result;
}

function fillWeekly(data: DataRow[] = []): { label: string; value: number | null }[] {
  const now = new Date();
  const result = [];

  for (let d = 6; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const dateStr = `${day.getDate().toString().padStart(2, "0")}/${(day.getMonth() + 1).toString().padStart(2, "0")}`;

    for (let r = 0; r < 8; r++) {
      const isoDate = day.toISOString().slice(0, 10);
      const found = data.find((row) => row.day?.slice(0, 10) === isoDate && Number(row.range_3) === r);
      result.push({ label: dateStr, value: found ? Number(found.value) : null });
    }
  }
  return result;
}

function fillMonthly(data: DataRow[] = []): { label: string; value: number | null }[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const result = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${d.toString().padStart(2, "0")}/${(month + 1).toString().padStart(2, "0")}`;
    const found = data.find((row) => {
      const dayFromData = row.day?.split("-")[2];
      return dayFromData && Number(dayFromData) === d;
    });
    result.push({ label: dayStr, value: found ? Number(found.value) : null });
  }
  return result;
}



const CHART_OPTIONS: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        generateLabels: (chart) => {
          const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
          return labels.map(label => ({
            ...label,
            fontStyle: label.text.includes("Standard") ? "italic" : "normal",
            fontColor: label.text.includes("Min") ? "green" :
                       label.text.includes("Max") ? "red" : undefined,
          }));
        }
      }
    },
    tooltip: {
      mode: "index" as const,
      intersect: false,
    },
  },
  scales: {
    x: {
      grid: { display: false },
    },
    y: {
      beginAtZero: false,
      ticks: {
        callback: (value: string | number) => `${value}°C`,
      }
    }
  },
  interaction: {
    mode: "nearest" as const,
    axis: "x" as const,
    intersect: false,
  },
};

export { fillDaily, fillWeekly, fillMonthly, CHART_OPTIONS };