// 📁 src/types/standards.ts
export type StandardLimit = { [key: string]: number };
export type StandardsData = Record<string, StandardLimit>; // Contoh: { "U204": { "HOT_TEMP_MIN": 80, ... } }
export type ModelOption = { label: string; value: string };