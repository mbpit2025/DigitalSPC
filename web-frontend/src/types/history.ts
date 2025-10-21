// src/types/history.ts

export interface HistoryItem {
  id: number;
  plc_id: number;
  tag_name: string;
  avg_value: string; // Tetap string karena itu format dari API
  start_time: string;
  end_time: string;
}

export interface FilterProps {
  plc_id: number;
  tag_names: string[];
}

export interface ChartPoint { 
    x: number; // timestamp (Date.getTime())
    y: number; // avg_value (number)
}