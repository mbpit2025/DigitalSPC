"use client";
import React from 'react';

interface ChartTabProps {
  activeRange: 'today' | '7d' | '30d';
  onRangeChange: (range: 'today' | '7d' | '30d') => void;
}

const timeRanges = [
  { id: 'today', label: 'Hari Ini' },
  { id: '7d', label: '7 Hari' },
  { id: '30d', label: '30 Hari' },
];

export default function ChartTab({ activeRange, onRangeChange }: ChartTabProps) {
  return (
    <div className="flex rounded-md shadow-sm" role="group">
      {timeRanges.map(({id, label}) => (
        <button
          key={id}
          type="button"
          onClick={() => onRangeChange(id as 'today' | '7d' | '30d')}
          className={`
            px-4 py-2 text-sm font-medium transition-colors duration-200 
            ${activeRange === id
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
            }
            ${id === 'today' ? 'rounded-l-lg' : ''}
            ${id === '30d' ? 'rounded-r-lg' : ''}
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
