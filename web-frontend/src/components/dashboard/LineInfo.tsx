"use client";

import React, { useMemo, useCallback } from 'react';
import { useProductionSettings } from '@/hooks/useProductionSettings'; 

// --- Interface untuk props komponen (Diperbarui) ---
interface LineInfoProps {
  selectedLineName: string; // Contoh: "B1-01"
  selectedModel: string | null; // Nilai model saat ini dari state Dashboard
  onModelChange: (model: string) => void; // Fungsi untuk mengubah state model di Dashboard
}

export default function LineInfo({ selectedLineName, selectedModel, onModelChange }: LineInfoProps) {
  
  // Ambil data dari hook (tetap diperlukan)
  const { data, loading, error } = useProductionSettings(); 

  // Ambil data spesifik untuk line yang dipilih
  const lineData = useMemo(() => {
    if (data && selectedLineName) {
      // Mengakses data stasiun spesifik berdasarkan nama line
      return data[selectedLineName]; 
    }
    return null;
  }, [data, selectedLineName]);
  
  // Handler untuk perubahan pilihan model
  const handleModelChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    // [PENTING]: Panggil fungsi setter dari props (mengubah state di komponen Dashboard)
    onModelChange(event.target.value); 
  }, [onModelChange]);

  // Fungsi untuk mendapatkan tanggal dan waktu saat ini
  const currentDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const currentTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // --- Handling Loading, Error, dan Data Not Found ---
  if (loading) {
    return (
      <div className="col-span-12 p-4 text-center text-gray-500 bg-gray-200 dark:bg-gray-950 rounded-xl">
        Loading Line Production Info...
      </div>
    );
  }

  if (error) {
    return (
      <div className="col-span-12 p-4 text-center text-red-500 bg-red-100 rounded-xl">
        Error fetching data: {error.message}
      </div>
    );
  }

  // Jika lineData tidak ada ATAU selectedModel belum diinisialisasi di Dashboard
  if (!lineData || !selectedModel) {
    return (
      <div className="col-span-12 p-4 text-center text-yellow-500 bg-yellow-100 rounded-xl">
        {lineData ? `Waiting for model initialization...` : `Line **${selectedLineName}** not found in settings.`}
      </div>
    );
  }
  // ---------------------------------------------------

  return (
    <div className="col-span-12 flex flex-wrap items-start justify-around xl:col-span-12 bg-gray-200 dark:bg-gray-950 p-2 gap-2 rounded-xl">
        
      {/* 1. Line Production */}
      <div className="text-gray-500 dark:text-gray-400 px-6 py-4">
        Line Production : <span className="font-semibold text-orange-400">{selectedLineName}</span>
      </div>

      {/* 2. Model (Dropdown Pilihan) */}
      <div className="text-gray-500 dark:text-gray-400 px-6 py-4 flex items-center gap-2">
        <label className="text-gray-500 dark:text-gray-400">MODEL :</label>
        <select
          // Nilai dikontrol oleh state dari parent
          value={selectedModel || 'N/A'}
          onChange={handleModelChange}
          className="font-semibold text-orange-400 p-1 border border-gray-300 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700"
          disabled={!lineData.model.length}
        >
          {lineData.model.length === 0 && <option value="N/A">N/A</option>}
          {lineData.model.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Target */}
      {/* <div className="text-gray-500 dark:text-gray-400 px-6 py-4">
        Target : <span className="font-semibold text-indigo-400">{lineData.target}</span>
      </div> */}

      {/* 4. Date */}
      <div className="text-gray-500 dark:text-gray-400 px-6 py-4">
        Date : <span className="font-semibold text-green-400">{currentDate}</span>
      </div>
      
      {/* 5. Time */}
      <div className="text-gray-500 dark:text-gray-400 px-6 py-4">
        Time : <span className="font-semibold text-green-400">{currentTime}</span>
      </div>
    </div>
  );
}