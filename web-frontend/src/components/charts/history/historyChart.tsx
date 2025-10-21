// src/components/charts/history/HistoryChart.tsx

"use client";

import React from 'react';
// import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  // ChartData,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale, 
  TimeSeriesScale, 
} from 'chart.js';
import 'chartjs-adapter-date-fns'; 
import zoomPlugin from 'chartjs-plugin-zoom'; 

import { HistoryItem } from '@/types/history'; 

// === Registrasi Komponen Chart.js ===
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale, 
  TimeSeriesScale,
  zoomPlugin 
);

// Definisikan Tipe yang Benar untuk Data Cartesian Time Series
// type TimeChartData = ChartData<"line", ChartPoint[], unknown>;

// const COLORS: { [key: string]: string } = {
//   "data2": 'rgb(0, 100, 200)', "data3": 'rgb(0, 150, 150)', 
//   "default": 'rgb(128, 128, 128)', 
// };
// const TAG_LABELS: { [key: string]: string } = {
//   "data2": "CP 1", "data3": "CP 2", 
// };

interface HistoryChartProps {
  data: HistoryItem[]; 
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ data }) => {

  // const { chartData, uniqueTagNames } = useMemo(() => {
  //   if (!data || data.length === 0) {
  //     return { chartData: { datasets: [] } as TimeChartData, uniqueTagNames: [] };
  //   }

  //   const groupedData = data.reduce((acc, item) => {
  //     const tagName = item.tag_name;
  //     if (!acc[tagName]) { acc[tagName] = []; }
      
  //     const time = new Date(item.start_time).getTime(); 
  //     const value = parseFloat(item.avg_value);
      
  //     if (!isNaN(value)) {
  //         acc[tagName].push({ x: time, y: value });
  //     }
  //     return acc;
  //   }, {} as Record<string, ChartPoint[]>);

  //   const uniqueTags = Object.keys(groupedData);

  //   const datasets: TimeChartData["datasets"] = uniqueTags.map((tag) => {
  //     const color = COLORS[tag] || COLORS["default"];
  //     const dataPoints = groupedData[tag].sort((a, b) => a.x - b.x); 
      
  //     return {
  //       label: TAG_LABELS[tag] || tag,
  //       data: dataPoints,
  //       borderColor: color,
  //       backgroundColor: color.replace("rgb", "rgba").replace(")", ",0.3)"),
  //       pointRadius: 3,
  //       fill: false,
  //       tension: 0.2,
  //     } as const;
  //   });

  //   return { 
  //       chartData: { datasets } as TimeChartData,
  //       uniqueTagNames: uniqueTags
  //   };
  // }, [data]);

  // --- Opsi Chart.js dengan Konfigurasi Zoom ---
  // const options = useMemo(() => {
  //   const dynamicTitle = `Historical Data Trend: ${uniqueTagNames.join(', ')}`;
    
  //   return {
  //     responsive: true,
  //     maintainAspectRatio: false,
      
  //     plugins: {
  //       legend: { position: 'top' as const },
  //       title: { display: true, text: dynamicTitle, font: { size: 16 } },
        
  //       // KONFIGURASI PLUGIN ZOOM
  //       zoom: {
  //         pan: { enabled: true, mode: 'x' as const, }, 
  //         zoom: {
  //           wheel: { enabled: true, },
  //           // Scroll biasa untuk Zoom Y
  //           mode: 'y' as const, 
  //         },
  //         // Untuk zoom X dengan modifier (Shift), Anda mungkin perlu Custom Button atau logic lebih lanjut.
  //         // Mode 'y' di atas berarti scroll biasa hanya zoom Y. Pan untuk geser X.
  //       },
  //     },
      
  //     scales: {
  //       x: {
  //         type: 'time' as const,
  //         time: {
  //           unit: 'minute', 
  //           tooltipFormat: 'dd/MM HH:mm:ss',
  //           displayFormats: { minute: 'HH:mm', hour: 'HH:mm' }
  //         },
  //         title: { display: true, text: 'Time' },
  //       },
  //       y: {
  //         title: { display: true, text: 'Average Value' },
  //       },
  //     },
  //   };
  // }, [uniqueTagNames]);

  if (!data || data.length === 0) {
    return (
      <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <p className="text-gray-600 dark:text-gray-400">Tidak ada data untuk ditampilkan pada grafik.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <div style={{ height: '400px' }}> 
        {/* <Line 
            data={chartData} 
            options={options} 
        /> */}
      </div>
    </div>
  );
};