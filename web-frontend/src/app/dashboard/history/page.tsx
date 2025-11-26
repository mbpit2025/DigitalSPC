"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type GroupedResult = Record<string, DataRow[]>;

type DataRow = {
  hour?: number;
  day?: string;
  range_3?: number;
  value: number | null;
};

interface CellConfig {
  plcId: string;
  hot1: string; hot2: string; hot3: string; hot4: string;
  Cold1: string; Cold2: string; Cold3: string; Cold4: string;
}

const CELL_MAP: { [key: string]: CellConfig } = {
  "B1-01": {
    plcId: "1", hot1: "data2", hot2: "data3", hot3: "data8", hot4: "data9",
    Cold1: "data4", Cold2: "data5", Cold3: "data6", Cold4: "data7",
  },
  "B1-02": {
    plcId: "4", hot1: "data2", hot2: "data3", hot3: "data8", hot4: "data9",
    Cold1: "data4", Cold2: "data5", Cold3: "data6", Cold4: "data7",
  },
};

const COLORS: { [key: string]: string } = {
  "data4": "rgb(255, 50, 50)",
  "data5": "rgb(255, 100, 0)",
  "data6": "rgb(255, 150, 0)",
  "data7": "rgb(255, 200, 0)",
  "data2": "rgb(0, 100, 200)",
  "data3": "rgb(0, 150, 150)",
  "data8": "rgb(0, 200, 100)",
  "data9": "rgb(0, 255, 0)",
};

/** ====== FILLERS ====== */
function fillDaily(data: DataRow[] = []) {
  const result: { hour: string; value: number | null }[] = [];
  const now = new Date();
  for (let i = 9; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(now.getHours() - i);
    const hour = d.getHours().toString().padStart(2, "0") + ":00";
    const found = data.find((x) => Number(x.hour) === d.getHours());
    result.push({ hour, value: found ? Number(found.value) : null });
  }
  return result;
}

function fillWeekly(data: DataRow[] = []) {
  const result: { label: string; value: number | null }[] = [];
  const now = new Date();
  for (let d = 6; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const dateStr =
      day.getDate().toString().padStart(2, "0") +
      "/" +
      (day.getMonth() + 1).toString().padStart(2, "0");

    for (let r = 0; r < 8; r++) {
      const found = data.find(
        (x) => x.day?.slice(0, 10) === day.toISOString().slice(0, 10) && Number(x.range_3) === r
      );
      result.push({ label: dateStr, value: found ? Number(found.value) : null });
    }
  }
  return result;
}

function fillMonthly(data: DataRow[] = []) {
  const result: { label: string; value: number | null }[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = d.toString().padStart(2, "0") + "/" + (month + 1).toString().padStart(2, "0");
    const found = data.find((x) => Number(x.day?.split("-")[2]) === d);
    result.push({ label: dayStr, value: found ? Number(found.value) : null });
  }
  return result;
}

function groupByTag(data: DataRow[] = []): GroupedResult {
  const grouped: GroupedResult = {};
  data.forEach((row) => {
    const tag = (row as DataRow & { tag_name?: string }).tag_name as string | undefined; // karena API berisi field ini
    if (!tag) return;
    if (!grouped[tag]) grouped[tag] = [];
    grouped[tag].push(row);
  });
  return grouped;
}



export default function HistoryPage() {
  const cell = "B1-01";
  const tagList = Object.values(CELL_MAP[cell]).filter((_, i) => i > 0);

  const [daily, setDaily] = useState<GroupedResult>({});
  const [weekly, setWeekly] = useState<GroupedResult>({});
  const [monthly, setMonthly] = useState<GroupedResult>({});
  const [loading, setLoading] = useState<boolean>(false);

const fetchData = async () => {
  setLoading(true);
  const params = `tags=${tagList.join(",")}&cat=BPM`;

  const safeFetch = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    } catch {
      return [];
    }
  };

  const d = await safeFetch(`/api/mchistory/daily?${params}`);
  const w = await safeFetch(`/api/mchistory/weekly?${params}`);
  const m = await safeFetch(`/api/mchistory/monthly?${params}`);

  setDaily(groupByTag(d));
  setWeekly(groupByTag(w));
  setMonthly(groupByTag(m));

  setLoading(false);
};

  console.log({daily: daily})

  useEffect(() => {
    fetchData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-bold text-center">PLC Data History ({cell})</h1>

      <div className="grid grid-cols-6 gap-4">
        {/* DAILY */}
        <ChartCard title="Daily (Max per Hour)">
          <Line
            data={{
              labels: fillDaily().map((d) => d.hour),
                datasets: tagList.map((tag) => ({
                label: `${tag} (${cell})`,
                borderWidth: 2,
                borderColor: COLORS[tag] ?? "gray",
                backgroundColor: COLORS[tag] ?? "gray",
                data: fillDaily(daily[tag]).map((d) => d.value),
                }))
            }}
          />
        </ChartCard>

        {/* WEEKLY */}
        <ChartCard title="Weekly (Max per 3 Hours)">
          <Line
            data={{
              labels: fillWeekly().map((d) => d.label),
            datasets: tagList.map((tag) => ({
            label: `${tag} (${cell})`,
            borderWidth: 2,
            borderColor: COLORS[tag] ?? "gray",
            backgroundColor: COLORS[tag] ?? "gray",
            data: fillWeekly(weekly[tag]).map((d) => d.value),
            }))
            }}
          />
        </ChartCard>

        {/* MONTHLY */}
        <ChartCard title="Monthly (Average per Day)">
          <Line
            data={{
              labels: fillMonthly().map((d) => d.label),
                datasets: tagList.map((tag) => ({
                label: `${tag} (${cell})`,
                borderWidth: 2,
                borderColor: COLORS[tag] ?? "gray",
                backgroundColor: COLORS[tag] ?? "gray",
                data: fillMonthly(monthly[tag]).map((d) => d.value),
                }))
            }}
          />
        </ChartCard>
      </div>

      {loading && <p className="text-center text-gray-500">Loading...</p>}
    </div>
  );
}

/** COMPONENT CARD */
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white shadow-md rounded-lg p-4 col-span-6 lg:col-span-3">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      {children}
    </div>
  );
}
