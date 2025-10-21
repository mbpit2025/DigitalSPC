// src/types/production-standards.ts

export interface StandardLimit {
    HOT_TEMP_MIN: number;
    HOT_TEMP_MAX: number;
    COLD_TEMP_MIN: number;
    COLD_TEMP_MAX: number;
    PR_UP_TEMP_MAX: number;
    PR_UP_TEMP_MIN: number;
    PR_OT_TEMP_MAX: number;
    PR_OT_TEMP_MIN: number;
    PM1_UP_TEMP_MAX: number;
    PM1_UP_TEMP_MIN: number;
    PM1_OT_TEMP_MAX: number;
    PM1_OT_TEMP_MIN: number;
    PM2_UP_TEMP_MAX: number;
    PM2_UP_TEMP_MIN: number;
    PM2_OT_TEMP_MAX: number;
    PM2_OT_TEMP_MIN: number;
    CM_UP_TEMP_MAX: number;
    CM_UP_TEMP_MIN: number; 
    CM_OT_TEMP_MAX: number;
    CM_OT_TEMP_MIN: number;
    CH_UP_TEMP_MAX: number;
    CH_UP_TEMP_MIN: number; 
    CH_OT_TEMP_MAX: number; // Ini adalah kesalahan penamaan di data Anda, seharusnya CH_OT_TEMP_MAX
    CH_OT_TEMP_MIN: number;
    GM_PRESS_MAX: number;
    GM_PRESS_MIN: number; 
    GM_TIME_MAX: number;
    GM_TIME_MIN: number;
    UP_PRESSURE_MAX: number;
    UP_PRESSURE_MIN: number;
    UP_TIME_MAX: number;
    UP_TIME_MIN: number;
}

export interface StandardsData {
    [modelId: string]: StandardLimit;
}

// Tambahkan definisi CardProps jika diperlukan, atau hapus jika tidak digunakan
export interface CardProps {
    selectedCell: string;
    selectedModel: string;
    title: string;
}