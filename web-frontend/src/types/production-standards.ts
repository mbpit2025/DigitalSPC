// src/types/production-standards.ts

/**
 * Mendefinisikan batas (MIN/MAX) untuk satu parameter mesin.
 * Semua nilai adalah number.
 */
export interface MachineStandardLimits {
    // === Back Part Molding (BPM) ===
    HOT_TEMP_MIN: number;
    HOT_TEMP_MAX: number;
    COLD_TEMP_MIN: number;
    COLD_TEMP_MAX: number;

    // === Pre Heating (PR) ===
    PR_UP_TEMP_MAX: number;
    PR_UP_TEMP_MIN: number;
    PR_OT_TEMP_MAX: number;
    PR_OT_TEMP_MIN: number;

    // === Primer 1 (PM1) ===
    PM1_UP_TEMP_MAX: number;
    PM1_UP_TEMP_MIN: number;
    PM1_OT_TEMP_MAX: number;
    PM1_OT_TEMP_MIN: number;

    // === Primer 2 (PM2) ===
    PM2_UP_TEMP_MAX: number;
    PM2_UP_TEMP_MIN: number;
    PM2_OT_TEMP_MAX: number;
    PM2_OT_TEMP_MIN: number;

    // === Cementing (CM) ===
    CM_UP_TEMP_MAX: number;
    CM_UP_TEMP_MIN: number;
    CM_OT_TEMP_MAX: number;
    CM_OT_TEMP_MIN: number;

    // === Chiller (CH) - Mencakup Suhu (UP) dan Tekanan/Lainnya (OT) ===
    CH_UP_TEMP_MAX: number;
    CH_UP_TEMP_MIN: number;
    // Asumsi CH_OT_MAX_MAX adalah tekanan atau flow maksimum
    CH_OT_TEMP_MAX: number; 
    CH_OT_TEMP_MIN: number;

    // === Gauge Meter (GM) - Mencakup Tekanan (PRESS) dan Waktu (TIME) ===
    GM_PRESS_MAX: number;
    GM_PRESS_MIN: number;
    GM_TIME_MAX: number;
    GM_TIME_MIN: number;

    // === Universal Press (UP) - Mencakup Tekanan (PRESSURE) dan Waktu (TIME) ===
    UP_PRESSURE_MAX: number;
    UP_PRESSURE_MIN: number;
    UP_TIME_MAX: number;
    UP_TIME_MIN: number;
}

/**
 * Mendefinisikan struktur utama untuk mengimpor data standar dari file JSON.
 * Key adalah nama Model (string), dan value-nya adalah MachineStandardLimits.
 */
export interface ProductionStandards {
    [key: string]: MachineStandardLimits;
}

export interface CardProps {
    selectedCell: 'B1-01' | 'B1-02';
    selectedModel: string | null;
    title : string
}

export interface DataPoint {
  plc_id: string;
  plc_name: string;
  tag_name: string;
  value: number;
  timestamp: string;
}

// Data point tunggal untuk chart
export interface ChartDataPoint {
    x: number; // Timestamp
    y: number; // Nilai
}

// Struktur data yang dikirim ke komponen chart
export interface ChartDataProps {
    title: string;
    unit: string;
    series: {
        name: string;
        data: ChartDataPoint[];
    }[];
    minLimit: number;
    maxLimit: number;
}

