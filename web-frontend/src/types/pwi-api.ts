// types.ts

export interface DataEntry {
  plc_id: number;
  plc_name: string;
  tagname: string;
  pressure: string; // Keep as string if raw data is string
  time: string;
  count: number;
}

// Data yang telah diproses untuk tampilan log atau chart
export interface LogData extends DataEntry {
  pressureValue: number; // Konversi pressure ke number di utilitas
  timestamp: Date;       // Konversi time ke Date object
}

// Data terakhir/real-time, dikelompokkan berdasarkan tagname
export interface RealtimeData {
  [tagname: string]: LogData;
}

// Struktur data konteks
export interface DataContextType {
  logData: LogData[];
  realtimeData: RealtimeData;
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
}