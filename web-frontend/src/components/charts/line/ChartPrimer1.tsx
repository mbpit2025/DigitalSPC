"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ChartData,
} from "chart.js";
import "chartjs-adapter-date-fns";
import Button from "@/components/ui/button/Button";
import { CardProps } from "@/types/production-standards";
import { getRealtimeChartOptions } from "@/config/chartOptions";
import "@/config/chartSetup";
import { LineAnnotation } from "@/types/chartjs";
import { useDashboardData } from "@/context/DashboardDataContext";


interface CellConfig {
    plcId: string;
    upper: string; outsole: string; 
}

const CELL_MAP: { [key: string]: CellConfig } = {
    'B1-01': {
        plcId: "2", upper: "data4", outsole: "data5",
    },
    'B1-02': {
        plcId: "5", upper: "data4", outsole: "data5",
    },
};

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


const TAG_LABELS: { [key: string]: string } = {
    "data4": "Upper Temp", "data5": "Outsole Temp", 
};

const COLORS: { [key: string]: string } = {
//hot//
"data4": 'rgb(255, 50, 50)',   // Merah
"data5": 'rgb(255, 100, 0)',  // Oranye Merah
"data6": 'rgb(255, 150, 0)',  // Oranye
"data7": 'rgb(255, 200, 0)',  // Oranye Kuning

//cold//
"data2": 'rgb(0, 100, 200)',  // Biru Tua
"data3": 'rgb(0, 150, 150)',  // Biru-Hijau Laut
"data8": 'rgb(0, 200, 100)',  // Hijau Mint
"data9": 'rgb(0, 255, 0)',    // Hijau Cerah 
};

const POLLING_INTERVAL = 3000; 
const HISTORY_LIMIT = 50; 



