// src/hooks/useProductionSettings.ts

import { useState, useEffect, useMemo } from 'react';

// --- Interfaces berdasarkan API /api/settings ---

interface StationData {
  model: string[];
  target: string;
}

interface APISettingsResponse {
  [stationName: string]: StationData;
}

interface ProductionLine {
  lineName: string;
  target: string;
}

// Konstanta untuk Polling
const POLLING_INTERVAL = 10000; // Melakukan fetch ulang setiap 10 detik

/**
 * Hook untuk mengambil data konfigurasi produksi (settings) dari API
 * dengan fitur Polling untuk pembaruan data berkala.
 * * Data diproses untuk mendapatkan daftar Line Produksi (beserta targetnya) dan Model unik.
 * * @param apiUrl URL endpoint API (default: '/api/settings')
 */
export function useProductionSettings(apiUrl: string = '/api/pwi-api/line-data') {
  const [data, setData] = useState<APISettingsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Fungsi async untuk melakukan fetching data
    const fetchData = async () => {
      // Tidak mereset loading state ke true saat polling berulang, 
      // hanya set true saat initial load untuk menghindari flicker UI.
      if (data === null) {
          setLoading(true);
      }
      
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch settings: ${response.statusText} (${response.status})`);
        }
        const json: APISettingsResponse = await response.json();
        
        // Update state hanya jika data benar-benar berbeda
        // Ini membantu mencegah komponen lain yang menggunakan hook ini render ulang jika datanya sama.
        if (JSON.stringify(data) !== JSON.stringify(json)) {
            setData(json);
        }
        setError(null); // Bersihkan error jika fetch berhasil
      } catch (err) {
        // Tangani error, tetapi biarkan data lama (jika ada) tetap terlihat.
        console.error("Error fetching production settings:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    // 1. Lakukan fetch segera saat komponen mount (initial load)
    fetchData(); 

    // 2. Setup Polling: Lakukan fetch ulang setiap POLLING_INTERVAL
    const intervalId = setInterval(() => {
      fetchData(); 
    }, POLLING_INTERVAL);

    // 3. Cleanup: Hentikan timer polling saat komponen unmount
    return () => clearInterval(intervalId);

  }, [apiUrl, data]); // Menambahkan data sebagai dependency (untuk check di JSON.stringify)

  // --- Data Transformation (Menggunakan useMemo untuk Efisiensi) ---
  
  // 1. Daftar Line Produksi (dengan data target)
  const productionLines: ProductionLine[] = useMemo(() => {
    if (!data) return [];
    
    // Mapping keys dan target ke array of objects
    const lines = Object.entries(data).map(([lineName, stationData]) => ({
      lineName: lineName,        
      target: stationData.target, 
    }));
    
    // Urutkan berdasarkan nama line
    return lines.sort((a, b) => a.lineName.localeCompare(b.lineName));
  }, [data]);

  // 2. Daftar Model Sepatu Unik
  const uniqueModels = useMemo(() => {
    if (!data) return [];
    
    // Menggabungkan semua model dan menghilangkan duplikat
    const allModels = Object.values(data).flatMap(station => station.model);
    const uniqueList = Array.from(new Set(allModels));

    return uniqueList.sort();
  }, [data]);


  return {
    data,                     
    productionLines,          // Array: [{ lineName: "B1-01", target: "168" }, ...]
    uniqueModels,             // Array: ["ME420", "ML515", ...]
    loading,
    error,
    isPolling: true,          // Tambahan informasi bahwa hook menggunakan polling
  };
}