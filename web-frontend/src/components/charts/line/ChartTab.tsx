"use client";
import React from 'react';

// Definisikan tipe props yang akan diterima
interface ChartTabProps {
    activeRange: 'today' | '7d' | '30d';
    onRangeChange: (range: 'today' | '7d' | '30d') => void;
}

const timeRanges = [
  { id: 'today', label: 'Hari Ini' },
  { id: '7d', label: '7 Hari' },
  { id: '30d', label: '30 Hari' },
];

/**
 * Komponen ChartTab berfungsi sebagai pengubah jangka waktu (time range selector).
 */
export default function ChartTab({ activeRange, onRangeChange }: ChartTabProps) {

  return (
    <div className="flex rounded-md shadow-sm" role="group">
      {timeRanges.map((range) => (
        <button
          key={range.id}
          type="button"
          onClick={() => onRangeChange(range.id as 'today' | '7d' | '30d')}
          // Styling untuk menentukan tombol yang aktif vs. tidak aktif
          className={`
            px-4 py-2 text-sm font-medium transition-colors duration-200 
            ${activeRange === range.id
              ? 'bg-blue-600 text-white shadow-md' // Style untuk tombol aktif
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600' // Style untuk tombol tidak aktif
            }
            ${range.id === 'today' ? 'rounded-l-lg' : ''}
            ${range.id === '30d' ? 'rounded-r-lg' : ''}
          `}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}