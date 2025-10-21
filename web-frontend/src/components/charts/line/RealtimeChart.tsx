// components/RealtimeChart.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    ChartData,
    ChartOptions,
    ChartDataset // Import ChartDataset untuk tipe spesifik
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation'; // Tidak perlu mengimpor AnnotationOptions lagi
import Button from '@/components/ui/button/Button';

// Daftarkan komponen Chart.js yang diperlukan
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    annotationPlugin
);

// --- 1. TYPE DEFINITIONS & KONFIGURASI ---

// FIX: Menghindari masalah "extends" dengan mendefinisikan tipe Line Annotation secara langsung 
// Berisi properti yang dibutuhkan oleh konfigurasi anotasi di bawah.
interface LineAnnotationOptions { 
    type: 'line';
    yMin: number;
    yMax: number;
    borderColor: string;
    borderWidth: number;
    borderDash: number[];
    label: {
        content: string;
        position: 'start' | 'end';
        backgroundColor: string;
        color: string;
    };
    // Karena Chart.js annotations dapat memiliki properti tambahan seperti 'id', 
    // kita gunakan index signature untuk kompatibilitas yang lebih luas:
    [key: string]: unknown; 
}

// 📌 DEFINISI TIPE UNTUK PROPS STANDAR
interface StandardSet {
    max: number;
    min: number;
    label: string; // Label untuk ditampilkan di chart (misalnya "Standard Hot")
    color: string; // Warna garis
    tagGroup: string[]; // Tag mana yang tergolong dalam standar ini (misalnya ["data1", "data2"])
}

interface RealtimeChartProps {
    standardSettings: StandardSet[]; // Array dari standar yang berbeda
}

interface ApiDataItem {
    tag_name: string;
    value: number;
    timestamp: string;
}

interface ChartPoint {
    x: number;
    y: number;
}

interface DataHistory {
    [tagName: string]: ChartPoint[];
}

// DEFINISI CUSTOM LABELS
const TAG_LABELS: { [key: string]: string } = {
    "data1": "Hot 1 Temp",
    "data2": "Hot 2 Temp",
    "data3": "Cold 1 Temp", 
    "data4": "Cold 2 Temp", 
};

// Gunakan keys dari TAG_LABELS untuk menentukan tag yang akan ditampilkan
const TAGS_TO_DISPLAY: string[] = Object.keys(TAG_LABELS); 
const POLLING_INTERVAL = 3000;

const COLORS: { [key: string]: string } = {
    "data1": 'rgb(255, 99, 132)', 
    "data2": 'rgb(54, 162, 235)', 
    "data3": 'rgb(255, 206, 86)', 
    "data4": 'rgb(75, 192, 192)',
};

const fetchData = async (): Promise<ApiDataItem[]> => {
    const apiUrl = `${process.env.API_ENDPOINT}/api/log/1`; 
    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error(`Gagal mengambil data API: ${response.statusText}`);
    }
    const data: ApiDataItem[] = await response.json();
    return data;
};

const processData = (apiData: ApiDataItem[], currentData: DataHistory): DataHistory => {
    const latestDataGrouped = apiData.reduce((acc, item) => {
        const tagName = item.tag_name;
        if (TAGS_TO_DISPLAY.length > 0 && !TAGS_TO_DISPLAY.includes(tagName)) {
            return acc;
        }
        if (!acc[tagName]) { acc[tagName] = []; }
        const time = new Date(item.timestamp).getTime(); 
        acc[tagName].push({ x: time, y: item.value });
        return acc;
    }, {} as DataHistory);

    const newDataHistory: DataHistory = { ...currentData };

    Object.keys(latestDataGrouped).forEach(tagName => {
        const history = newDataHistory[tagName] ? newDataHistory[tagName].slice() : [];
        const latestPoints = latestDataGrouped[tagName];
        
        latestPoints.forEach(newPoint => {
            const exists = history.some(oldPoint => oldPoint.x === newPoint.x);
            if (!exists) { history.push(newPoint); }
        });

        history.sort((a, b) => a.x - b.x);
        newDataHistory[tagName] = history.slice(-50); 
    });

    return newDataHistory;
};

// --- 2. KOMPONEN UTAMA ---

