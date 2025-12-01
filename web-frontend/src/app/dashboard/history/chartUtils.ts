import { TooltipItem } from 'chart.js';

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



const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#FFFFFF',
        font: {
          size: 11,
          weight: 'normal' as const,
        },
        filter: (item : { text: string }) => !item.text.includes("Standard"),
      },
    },
    tooltip: {
      callbacks: {
        label: function(context: TooltipItem<'line'>) {
          return `${context.dataset.label}: ${context.raw}`;
        },
      },
      backgroundColor: '#2D2D2D',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      borderColor: '#666',
      borderWidth: 1,
      padding: 10,
      cornerRadius: 6,
    },
  },
  spanGaps: true,
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
        lineWidth: 1,
      },
      ticks: {
        color: '#FFFFFF',
        font: {
          size: 12,
        },
      },
    },
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
        lineWidth: 1,
      },
      ticks: {
        color: '#FFFFFF',
        font: {
          size: 12,
        },
        callback: function(value: string | number) {
          return typeof value === 'number' && Number.isInteger(value) 
            ? value 
            : Number(value).toFixed(1);
        },
      },
    },
  },
};

export { fillDaily, fillWeekly, fillMonthly, CHART_OPTIONS };