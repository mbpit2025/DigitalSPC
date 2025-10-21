// components/charts/ProductionChart.tsx
"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { ChartDataProps } from "@/types/production-standards"; 

// Import dynamic untuk menghindari masalah SSR dengan ApexCharts
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface ProductionChartProps {
    chartData: ChartDataProps;
}

export const ProductionChart = ({ chartData }: ProductionChartProps) => {
    const { title, unit, series, minLimit, maxLimit } = chartData;

    // Definisikan opsi chart
    const options: ApexCharts.ApexOptions = {
        chart: {
            id: title.replace(/\s/g, '-'),
            type: 'line',
            zoom: { enabled: false },
            toolbar: { show: true },
        },
        xaxis: {
            type: 'datetime',
            title: { text: 'Time' },
        },
        yaxis: {
            title: { text: `${title} (${unit})` },
        },
        stroke: {
            curve: 'smooth',
            width: 3,
        },
        dataLabels: {
            enabled: false,
        },
        tooltip: {
            x: { format: 'dd MMM HH:mm:ss' }
        },
        // Garis batas MIN/MAX
        annotations: {
            yaxis: [
                {
                    y: maxLimit,
                    borderColor: '#FF0000', // Merah untuk MAX
                    borderWidth: 2,
                    label: {
                        borderColor: '#FF0000',
                        style: { color: '#fff', background: '#FF0000' },
                        text: `MAX: ${maxLimit} ${unit}`,
                    },
                },
                {
                    y: minLimit,
                    borderColor: '#00BFFF', // Biru untuk MIN
                    borderWidth: 2,
                    label: {
                        borderColor: '#00BFFF',
                        style: { color: '#fff', background: '#00BFFF' },
                        text: `MIN: ${minLimit} ${unit}`,
                    },
                },
            ],
        },
        title: {
            text: `${title} (Standard: ${minLimit}-${maxLimit} ${unit})`,
            align: 'left',
            style: {
                fontSize: '16px',
                color: '#333'
            }
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <Chart options={options} series={series} type="line" height={350} />
        </div>
    );
};