// 📌 TERIMA PROPS
export default function RealtimeChart({ standardSettings }: RealtimeChartProps) {
    const [dataHistory, setDataHistory] = useState<DataHistory>({}); 
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // FIX: Menggunakan 'time' untuk sumbu X
    const chartRef = useRef<ChartJS<'line', ChartPoint[], 'time'> | null>(null);

    // ... (Hook Polling Data tetap sama)

    useEffect(() => {
        const pollApi = async () => {
            try {
                const apiResponse = await fetchData();
                setDataHistory(prevDataHistory => processData(apiResponse, prevDataHistory));
                setLoading(false);
            } catch (err: unknown) {
                const errorMessage = (err instanceof Error) ? err.message : "Terjadi kesalahan yang tidak diketahui.";
                console.error("Error fetching data:", err);
                setError(errorMessage);
                setLoading(false);
            }
        };
        pollApi(); 
        const intervalId = setInterval(pollApi, POLLING_INTERVAL);
        return () => clearInterval(intervalId);
    }, []); 

    // =======================================================
    // FUNGSI EKSPOR (Tetap sama)
    // =======================================================

    const exportChartAsImage = (format: 'png' | 'jpeg') => {
        const chartInstance = chartRef.current;
        if (!chartInstance) {
            alert("Grafik belum siap.");
            return;
        }

        const canvas = chartInstance.canvas;
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const filename = `grafik_realtime_${new Date().toISOString()}.${format}`;
        
        const dataURL = canvas.toDataURL(mimeType, format === 'jpeg' ? 0.9 : 1.0);
        
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportDataAsCsv = () => {
        const data = dataHistory; 
        if (Object.keys(data).length === 0) {
            alert("Tidak ada data untuk diekspor.");
            return;
        }

        const allTags = Object.keys(data).sort(); 
        const headerLabels = allTags.map(tag => TAG_LABELS[tag] || tag); 
        const allTimestamps = new Set<number>(); 
        
        allTags.forEach(tag => data[tag].forEach(point => allTimestamps.add(point.x)));
        const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

        let csvContent = "Waktu," + headerLabels.join(",") + "\n";
        
        sortedTimestamps.forEach(timestamp => {
            const timeString = new Date(timestamp).toLocaleString('id-ID'); 
            
            const dataValues = allTags.map(tag => {
                const point = data[tag].find(p => p.x === timestamp);
                return point ? point.y.toFixed(2).toString() : ''; 
            });
            
            csvContent += timeString + "," + dataValues.join(",") + "\n";
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `data_historis_${new Date().toISOString()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- RENDERING & OPSIONAL CHART ---

    // FIX: Menggunakan tipe LineAnnotationOptions yang sudah diperbaiki
    const createAnnotations = (): Record<string, LineAnnotationOptions> => {
        const annotations: Record<string, LineAnnotationOptions> = {};

        standardSettings.forEach((setting, index) => {
            // Annotation Max
            annotations[`standardMax${index}`] = {
                type: 'line',
                yMin: setting.max, 
                yMax: setting.max,
                borderColor: setting.color || 'red', // Gunakan warna dari props
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                    content: `${setting.label} Max (${setting.max})`,
                    position: 'end',
                    backgroundColor: setting.color.replace('rgb', 'rgba').replace(')', ', 0.5)'),
                    color: 'white'
                },
            };
            
            // Annotation Min
            annotations[`standardMin${index}`] = {
                type: 'line',
                yMin: setting.min, 
                yMax: setting.min,
                borderColor: setting.color || 'orange', 
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                    content: `${setting.label} Min (${setting.min})`,
                    position: 'start',
                    backgroundColor: setting.color.replace('rgb', 'rgba').replace(')', ', 0.5)'),
                    color: 'white'
                },
            };
        });
        
        return annotations;
    };


    const chartData: ChartData<'line', ChartPoint[]> = {
        // FIX: Menghapus 'as any' dan menggunakan tipe ChartDataset yang spesifik
        datasets: Object.keys(dataHistory).map(tagName => {
            const color = COLORS[tagName] || 'rgba(128, 128, 128, 1)';
            const customLabel = TAG_LABELS[tagName] || tagName; 
            
            const dataset: ChartDataset<'line', ChartPoint[]> = {
                label: customLabel, 
                data: dataHistory[tagName] || [],
                borderColor: color,
                backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.3)'),
                fill: false, tension: 0.2, pointRadius: 3, showLine: true,
            };
            return dataset; 
        }),
    };

    const options: ChartOptions<'line'> = {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { 
                position: 'bottom' as const,
                labels: {
                    color: '#FFFFFF'
                }
            },
            title: { display: true, text: 'Back Part Molding Machine', color: '#FFFFFF' },
            tooltip: { 
                mode: 'index', 
                intersect: false,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y.toFixed(2);
                        }
                        return label;
                    }
                }
            },
            // 📌 GUNAKAN FUNGSI createAnnotations
            annotation: {
                annotations: createAnnotations()
            }
        },
        scales: {
            x: {
                type: 'time', time: { unit: 'second', tooltipFormat: 'yyyy-MM-dd HH:mm:ss', displayFormats: { second: 'HH:mm:ss', minute: 'HH:mm' } },
                title: { display: true, text: 'Waktu', color: '#BBBBBB' }, ticks: { color: '#AAAAAA' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            y: {
                title: { display: true, text: 'Value', color: '#BBBBBB' }, beginAtZero: false, 
                ticks: { color: '#AAAAAA' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
        },
        backgroundColor: '#1E1E2F'
    };

    if (loading) return <p style={{ color: '#fff' }}>Memuat data awal...</p>;
    if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;

    const hasData = Object.keys(dataHistory).length > 0;
    
    return (
        <div className='rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] flex flex-col justify-between col-span-6 ' >
            
            {/* Kontrol Ekspor */}
            <div style={{ display: 'flex', gap: '10px' }} className='absolute'>
                <Button variant='outline' size='xs' onClick={exportDataAsCsv}  className='text-green'>CSV</Button>
                <Button variant='outline' size='xs' onClick={() => exportChartAsImage('png')}>PNG</Button>
                <Button variant='outline' size='xs' onClick={() => exportChartAsImage('jpeg')}>JPG</Button>
            </div>

            {/* Area Grafik */}
            <div style={{ width: '100%', height: '500px' }}>
              {!hasData && !loading ? (
                <p style={{ color: '#fff' }}>Tidak ada data yang tersedia.</p>
              ) : (
                <Line 
                    ref={chartRef}
                    data={chartData} 
                    options={options} 
                />
              )}
            </div>
        </div>
    );
}