'use client';

import React from 'react';

// 1. Definisikan Interface untuk Struktur Data Histori
interface HistoryItem {
  id: number;
  plc_id: number;
  tag_name: string;
  avg_value: string; // Tipe string karena data dari API dalam format string
  start_time: string;
  end_time: string;
}

// 2. Definisikan Props untuk Komponen
interface HistoryDataProps {
  data: HistoryItem[] | null; // Data bisa berupa array HistoryItem atau null/kosong
}

/**
 * Komponen untuk menampilkan data histori dalam format tabel.
 * @param {HistoryDataProps} props - Props yang berisi array data histori.
 */
const HistoryData: React.FC<HistoryDataProps> = ({ data }) => {
  // Fungsi utilitas untuk memformat waktu
  const formatTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      // Cek jika date objek valid
      if (isNaN(date.getTime())) {
        return isoString;
      }
      
      // Format waktu ke format lokal 24 jam
      return date.toLocaleString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error("Error formatting time:", error);
      return isoString;
    }
  };

  // Cek jika data null atau array kosong
  if (!data || data.length === 0) {
    return (
      <div className="col-span-12 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
        <p className="text-gray-600 dark:text-gray-400">Tidak ada data histori yang ditemukan.</p>
      </div>
    );
  }

  return (
    <div className="col-span-12 p-4 bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
      <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Historical Data Log</h2>
      
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              ID
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Tag Name
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Average Value
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Start Time
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              End Time
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {/* TypeScript memastikan item adalah HistoryItem di sini */}
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition duration-150">
              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                {item.id}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                {item.tag_name}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                {/* Konversi string ke float dan batasi 2 desimal */}
                {parseFloat(item.avg_value).toFixed(2)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                {formatTime(item.start_time)}
              </td>
              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                {formatTime(item.end_time)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HistoryData;