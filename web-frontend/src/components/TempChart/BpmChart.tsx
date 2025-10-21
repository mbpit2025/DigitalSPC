"use client";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

// Import ApexCharts dynamically (to avoid SSR errors in Next.js)
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface TemperatureChartProps {
  sensor1: number[];
  sensor2: number[];
  sensor3: number[];
  sensor4: number[];
  minValue: number;
  maxValue: number;
  labels: string[]; // e.g. timestamps
}

interface Series {
  name: string;
  data: number[];
}

export default function BpmChart({
  sensor1,
  sensor2,
  sensor3,
  sensor4,
  minValue,
  maxValue,
  labels,
}: TemperatureChartProps) {
  const [series, setSeries] = useState<Series[]>([]);

  useEffect(() => {
    setSeries([
      {
        name: "Sensor 1",
        data: sensor1,
      },
      {
        name: "Sensor 2",
        data: sensor2,
      },
      {
        name: "Sensor 3",
        data: sensor3,
      },
      {
        name: "Sensor 4",
        data: sensor4,
      },
      {
        name: "Min Threshold",
        data: Array(labels.length).fill(minValue),
      },
      {
        name: "Max Threshold",
        data: Array(labels.length).fill(maxValue),
      },
    ]);
  }, [sensor1, sensor2, sensor3, sensor4, minValue, maxValue, labels]);

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: "line",
      height: 350,
      zoom: { enabled: true },
    },
    stroke: {
      curve: "smooth",
      width: [2, 2, 2, 2, 1.5, 1.5], // thicker for sensors, thinner for thresholds
      dashArray: [0, 0, 0, 0, 5, 5], // dashed lines for min/max
    },
    colors: ["#FF5733", "#1E90FF", "#28a745", "#dc3545"],
    dataLabels: { enabled: false },
    xaxis: {
      categories: labels, // e.g. timestamps
      title: { text: "Time" },
    },
    yaxis: {
      title: { text: "Temperature (°C)" },
    },
    legend: {
      position: "top",
      fontSize: "8px",
      show: false
    },
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-4 sm:pt-6 col-span-12 md:col-span-6 lg:col-span-4 xl:col-span-3">
      <div className="w-full">
        <h3 className="text-gray-900 dark:text-gray-100">BPM Chart Title</h3>
        <Chart options={options} series={series} type="line" height={350}/>
      </div>
    </div>
  );
}
