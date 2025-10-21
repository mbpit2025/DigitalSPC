"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { format, parseISO, getMonth, getYear, getWeekOfMonth } from "date-fns";

// ✅ Registrasi Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface PlcData {
  id: number;
  plc_id: string;
  plc_name: string;
  tag_name: string;
  value: number;
  timestamp: string;
}

const MACHINE_TAGS: Record<string, { label: string; tags: Record<string, string> }> = {
  "BPM_LINE_1": {
    label: "Mesin BPM 01",
    tags: {
      data1: "Tekanan Udara",
      data2: "Kecepatan Motor",
      data3: "Temperatur",
    },
  },
  "BPM 02": {
    label: "Mesin BPM 02",
    tags: {
      data4: "Tekanan Hidrolik",
      data5: "Putaran Spindle",
      data6: "Temperatur Pendingin",
    },
  },
};

export default function LogClient({ plc_id }: { plc_id: string }) {
  const [rawData, setRawData] = useState<PlcData[]>([]);
  const [filterMode, setFilterMode] = useState<string | "day" | "week" | "month">("day");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [selectedTags, setSelectedTags] = useState<Record<string, string[]>>({});

  // ✅ Ambil data dari API
  useEffect(() => {
    fetch(`/api/log/${plc_id}`)
      .then((res) => res.json())
      .then((data) => setRawData(data))
      .catch((err) => console.error("Error:", err));
  }, [plc_id]);

  // ✅ Pisahkan data berdasarkan mesin
  const groupedByMachine = useMemo(() => {
    const grouped: Record<string, PlcData[]> = {};
    rawData.forEach((item) => {
      if (MACHINE_TAGS[item.plc_name]) {
        if (!grouped[item.plc_name]) grouped[item.plc_name] = [];
        grouped[item.plc_name].push(item);
      }
    });
    return grouped;
  }, [rawData]);

  // ✅ Filter waktu
  const filteredData = useMemo(() => {
    return Object.fromEntries(
      Object.entries(groupedByMachine).map(([machine, data]) => {
        const filtered = data.filter((item) => {
          const date = parseISO(item.timestamp);
          if (filterMode === "day") {
            return format(date, "yyyy-MM-dd") === selectedDate;
          } else if (filterMode === "month") {
            return format(date, "yyyy-MM") === selectedMonth;
          } else if (filterMode === "week") {
            const sameMonth = getMonth(date) + 1 === parseInt(selectedMonth.split("-")[1]);
            const sameYear = getYear(date) === parseInt(selectedMonth.split("-")[0]);
            const week = getWeekOfMonth(date);
            return sameMonth && sameYear && week === selectedWeek;
          }
          return true;
        });
        return [machine, filtered];
      })
    );
  }, [groupedByMachine, filterMode, selectedDate, selectedMonth, selectedWeek]);

  // ✅ Handle checkbox tag per mesin
  const handleTagToggle = (machine: string, tag: string) => {
    setSelectedTags((prev) => {
      const current = prev[machine] || [];
      const updated = current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag];
      return { ...prev, [machine]: updated };
    });
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Log Data PLC - {plc_id}</h1>

      {/* Filter waktu */}
      <div className="flex items-center gap-4">
        <select
          className="border rounded px-3 py-2"
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
        >
          <option value="day">Per Hari</option>
          <option value="week">Per Minggu</option>
          <option value="month">Per Bulan</option>
        </select>

        {filterMode === "day" && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        )}

        {filterMode === "month" && (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded px-3 py-2"
          />
        )}

        {filterMode === "week" && (
          <>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="border rounded px-3 py-2"
            />
            <select
              className="border rounded px-3 py-2"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>
                  {`${selectedMonth}-W${w}`}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Chart per mesin */}
      {Object.entries(filteredData).map(([machine, data]) => {
        const tags = MACHINE_TAGS[machine]?.tags || {};
        const activeTags = selectedTags[machine] || [];

        const datasets = Object.entries(tags)
          .filter(([tag]) => activeTags.includes(tag))
          .map(([tag, label], i) => {
            const tagData = data.filter((d) => d.tag_name === tag);
            return {
              label,
              data: tagData.map((d) => d.value),
              borderColor: `hsl(${i * 60}, 70%, 50%)`,
              tension: 0.3,
            };
          });

        const chartData = {
          labels: data.map((d) => format(parseISO(d.timestamp), "HH:mm")),
          datasets,
        };

        const options: ChartOptions<"line"> = {
          responsive: true,
          plugins: { legend: { position: "top" } },
          scales: { y: { beginAtZero: true } },
        };

        return (
          <div key={machine} className="border p-4 rounded-xl shadow">
            <h2 className="text-xl font-semibold mb-2">{machine}</h2>

            <div className="flex flex-wrap gap-4 mb-4">
              {Object.entries(tags).map(([tag, label]) => (
                <label key={tag} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={activeTags.includes(tag)}
                    onChange={() => handleTagToggle(machine, tag)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            {datasets.length > 0 ? (
              <Line data={chartData} options={options} />
            ) : (
              <p className="text-gray-500 italic">Pilih minimal satu tag untuk ditampilkan.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
