"use client";

import React from "react";
import { useDashboardData } from "@/context/DashboardDataContext";
// Pastikan path import Anda benar
import STANDARDS_JSON from "@/data/standards.json"; 
import { ProductionStandards, MachineStandardLimits, ChartDataProps } from "@/types/production-standards";
import { ProductionChart } from "@/components/charts/line/ProductionChart"; // Import komponen chart yang baru

// DataPoint asli dari context
interface DataPoint {
  plc_id: string;
  plc_name: string;
  tag_name: string;
  value: number;
  timestamp: string;
}

// Definisikan Props untuk komponen Chart
interface DashboardChartProps {
    selectedCell: 'B1-01' | 'B1-02';
    selectedModel: string | null;
}

// Definisikan mapping PLC dan Tags untuk mesin PM1
const PM1_DATA_MAP = {
    'B1-01': {
        plcId: "5", // Asumsi PLC ID 5 untuk PM1 di B1-01
        upTag: "up_temp", 
        otTag: "ot_temp", 
    },
    'B1-02': {
        plcId: "7", // Asumsi PLC ID 7 untuk PM1 di B1-02
        upTag: "up_temp_2", 
        otTag: "ot_temp_2", 
    },
};

// Type-cast STANDARDS_JSON
const STANDARDS_BY_MODEL: ProductionStandards = STANDARDS_JSON as ProductionStandards;


const DashboardChart = ({ selectedCell, selectedModel }: DashboardChartProps) => {
    const { data } = useDashboardData();

    if (!selectedModel) {
        return (
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400 text-center">
                Please select a Model to display the chart data.
            </div>
        );
    }

    const config = PM1_DATA_MAP[selectedCell];
    const standards: MachineStandardLimits = STANDARDS_BY_MODEL[selectedModel] || STANDARDS_BY_MODEL["DEFAULT"];
    
    const filteredData: DataPoint[] = data.filter((item) => item.plc_id === config.plcId);
    
    // ---------------------------------------------------
    // Fungsi Helper untuk Menyiapkan Data Chart
    // ---------------------------------------------------
    const prepareChartData = (
        tagName: string, 
        seriesName: string, 
        title: string, 
        minLimit: number, 
        maxLimit: number
    ): ChartDataProps => {
        const seriesData = filteredData
            .filter(item => item.tag_name === tagName)
            .map(item => ({
                // Konversi timestamp string ke milidetik untuk ApexCharts
                x: new Date(item.timestamp).getTime(), 
                y: item.value,
            }))
            // Sortir berdasarkan waktu untuk memastikan chart benar
            .sort((a, b) => a.x - b.x); 

        return {
            title: title,
            unit: '°C',
            series: [{
                name: seriesName,
                data: seriesData,
            }],
            minLimit: minLimit,
            maxLimit: maxLimit,
        };
    };

    // ---------------------------------------------------
    // Inisialisasi Data untuk Chart Upper Temp
    // ---------------------------------------------------
    const upTempChartData: ChartDataProps = prepareChartData(
        config.upTag, 
        "Upper Temp Actual",
        "PM1 Upper Temperature",
        standards.PM1_UP_TEMP_MIN,
        standards.PM1_UP_TEMP_MAX
    );

    // ---------------------------------------------------
    // Inisialisasi Data untuk Chart Outsole Temp
    // ---------------------------------------------------
    const otTempChartData: ChartDataProps = prepareChartData(
        config.otTag, 
        "Outsole Temp Actual",
        "PM1 Outsole Temperature",
        standards.PM1_OT_TEMP_MIN,
        standards.PM1_OT_TEMP_MAX
    );

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Machine PM1 Data Trend (Model: {selectedModel})
            </h1>
            
            {/* Chart 1: Upper Temperature */}
            <ProductionChart chartData={upTempChartData} />

            {/* Chart 2: Outsole Temperature */}
            <ProductionChart chartData={otTempChartData} />

            {/* Debugging (Opsional) */}
            <details className="mt-4 p-2 border rounded dark:border-gray-700">
                <summary className="cursor-pointer font-medium dark:text-white">
                    Debug Filtered Data
                </summary>
                <pre className="text-xs overflow-auto bg-gray-50 dark:bg-gray-900 p-2 rounded mt-2">
                    {JSON.stringify(filteredData.slice(0, 5), null, 2)} {/* Tampilkan 5 item pertama */}
                </pre>
            </details>
        </div>
    );
}

export default DashboardChart;