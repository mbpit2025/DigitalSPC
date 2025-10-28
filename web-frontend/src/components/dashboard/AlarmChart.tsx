"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
ChartJS.register(annotationPlugin);

import { Bar } from "react-chartjs-2";
import { TAG_TO_NAME_MAP } from "@/utils/tagMap";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// 📘 Struktur data alarm
interface AlarmItem {
  id: number;
  plc_id: string;
  tag_name: string;
  alarm_type: "HIGH" | "LOW" | string;
  violated_value: number;
  treshold_value: number;
  alarm_time: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  is_active: number;
}

export default function AlarmLogChart({ alarms }: { alarms: AlarmItem[] }) {
  // 🔹 Map PLC + tag_name ke nama sensor
  const getMappedName = (plc_id: string, tag_name: string): string => {
    const id = Number(plc_id);
    const mapped = TAG_TO_NAME_MAP[id]?.[tag_name];
    return mapped ?? `${plc_id}-${tag_name}`;
  };

  // 🔹 Hitung total alarm per checking point
  const chartData = useMemo(() => {
    const grouped: Record<string, number> = {};

    alarms.forEach((alarm) => {
      const pointName = getMappedName(alarm.plc_id, alarm.tag_name);
      grouped[pointName] = (grouped[pointName] || 0) + 1;
    });

    return {
      labels: Object.keys(grouped),
      datasets: [
        {
          label: "Total Alarms",
          data: Object.values(grouped),
          backgroundColor: "#3b82f6",
          borderRadius: 2,
          barThickness: 18,
          // 🔹 Tambahkan jarak antar bar
          barPercentage: 0.8,       // Lebar bar (default 0.9)
          categoryPercentage: 0.9,  // Jarak antar bar (default 0.8)
        },
      ],
    };
  }, [alarms]);

  // 🔹 Hitung tinggi chart dinamis berdasarkan jumlah bar
  const chartHeight = useMemo(
    () => Math.max(chartData.labels.length * 45, 200),
    [chartData.labels.length]
  );

  // 🔹 Opsi Chart.js
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y" as const, // horizontal bar
    plugins: {
      annotation: {
        annotations: {} // ✅ tambahkan ini agar tidak undefined
    },
      legend: {
        position: "top" as const,
        labels: {
          color: "#3b82f6",
          font: {
            size: 13,
          },
        },
      },
      title: {
        display: true,
        text: "Alarm Summary by Checking Point",
        color: "#e5e7eb",
        font: {
          size: 16,
          weight: "bold" as const,
        },
      },
      tooltip: {
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => `Total: ${ctx.formattedValue}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#e5e7eb",
          font: { size: 11 },
          precision: 0,
        },
        beginAtZero: true,
        grid: {
          color: "rgba(255,255,255,0.08)",
        },
      },
      y: {
        ticks: {
          color: "#e5e7eb",
          font: { size: 12 },
          maxRotation: 0,
          minRotation: 0,
        },
        grid: {
          color: "rgba(255,255,255,0.08)",
        },
      },
    },
  } satisfies ChartJS["options"];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 px-4 pb-3 pt-4 dark:border-gray-800 sm:px-6">
      {chartData.labels.length === 0 ? (
        <div className="p-4 text-center text-gray-400">No alarm data found.</div>
      ) : (
        <div className="w-full" style={{ height: `${chartHeight}px` }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      )}
    </div>
  );
}
