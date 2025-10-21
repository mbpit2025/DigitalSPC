// app/api/settings/route.ts

import { NextResponse } from 'next/server';

// Interface untuk struktur data internal setiap stasiun
interface StationData {
  model: string[];
  target: string;
}

// Interface untuk struktur data keseluruhan (object dengan key string)
interface ResponseData {
  [stationName: string]: StationData;
}

const responseData: ResponseData = {
  "B1-01": {
    "model": [
      // "ML515",
      // "ML574",
      // "U574",
      "WL574"
    ],
    "target": "168"
  },
  "B1-02": {
    "model": [
      // "ME420",
      // "ML610",
      "U204",
      // "WE420",
      // "WL996"
    ],
    "target": "169"
  }
};

/**
 * Handle GET requests untuk menghasilkan data konfigurasi stasiun.
 */
export async function GET() {
  try {
    // Menggunakan NextResponse.json untuk merespon dengan data JSON
    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    console.error("Error generating API response:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}