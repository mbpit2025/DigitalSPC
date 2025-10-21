export interface CellConfig {
  plcId: string;
  upper: string;
  outsole: string;
}

export interface ApiDataItem {
  tag_name: string;
  value: number;
  timestamp: string;
}

export interface ChartPoint {
  x: number;
  y: number;
}
export interface DataHistory {
  [tagName: string]: ChartPoint[];
}

export const COLORS: { [key: string]: string } = {
//hot//
"data4": 'rgb(255, 50, 50)',   // Merah
"data5": 'rgb(255, 100, 0)',  // Oranye Merah
"data6": 'rgb(255, 150, 0)',  // Oranye
"data7": 'rgb(255, 200, 0)',  // Oranye Kuning

//cold//
"data2": 'rgb(0, 100, 200)',  // Biru Tua
"data3": 'rgb(0, 150, 150)',  // Biru-Hijau Laut
"data8": 'rgb(0, 200, 100)',  // Hijau Mint
"data9": 'rgb(0, 255, 0)',    // Hijau Cerah 
};

export interface LineAnnotation {
      type: 'line';
      yMin: number;
      yMax: number;
      borderColor: string;
      borderWidth: number;
      borderDash: number[];
      label: {
          content: string;
          position: 'start' | 'end';
          backgroundColor: string;
          color: string;
          font: { weight: 'bold' };
      };
  }

export const POLLING_INTERVAL = 15000;
export const HISTORY_LIMIT = 50;