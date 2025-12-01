// src/hooks/useProductionSettings.ts

import { useState, useEffect, useMemo, useCallback } from 'react';


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


const POLLING_INTERVAL = 10000; // Melakukan fetch ulang setiap 10 detik

/**
 * Hook untuk mengambil data konfigurasi produksi (settings) dari API
 * dengan fitur Polling untuk pembaruan data berkala.
 * * Data diproses untuk mendapatkan daftar Line Produksi (beserta targetnya) dan Model unik.
 * * @param apiUrl URL endpoint API (default: '/api/settings')
 */
export function useProductionSettings(apiUrl: string = `/api/pwi-api/line-data`) {
  const [data, setData] = useState<APISettingsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

    // --- Fungsi untuk refetch manual ---
  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`Failed to fetch settings: ${response.statusText} (${response.status})`);
      const json: APISettingsResponse = await response.json();
      if (JSON.stringify(data) !== JSON.stringify(json)) setData(json);
      setError(null);
    } catch (err) {
      console.error("Error fetching production settings:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, data, setLoading, setData, setError]);

  useEffect(() => {
    const fetchData = async () => {
      if (data === null) {
          setLoading(true);
      }
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch settings: ${response.statusText} (${response.status})`);
        }
        const json: APISettingsResponse = await response.json();
        if (JSON.stringify(data) !== JSON.stringify(json)) {
            setData(json);
        }
        setError(null); 
      } catch (err) {
        // Tangani error, tetapi biarkan data lama (jika ada) tetap terlihat.
        console.error("Error fetching production settings:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData(); 

    // 2. Setup Polling: Lakukan fetch ulang setiap POLLING_INTERVAL
    const intervalId = setInterval(() => {
      fetchData(); 
    }, POLLING_INTERVAL);
    return () => clearInterval(intervalId);
  }, [apiUrl, data]); 

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
    productionLines,       
    uniqueModels,          
    loading,
    error,
    isPolling: true,
    refetch         
  };
}