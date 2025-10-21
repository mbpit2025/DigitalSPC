// app/some-page/page.tsx atau components/SettingsDisplay.tsx

"use client"; // Penting jika menggunakan App Router Next.js

import { useProductionSettings } from '@/hooks/useProductionSettings'; // Sesuaikan path

export default function ProductionDashboard() {
  // Panggil hook. Secara default akan memanggil /api/settings
  const { 
    productionLines, 
    uniqueModels, 
    loading, 
    error 
  } = useProductionSettings(); 

  if (loading) {
    return <p>Loading konfigurasi...</p>;
  }

  if (error) {
    return <p className="text-red-500">Error: Gagal memuat data settings. ({error.message})</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Ringkasan Produksi</h1>
      
      {/* Menampilkan Daftar Line Produksi */}
      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold text-blue-700">Line Produksi Ditemukan</h2>
        <ul className="list-disc pl-5">
          <ul className="list-disc pl-5">
            {productionLines.map(line => (
                      <li key={line.lineName}>
                          Line: **{line.lineName}** | Target: **{line.target}**
                      </li>
            ))}
          </ul>
        </ul>
        <p className="mt-2 text-sm text-gray-600">Total Line: {productionLines.length}</p>
      </div>

      {/* Menampilkan Daftar Model Sepatu */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold text-green-700">Daftar Model Unik</h2>
        <div className="flex flex-wrap gap-2">
          {uniqueModels.map(model => (
            <span 
              key={model} 
              className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
            >
              {model}
            </span>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-600">Total Model Unik: {uniqueModels.length}</p>
      </div>
    </div>
  );
}