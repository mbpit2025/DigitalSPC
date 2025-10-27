"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"; // Import useCallback

interface DataPoint {
  plc_id: string;
  plc_name: string;
  tag_name: string;
  value: number;
  timestamp: string;
}

interface DashboardDataContextProps {
  data: DataPoint[];
  counter: number;
  refresh: () => void;
}

const DashboardDataContext = createContext<DashboardDataContextProps | null>(null);

const REFRESH_INTERVAL = 2; // detik

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [counter, setCounter] = useState(REFRESH_INTERVAL);

  // Validasi data baru (diekstrak di luar useCallback karena tidak ada dependensi state/props)
  const isDataValid = (latestdata: DataPoint[]) => {
    if (!Array.isArray(latestdata) || latestdata.length === 0) return false;
    // Jika semua value = 0 → tidak valid
    const allZero = latestdata.every((dp) => dp.value === 0);
    return !allZero;
  };

  // PERBAIKAN: Gunakan useCallback untuk memastikan fetchData stabil.
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/realtime`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const result = await res.json();
      const latestdata: DataPoint[] = Array.isArray(result.latestData) ? result.latestData : [];
        // console.log(latestdata)
      if (isDataValid(latestdata)) {
        setData(latestdata); // update state hanya jika data valid
      } else {
        console.warn("Data baru tidak valid atau semua 0, tetap pakai data lama.");
      }

    } catch (err) {
      console.error("Fetch error, gunakan data lama:", err);
      // Tetap pakai data lama
    } finally {
      setCounter(REFRESH_INTERVAL);
    }
  }, []); // Dependency array kosong karena fetchData tidak bergantung pada state/props apa pun saat ini

  useEffect(() => {
    // Panggil pertama kali
    fetchData();

    const tick = setInterval(() => {
      setCounter((prev) => {
        if (prev <= 1) {
          // Panggil fetchData melalui fungsi callback yang stabil
          fetchData();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    // fetchData harus dimasukkan karena React memerlukannya (walaupun sudah stabil)
    return () => clearInterval(tick);
  }, [fetchData]); // PERBAIKAN: fetchData sekarang ada di dependency array

  return (
    <DashboardDataContext.Provider value={{ data, counter, refresh: fetchData }}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}