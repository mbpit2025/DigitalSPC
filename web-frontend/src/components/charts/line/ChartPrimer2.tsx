"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Line } from "react-chartjs-2";
import { ChartData } from "chart.js";
import "chartjs-adapter-date-fns";
import { CardProps, DataPoint } from "@/types/production-standards";
import { getRealtimeChartOptions } from "@/config/chartOptions";
import "@/config/chartSetup";
import { useDashboardData } from "@/context/DashboardDataContext";
import { LineAnnotation } from "@/types/chartjs";


interface ChartPoint {
  x: Date;
  y: number;
}

const CELL_MAP = {
  "B1-01": { plcId: "2", upper: "data6", outsole: "data7" },
  "B1-02": { plcId: "5", upper: "data6", outsole: "data7" },
};

const POLLING_INTERVAL = 3000;
const HISTORY_LIMIT = 50;

export const ChartPrimer2 = ({ selectedCell, selectedModel, title }: CardProps) => {
  const [dataHistory, setDataHistory] = useState<Record<string, ChartPoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chartRef = useRef(null);
  const { standardData } = useDashboardData();
  const config = CELL_MAP[selectedCell] || null;

  const tagsToDisplay = useMemo(() => {
    if (!config) return [];
    return [config.upper, config.outsole];
  }, [config]);

  const standards =
    (selectedModel && standardData[selectedModel]) || standardData["DEFAULT"];

  // ✅ Buat annotation lines
const createLineAnnotation = useCallback(
  (
    yValue: number,
    label: string,
    color: string,
    position: "start" | "end",
    limitType: "MAX" | "MIN"
  ): LineAnnotation => ({
    type: "line",
    yMin: yValue,
    yMax: yValue,
    borderColor: color,
    borderWidth: 2,
    borderDash: [6, 6],
    label: {
      content: `${label} ${limitType} (${yValue} °C)`,
      position,
      backgroundColor: color.replace("rgb", "rgba").replace(")", ", 0.7)"),
      color: "white",
      font: { weight: "bold" },
    },
  }),
  []
);


const createAnnotations = useCallback((): Record<string, LineAnnotation> => {
if (!standards) return {} as Record<string, LineAnnotation>;

  return {
    hotMax: createLineAnnotation(standards.PM2_UP_TEMP_MAX, "Heating", "rgb(255,0,0)", "end", "MAX"),
    hotMin: createLineAnnotation(standards.PM2_UP_TEMP_MIN, "Heating", "rgb(255,0,0)", "start", "MIN"),
    coldMax: createLineAnnotation(standards.PM2_OT_TEMP_MAX, "Molding", "rgb(0,0,255)", "end", "MAX"),
    coldMin: createLineAnnotation(standards.PM2_OT_TEMP_MIN, "Molding", "rgb(0,0,255)", "start", "MIN"),
  };
}, [standards, createLineAnnotation]);



  // ✅ FIX — ChartData defined with ChartPoint[]
  const chartData: ChartData<"line", ChartPoint[]> = {
    datasets: tagsToDisplay.map((tag, idx) => ({
      label: tag,
      data: dataHistory[tag] || [],
      borderColor: idx === 0 ? "rgb(255,100,0)" : "rgb(0,150,255)",
      backgroundColor: "rgba(255,100,0,0.3)",
      tension: 0.2,
      pointRadius: 3,
    })),
  };

  // ✅ Chart options
  const options = useMemo(() => {
    const annotationLines = createAnnotations();
    const titleDynamic = `${title} | Cell: ${selectedCell} | Model: ${selectedModel || "DEFAULT"}`;
    return getRealtimeChartOptions(titleDynamic, annotationLines);
  }, [title, selectedCell, selectedModel, createAnnotations]);


  // ✅ Real polling effect
  useEffect(() => {
    if (!config) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/log/${config.plcId}`);
        const json = await res.json();

        setDataHistory((prev) => {
          const updated = { ...prev };

          json.forEach((row: any) => {
            if (!tagsToDisplay.includes(row.tagname)) return;

            const newPoint: ChartPoint = {
              x: new Date(row.time),
              y: Number(row.value),
            };

            updated[row.tagname] = [
              ...(updated[row.tagname] || []),
              newPoint,
            ].slice(-HISTORY_LIMIT);
          });

          return updated;
        });

        setLoading(false);
      } catch {
        setError("Gagal mengambil data");
        setLoading(false);
      }
    };

    poll();
    const id = setInterval(poll, POLLING_INTERVAL);
    return () => clearInterval(id);
  }, [config, tagsToDisplay]);

  // ✅ Render fallback
  if (!config) {
    return <div className="rounded-2xl border p-5">Invalid Cell: {selectedCell}</div>;
  }

  if (error) return <p style={{ color: "red" }}>Error: {error}</p>;

  return (
    <div className="rounded-2xl border p-5">
      {loading ? <p>Loading chart...</p> : <Line ref={chartRef} data={chartData} options={options} />}
    </div>
  );
};
