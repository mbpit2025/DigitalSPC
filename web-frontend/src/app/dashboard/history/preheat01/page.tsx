"use client";


import { useEffect, useMemo, useState, useCallback } from "react";
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
import { fillDaily, fillWeekly, fillMonthly, CHART_OPTIONS } from "../chartUtils";
import Image from "next/image";
import NavMc from "@/components/dashboard/NavMc";
import { ChartDataset } from "chart.js";
import TempGauge from "../TempGauge";


ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);


interface ChartDatasetCustom extends Omit<ChartDataset<'line'>, 'data'> {
  data: (number | null)[];
  label: string;
}

// ===== TYPES =====
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

type GroupedResult = Record<string, DataRow[]>;

interface CellConfig {
  plcId: string;
  hot_preheat_out: string;
  hot_preheat_upper: string;
  // hot_primer1_out: string;
  // hot_primer1_upper: string;
  // hot_primer2_out: string;
  // hot_primer2_upper: string;
  // hot_cementing1_out: string;
  // hot_cementing1_upper: string;
}

type FillFunction = (data: DataRow[]) => Array<{ label: string; value: number | null } | { hour: string; value: number | null }>;

// ===== CONFIGS =====
const CELL_MAP: Record<string, CellConfig> = {
  "B1-01": {
    plcId: "2",
    hot_preheat_out: "data2",
    hot_preheat_upper: "data3",
    // hot_primer1_out: "data4",
    // hot_primer1_upper: "data5",
    // hot_primer2_out: "data6",
    // hot_primer2_upper: "data7",
    // hot_cementing1_out: "data8",
    // hot_cementing1_upper: "data9",
  },
  "B1-02": {
    plcId: "5",
    hot_preheat_out: "data2",
    hot_preheat_upper: "data3",
    // hot_primer1_out: "data4",
    // hot_primer1_upper: "data5",
    // hot_primer2_out: "data6",
    // hot_primer2_upper: "data7",
    // hot_cementing1_out: "data8",
    // hot_cementing1_upper: "data9",
  },
};

const COLORS: Record<string, string> = {
  data2: "rgb(255, 50, 50)",
  data3: "rgb(255, 100, 0)",
  data8: "rgb(255, 150, 0)",
  data9: "rgb(255, 200, 0)",
  data4: "rgb(0, 100, 200)",
  data5: "rgb(0, 150, 150)",
  data6: "rgb(0, 200, 100)",
  data7: "rgb(0, 255, 0)",
};



function groupByTag(data: DataRow[]): GroupedResult {
  return data.reduce((acc, row) => {
    if (!row.tag_name) return acc;
    if (!acc[row.tag_name]) acc[row.tag_name] = [];
    acc[row.tag_name].push(row);
    return acc;
  }, {} as GroupedResult);
}

// ===== COMPONENTS =====
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dark:bg-black shadow-md rounded-lg p-4 col-span-6 lg:col-span-3 ">
      <h2 className="text-xl font-semibold mb-2 text-blue-500">{title}</h2>
      {children}
    </div>
  );
}