const fetchData = async (plcId: string): Promise<ApiDataItem[]> => {
    // Diasumsikan API log mengambil data dalam rentang waktu yang besar
    const apiUrl = `/api/log/${plcId}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error(`Gagal mengambil data API untuk PLC ${plcId}: ${response.statusText}`);
    }
    const data: ApiDataItem[] = await response.json();
    return data;
};

const processData = (
    apiData: ApiDataItem[], 
    currentData: DataHistory, 
    tagsToDisplay: string[],
    filterRange: { start: string; end: string } | null
): DataHistory => {
    
    const latestDataGrouped = apiData.reduce((acc, item) => {
        const tagName = item.tag_name;
        if (!tagsToDisplay.includes(tagName)) return acc;
        
        const time = new Date(item.timestamp).getTime(); 
        
        // 📌 LOGIC FILTER WAKTU (HH:MM) - Diperbarui agar konsisten dengan input 24 jam
        if (filterRange) {
            const itemDate = new Date(time);
            // Format jam menjadi HH:MM untuk perbandingan string
            const itemTimeStr = `${itemDate.getHours().toString().padStart(2, '0')}:${itemDate.getMinutes().toString().padStart(2, '0')}`;
            
            // Perbandingan string waktu bekerja dengan benar untuk format HH:MM
            if (itemTimeStr < filterRange.start || itemTimeStr > filterRange.end) {
                return acc;
            }
        }
        // -----------------------------
        
        if (!acc[tagName]) { acc[tagName] = []; }
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
        // Batasi riwayat data hanya jika tidak ada filter waktu aktif (mode real-time)
        newDataHistory[tagName] = filterRange ? history : history.slice(-HISTORY_LIMIT); 
    });

    return newDataHistory;
};

export const ChartPrimer1 = ({ selectedCell, selectedModel, title }: CardProps) => {
    const [dataHistory, setDataHistory] = useState<DataHistory>({}); 
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<string>(''); 
    const [endTime, setEndTime] = useState<string>('');
    const chartRef = useRef<ChartJS<'line', ChartPoint[], 'time'> | null>(null);
    const {standardData} = useDashboardData()

    const config = CELL_MAP[selectedCell];
    
    const tagsToDisplay = useMemo(() => {
        if (!config) return [];
        return [
            config.upper, config.outsole
        ];
    }, [config]);
   
    
    const filterRange = useMemo(() => {
        // Memastikan format HH:mm dan waktu mulai tidak melebihi waktu berakhir
        if (startTime && endTime && startTime.match(/^\d{2}:\d{2}$/) && endTime.match(/^\d{2}:\d{2}$/) && startTime <= endTime) {
            return { start: startTime, end: endTime };
        }
        return null;
    }, [startTime, endTime]);

    const standards =
        (selectedModel && standardData[selectedModel]) ||
        standardData["DEFAULT"];
    
        
    const createLineAnnotation = useCallback((
    yValue: number,
    label: string,
    color: string,
    position: 'start' | 'end',
    type: 'MAX' | 'MIN'
    ): LineAnnotation => ({
    type: 'line',
    yMin: yValue,
    yMax: yValue,
    borderColor: color,
    borderWidth: 2,
    borderDash: [6, 6],
    label: {
        content: `${label} ${type} (${yValue} °C)`,
        position,
        backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.7)'),
        color: 'white',
        font: { weight: 'bold' },
    },
    }), []); 

    const createAnnotations = useCallback((): Record<string, LineAnnotation> => { 
    const annotations: Record<string, LineAnnotation> = {};
    if (!standards) return annotations;

    const hotColor = 'rgb(255, 0, 0)'; 
    annotations['uperMax'] = createLineAnnotation(standards.PM1_OT_TEMP_MAX, 'Outsole Std', hotColor, 'end', 'MAX');
    annotations['upperMin'] = createLineAnnotation(standards.PM1_OT_TEMP_MIN, 'Outsole Std', hotColor, 'start', 'MIN');
    
    const coldColor = 'rgb(0, 0, 255)'; 
    annotations['outsoleMax'] = createLineAnnotation(standards.PM1_UP_TEMP_MAX, 'Upper Std', coldColor, 'end', 'MAX');
    annotations['outsoleMins'] = createLineAnnotation(standards.PM1_UP_TEMP_MIN, 'Upper Std', coldColor, 'start', 'MIN');

    return annotations;
    }, [standards, createLineAnnotation]);

    useEffect(() => {
        if (!config) {
             setError(`Konfigurasi untuk cell ${selectedCell} tidak ditemukan.`);
             setLoading(false);
             return;
        }

        const pollApi = async () => {
            try {
                const apiResponse = await fetchData(config.plcId);
                // Teruskan filterRange ke processData
                setDataHistory(prevDataHistory => processData(apiResponse, prevDataHistory, tagsToDisplay, filterRange));
                setLoading(false);
            } catch (err: unknown) { // PERBAIKAN 4: Ganti 'any' dengan 'unknown'
                const errorMessage = (err instanceof Error) ? err.message : "Terjadi kesalahan yang tidak diketahui.";
                console.error("Error fetching data:", err);
                setError(errorMessage);
                setLoading(false);
            }
        };

        setDataHistory({});
        setError(null);
        setLoading(true);

        pollApi(); 
        
        let intervalId: NodeJS.Timeout | null = null;
        
        // Polling hanya berjalan jika TIDAK ada filter waktu (mode real-time)
        if (!filterRange) {
             intervalId = setInterval(pollApi, POLLING_INTERVAL);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    // Tambahkan filterRange sebagai dependensi
    }, [selectedCell, config, tagsToDisplay, filterRange]); 

    const exportChartAsImage = (format: 'png' | 'jpeg') => { 
        const chartInstance = chartRef.current;
        if (!chartInstance) { alert("Grafik belum siap."); return; }
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
        const allData: string[] = ["Tag,Time,Value"];
        Object.entries(dataHistory).forEach(([tag, points]) => {
        points.forEach((p) => {
            allData.push(`${tag},${new Date(p.x).toISOString()},${p.y}`);
        });
        });
        const blob = new Blob([allData.join("\n")], { type: "text/csv" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `data_${new Date().toISOString()}.csv`;
        link.click();
    };

    const resetZoom = () => {
        const chartInstance = chartRef.current;
        if (chartInstance) {
            chartInstance.resetZoom();
        }
    };
 
    const chartData: ChartData<"line", ChartPoint[]> = {
        datasets: tagsToDisplay.map((tag) => {
        const color = COLORS[tag] || "rgba(128,128,128,1)";
        return {
            label: TAG_LABELS[tag] || tag,
            data: dataHistory[tag] || [],
            borderColor: color,
            backgroundColor: color.replace("rgb", "rgba").replace(")", ",0.3)"),
            pointRadius: 3,
            fill: false,
            tension: 0.2,
        };
        }),
    };

  // === Custom Zoom Control ===
    const options = useMemo(() => {
    const annotationLines = createAnnotations();
    const dynamicTitle = `${title} | Cell: ${selectedCell} | Model: ${
        selectedModel || "Default"
    }`;
    return getRealtimeChartOptions(dynamicTitle, annotationLines);
    }, [title, selectedCell, selectedModel, createAnnotations]);

    if (error) return <p style={{ color: 'red', padding: '20px' }}>Error: {error}</p>;

        if (!config) {
        return (
        <div className="p-5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-gray-600 dark:text-gray-400">
            Invalid cell selection: {selectedCell}
            </p>
        </div>
        );
    }


    const hasData = Object.values(dataHistory).some(arr => arr.length > 0);
    
    return (
        <div className='rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] flex flex-col justify-between col-span-12 lg:col-span-4 ' >
            <div style={{ display: 'flex', gap:"10px", justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }} className='flex-wrap'>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <Button variant='outline' size='xs' onClick={exportDataAsCsv} >CSV</Button>
                    <Button variant='outline' size='xs' onClick={() => exportChartAsImage('png')}>PNG</Button>
                    <Button variant='outline' size='xs' onClick={() => exportChartAsImage('jpeg')}>JPG</Button>
                    <Button variant='outline' size='xs'
                    onClick={resetZoom}
                    >
                        Reset Zoom
                    </Button>
                </div>

                {/* 📌 KONTROL FILTER WAKTU (HH:MM) */}
                <div className="flex flex-wrap gap-1">
                    <label style={{ color: '#BBBBBB' }}>Filter Jam:</label>
                    <input 
                        type="time" 
                        value={startTime} 
                        onChange={(e) => setStartTime(e.target.value)} 
                        className="flex p-1 bg-gray-600"
                    />
                    <span className="text-gray-200">s.d.</span>
                    <input 
                        type="time" 
                        value={endTime} 
                        onChange={(e) => setEndTime(e.target.value)}
                        className="flex p-1 bg-gray-600"

                    />
                    {filterRange && <span style={{ color: 'orange' }}>FILTER AKTIF</span>}
                    <Button variant='outline' size='xs' onClick={() => { setStartTime(''); setEndTime(''); }} disabled={!filterRange}>
                        Reset
                    </Button>
                </div>
            </div>

            <div style={{ width: '100%', height: '400px' }}>
              {!hasData && !loading ? (
                <p style={{ color: '#aaa', textAlign: 'center', marginTop: '100px' }}>Memuat data...</p>
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
};