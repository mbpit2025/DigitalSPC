"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { MachineStandardLimits, DataPoint } from "@/types/production-standards";

interface DashboardDataContextProps {
  data: DataPoint[];
  counter: number;
  standardData: Record<string, MachineStandardLimits>;
  refresh: () => void;
}

const DashboardDataContext =
  createContext<DashboardDataContextProps | null>(null);

const REFRESH_INTERVAL = 2;

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<DataPoint[]>([]);
  const [counter, setCounter] = useState(REFRESH_INTERVAL);

  // ✅ FIX: gunakan Record<string, MachineStandardLimits>
  const [standardData, setStandardData] = useState<Record<string, MachineStandardLimits>>({});

  const isDataValid = (latestdata: DataPoint[]) => {
    if (!Array.isArray(latestdata) || latestdata.length === 0) return false;
    const allZero = latestdata.every((dp) => dp.value === 0);
    return !allZero;
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/realtime`, { cache: "no-store" });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const result = await res.json();
      const latestdata: DataPoint[] = Array.isArray(result.latestData) ? result.latestData : [];

      if (isDataValid(latestdata)) {
        setData(latestdata);
      } else {
        console.warn("Data baru tidak valid atau semua 0, tetap pakai data lama.");
      }
    } catch (err) {
      console.error("Fetch error, gunakan data lama:", err);
    } finally {
      setCounter(REFRESH_INTERVAL);
    }
  }, []);

  const fetchStandards = useCallback(async () => {
    try {
      const res = await fetch(`/api/standards`);
      if (!res.ok) throw new Error("Failed to fetch standard data");

      // ✅ JSON return harus berupa object (bukan array)
      const standards: Record<string, MachineStandardLimits> = await res.json();
      setStandardData(standards);
    } catch (err: unknown) {
      console.error("Error fetching standard data:", (err as Error).message);
      setStandardData({});
    }
  }, []);

  const refresh = useCallback(() => {
    fetchData();
    setCounter(REFRESH_INTERVAL);
  }, [fetchData]);

  // Auto refresh + countdown
  useEffect(() => {
    fetchData();
    fetchStandards();

    const tick = setInterval(() => {
      setCounter((prev) => {
        if (prev <= 1) {
          fetchData();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [fetchData, fetchStandards]);

  // Refresh when tab becomes active
  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) {
        fetchData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchData]);

  return (
    <DashboardDataContext.Provider value={{ data, counter, standardData, refresh }}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const ctx = useContext(DashboardDataContext);
  if (!ctx)
    throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}
