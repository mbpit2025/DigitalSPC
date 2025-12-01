"use client";

import React, { useMemo, useCallback } from 'react';
import { useProductionSettings } from '@/hooks/useProductionSettings'; 

interface LineInfoProps {
  selectedLineName: string; // Contoh: "B1-01"
  selectedModel: string | null; // Nilai model saat ini dari state Dashboard
  onModelChange: (value: string | null) => void; // Fungsi untuk mengubah state model di Dashboard
}

export default function LineInfo({ selectedLineName, selectedModel, onModelChange }: LineInfoProps) {
  
  // Ambil data dari hook (tetap diperlukan)
  const { data, loading, error, refetch } = useProductionSettings(); 

  const lineData = useMemo(() => {
    if (data && selectedLineName) {
      return data[selectedLineName]; 
    }
    return null;
  }, [data, selectedLineName]);
  
 const handleModelChange = useCallback(async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = event.target.value;
    
    // Panggil fungsi setter dari parent (untuk update state di Dashboard)
    onModelChange(newModel);

    // Kirim request ke backend untuk update database
    try {
      const response = await fetch('/api/pwi-api/update-line-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          line_name: selectedLineName,
          model_name: newModel,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Model updated for ${selectedLineName}: ${newModel}`);
        // Refresh data di hook agar UI update
        refetch();
      } else {
        alert(`❌ Gagal update model: ${result.error || 'Unknown error'}`);
        // Opsional: rollback state jika perlu
        onModelChange(selectedModel); // kembalikan ke sebelumnya
      }

    } catch (err) {
      console.error("🚨 Error updating model:", err);
      alert("Gagal menghubungi server. Silakan coba lagi.");
      onModelChange(selectedModel); // rollback
    }

  }, [selectedLineName, selectedModel, onModelChange, refetch]);



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
          value={selectedModel || 'N/A'}
          onChange={handleModelChange}
          className="font-semibold text-orange-400 p-1 border border-gray-300 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700"
          disabled={!lineData?.model.length}
        >
          {lineData?.model.length === 0 && <option value="N/A">N/A</option>}
          {lineData?.model.map((model) => (
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