export default function Chamber01Page() {
  const cell = "B1-01";
  const config = CELL_MAP[cell];

  // Pisahkan hot dan cold tags
  const preheat_primer1 = useMemo(() => [config.hot_preheat_out, config.hot_preheat_upper], [config]);
  // const primer2_cementing = useMemo(() => []);

  const [daily, setDaily] = useState<GroupedResult>({});
  const [weekly, setWeekly] = useState<GroupedResult>({});
  const [monthly, setMonthly] = useState<GroupedResult>({});
  const [loading, setLoading] = useState(false);

  // Di dalam komponen HistoryPage, setelah fetchRealtime
const [gaugeData, setGaugeData] = useState<{
  qty: number;
  time: number; label: string; value: number; min: number; max: number 
}[]>([]);
 const [isFetching, setIsFetching] = useState(false);

const fetchRealtime = useCallback(async (plcId: string = "1") => {
    if (isFetching) return; // opsional: hindari overlap
    
    setIsFetching(true);
    try {
      const response = await fetch(`/api/realtime?plcId=${encodeURIComponent(plcId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Gagal fetch data real-time:", error);
      throw error;
    } finally {
      setIsFetching(false);
    }
  }, [isFetching]);

// --- Efek untuk polling setiap 2 detik ---
  useEffect(() => {
    // const plcId = "1";
    
    // Di dalam useEffect untuk updateGaugeData

// Mapping temperatur
const TEMP_TAGS: Record<string, string> = {
  "data2": "Hot 1",
  "data3": "Hot 2",
  // "data8": "Hot 3",
  // "data9": "Hot 4",
  // "data4": "Cold 1",
  // "data5": "Cold 2",
  // "data6": "Cold 3",
  // "data7": "Cold 4",
};

// Mapping qty → sesuaikan dengan tag yang benar!
const QTY_TAGS: Record<string, string> = {
  "data10": "Hot 1", // pastikan ini sesuai API Anda!
  "data11": "Hot 2",
  // "data16": "Hot 3",
  // "data17": "Hot 4",
  // "data12": "Cold 1",
  // "data13": "Cold 2",
  // "data14": "Cold 3",
  // "data15": "Cold 4",
};


const TIME_TAGS: Record<string, string> = {
  "data18": "Hot 1",
  "data19": "Hot 2",
  "data24": "Hot 3",
  // "data25": "Hot 4",
  // "data20": "Cold 1",
  // "data21": "Cold 2",
  // "data22": "Cold 3",
  // "data23": "Cold 4",
};

    // Fungsi untuk memperbarui gauge data
    const updateGaugeData = async () => {
      try {
        const result = await fetchRealtime("2");
        if (!result?.latestData) return;

        const tempData: Record<string, DataRow> = {};
        const qtyData: Record<string, number> = {};
        const timeData: Record<string, number> = {}; // ← tambahkan ini

        for (const item of result.latestData) {
          if (!item.tag_name) continue;

          if (item.tag_name in TEMP_TAGS) {
            tempData[item.tag_name] = item;
          } else if (item.tag_name in QTY_TAGS) {
            qtyData[item.tag_name] = item.value ?? 0;
          } else if (item.tag_name in TIME_TAGS) { // ← ekstrak time
            timeData[item.tag_name] = item.value ?? 0;
          }
        }

        const gaugeItems = Object.entries(TEMP_TAGS).map(([tag, baseLabel]) => {
          const tempItem = tempData[tag];
          
          // Cari qty tag
          const qtyTag = Object.keys(QTY_TAGS).find(t => QTY_TAGS[t] === baseLabel);
          const qty = qtyTag ? qtyData[qtyTag] ?? 0 : 0;

          // Cari time tag
          const timeTag = Object.keys(TIME_TAGS).find(t => TIME_TAGS[t] === baseLabel);
          const time = timeTag ? timeData[timeTag] ?? 0 : 0; // default 0 detik

          return {
            label: `${baseLabel} Temp`,
            value: tempItem?.value ?? 0,
            min: tempItem?.min ?? 0,
            max: tempItem?.max ?? 100,
            qty,
            time, // ✅ kirim waktu
          };
        });

        setGaugeData(gaugeItems);
      } catch (err) {
        console.error("Error updating gauge ", err);
      }
    };
    // Jalankan pertama kali saat mount
    updateGaugeData();

    // Set interval: ulangi setiap 2000 ms (2 detik)
    const intervalId = setInterval(updateGaugeData, 2000);

    // Cleanup: hentikan interval saat komponen unmount
    return () => clearInterval(intervalId);
  }, [fetchRealtime]); 

  console.log({gaugeData: gaugeData})

const fetchData = useCallback(async () => {
  setLoading(true);
  const allTags = [...preheat_primer1];
  const params = `tags=${allTags.join(",")}&cat=CHAMBER-01`;

  const safeFetch = async (url: string) => {
    try {
      const res = await fetch(url);
      return res.ok ? await res.json() : [];
    } catch {
      return [];
    }
  };

  const [d, w, m] = await Promise.all([
    safeFetch(`/api/mchistory/daily?${params}`),
    safeFetch(`/api/mchistory/weekly?${params}`),
    safeFetch(`/api/mchistory/monthly?${params}`),
  ]);

  setDaily(groupByTag(d));
  setWeekly(groupByTag(w));
  setMonthly(groupByTag(m));
  setLoading(false);
}, [preheat_primer1]); // ✅ Now it's stable and safe

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // === DAILY ===
  const dailyHotData = useMemo(() => createChartData(preheat_primer1, daily, fillDaily, cell), [preheat_primer1, daily, cell]);
  // const dailyColdData = useMemo(() => createChartData(primer2_cementing, daily, fillDaily, cell), [primer2_cementing, daily, cell]);

  // === WEEKLY ===
  const weeklyHotData = useMemo(() => createChartData(preheat_primer1, weekly, fillWeekly, cell), [preheat_primer1, weekly, cell]);
  // const weeklyColdData = useMemo(() => createChartData(primer2_cementing, weekly, fillWeekly, cell), [primer2_cementing, weekly, cell]);

  // === MONTHLY ===
  const monthlyHotData = useMemo(() => createChartData(preheat_primer1, monthly, fillMonthly, cell), [preheat_primer1, monthly, cell]);
  // const monthlyColdData = useMemo(() => createChartData(primer2_cementing, monthly, fillMonthly, cell), [primer2_cementing, monthly, cell]);

  return (
    <div className="p-8">
      <NavMc />
      <hr className="border-gray-600"/>
      <div className="w-full flex justify-center items-center gap-2">
        <h1 className="text-3xl font-bold text-center my-6 dark:text-white">BackPart Molding ({cell})</h1>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 md:col-span-4 rounded-xl h-full shadow-md flex flex-col gap-4">
        <div className="rounded-xl overflow-hidden flex justify-center">
          <Image
            src="/images/cards/card-01.jpg"
            alt="Card Image"
            width={600}
            height={500}
            className="w-full h-auto object-cover"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 w-full">
          <div className="grid grid-cols-2 text-white p-3 gap-3 border border-red-500 rounded-xl bg-red-900/20 h-[300px]">
            <h2 className="font-bold text-lg col-span-2 text-center w-full">PREHEAT TEMP</h2>
            {gaugeData
              .filter(g => g.label.startsWith("Hot"))
              .map((g, i) => (
                <TempGauge
                  key={i}
                  min={g.min}
                  max={g.max}
                  value={g.value}
                  label={g.label}
                  qty={g.qty}
                  time={g.time}
                />
              ))}
          </div>
        </div>


        </div>
        <div className="grid grid-cols-6 gap-2 col-span-12 md:col-span-8 rounded-xl border border-gray-500 h-full bg-blue-800/10 shadow-md p-4">
          {/* DAILY */}
          <ChartCard title="Daily - Hot Temp">
            <div className="h-64 md:h-72 lg:h-80">
            <Line data={dailyHotData} options={CHART_OPTIONS} />
            </div>
          </ChartCard>
          {/* <ChartCard title="Daily - Cold Temp">
            <div className="h-64 md:h-72 lg:h-80">
            <Line data={dailyColdData} options={CHART_OPTIONS} />
            </div>
          </ChartCard> */}

          {/* WEEKLY */}
          <ChartCard title="Weekly - Hot Temp">
            <div className="h-64 md:h-72 lg:h-80">
            <Line data={weeklyHotData} options={CHART_OPTIONS} />
            </div>
          </ChartCard>
          {/* <ChartCard title="Weekly - Cold Temp">
            <div className="h-64 md:h-72 lg:h-80">
            <Line data={weeklyColdData} options={CHART_OPTIONS} />
            </div>
          </ChartCard> */}

          {/* MONTHLY */}
          <ChartCard title="Monthly - Hot Temp">
            <div className="h-64 md:h-72 lg:h-80">
            <Line data={monthlyHotData} options={CHART_OPTIONS} />
            </div>
          </ChartCard>
          {/* <ChartCard title="Monthly - Cold Temp">
            <div className="h-64 md:h-72 lg:h-80">
            <Line data={monthlyColdData} options={CHART_OPTIONS} />
            </div>
          </ChartCard> */}
        </div>
    
      </div>

      {loading && <p className="text-center text-gray-500">Loading...</p>}
    </div>
  );
}

// === HELPER FUNCTION UNTUK MEMBUAT CHART DATA ===
function createChartData(
  tags: string[],
  groupedData: GroupedResult,
  filler: FillFunction,
  cell: string
): { labels: string[]; datasets: ChartDatasetCustom[] } {
  const filled = filler([]);
  const labels = "hour" in filled[0]
    ? (filled as { hour: string; value: number | null }[]).map(d => d.hour)
    : (filled as { label: string; value: number | null }[]).map(d => d.label);

  const datasets: ChartDatasetCustom[] = tags.map((tag) => {
    const dataForTag = filler(groupedData[tag] || []);
    const values = "hour" in dataForTag[0]
      ? (dataForTag as { hour: string; value: number | null }[]).map(d => d.value)
      : (dataForTag as { label: string; value: number | null }[]).map(d => d.value);

    return {
      label: `${tag} (${cell})`,
      borderColor: COLORS[tag] ?? "gray",
      backgroundColor: "transparent",
      borderWidth: 2,
      data: values,
      fill: false,
      tension: 0.3,
    };
  });

  // === Tambahkan garis referensi MIN & MAX (dengan warna & label benar) ===
  tags.forEach((tag) => {
    const rawPoints = groupedData[tag] || [];
    if (rawPoints.length === 0) return;

    const firstPoint = rawPoints[0];
    const minVal = firstPoint.min;
    const maxVal = firstPoint.max;

    // ✅ Min: hijau, label "Min Standard"
    if (typeof minVal === "number") {
      datasets.push({
        label: `Min Standard (${tag})`,
        data: Array(labels.length).fill(minVal),
        borderColor: "rgba(0, 255, 0, 0.7)",   // ✅ HIJAU untuk MIN
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        showLine: true,
        tension: 0,
      });
    }

    // ✅ Max: merah, label "Max Standard"
    if (typeof maxVal === "number") {
      datasets.push({
        label: `Max Standard (${tag})`,
        data: Array(labels.length).fill(maxVal),
        borderColor: "rgba(255, 0, 0, 0.7)",   // ✅ MERAH untuk MAX
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false,
        showLine: true,
        tension: 0,
      });
    }
  });

  return { labels, datasets };
}