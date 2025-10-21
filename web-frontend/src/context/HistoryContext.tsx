// src/contexts/HistoryContext.tsx

"use client";

import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { HistoryItem, FilterProps } from '@/types/history'; // Menggunakan alias @
// import { TimeScale, TimeSeriesScale } from 'chart.js';

// --- Definisikan Tipe Context ---
interface HistoryContextType {
  historyData: HistoryItem[];
  isLoading: boolean;
  error: string | null;
  getHistoryData: (props: FilterProps) => HistoryItem[];
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

// --- Context Provider ---
interface HistoryProviderProps {
  children: ReactNode;
}

export const HistoryProvider: React.FC<HistoryProviderProps> = ({ children }) => {
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); 
  const [error, setError] = useState<string | null>(null);

  // LOGIKA FETCH API NYATA
  useEffect(() => {
    const fetchApiData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Ganti dengan endpoint API Anda yang memberikan semua data (atau subset besar)
        const res = await fetch(`${process.env.API_ENDPOINT}/history/1`, { cache: 'no-store' }); 
        
        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
        }
        
        const data: HistoryItem[] = await res.json();
        setHistoryData(data);
        
      } catch (e) {
        console.error("Failed to fetch history data:", e);
        setError(e instanceof Error ? e.message : 'Gagal mengambil data histori');
        setHistoryData([]); 
      } finally {
        setIsLoading(false); 
      }
    };
    
    fetchApiData();
  }, []); 

  // FUNGSI UTAMA FILTERING
  const getHistoryData = useCallback(({ plc_id, tag_names }: FilterProps): HistoryItem[] => {
    const requiredTags = new Set(tag_names.map(tag => tag.toLowerCase()));
    
    const filteredData = historyData.filter(item => {
      const matchesPlc = item.plc_id === plc_id;
      const matchesTag = requiredTags.has(item.tag_name.toLowerCase());
      
      return matchesPlc && matchesTag;
    });

    return filteredData;
  }, [historyData]); 

  const contextValue: HistoryContextType = {
    historyData,
    isLoading,
    error,
    getHistoryData,
  };

  return (
    <HistoryContext.Provider value={contextValue}>
      {children}
    </HistoryContext.Provider>
  );
};

// Custom Hook
export const useHistory = () => {
  const context = useContext(HistoryContext);
  if (context === undefined) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};