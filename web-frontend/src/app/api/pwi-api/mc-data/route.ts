import { NextResponse } from 'next/server';

// Interface untuk data point mentah dari API eksternal
interface DataPWI {
    plc_id: number;
    plc_name: string;
    tagname: string;
    pressure: string; 
    time: string; 
    counter: number
}

// Interface untuk Response Data
interface ResponseData {
    data: DataPWI[]
}

// Fungsi untuk membuat response error/kosong secara konsisten
const createEmptyResponse = (status: number = 200, logMessage: string): NextResponse<ResponseData> => {
    console.warn(logMessage);
    return NextResponse.json({ data: [] }, { status });
}

const isDataValid = (data: DataPWI[]): boolean => {
    if (!Array.isArray(data) || data.length === 0) {
        return false;
    }
    
    // Memastikan setidaknya ada satu nilai pressure yang bukan '0' atau null/undefined setelah konversi
    const hasNonZeroValue = data.some(entry => parseFloat(entry.pressure) !== 0);
    
    return hasNonZeroValue;
};

/**
 * Mengelompokkan data berdasarkan 'tagname' dan mengambil entri dengan timestamp 'time' terbaru untuk setiap tag.
 * @param data Array DataPWI mentah (raw data).
 * @returns Array DataPWI yang hanya berisi entri terbaru untuk setiap tag.
 */
const getLatestDataByTag = (data: DataPWI[]): DataPWI[] => {
    // Menggunakan Map untuk menyimpan entri terbaru untuk setiap tagname
    const latestDataMap = new Map<string, DataPWI>();

    for (const entry of data) {
        const tagName = entry.tagname;
        const existingEntry = latestDataMap.get(tagName);

        // Jika belum ada data untuk tag ini, atau jika data saat ini lebih baru
        if (!existingEntry || entry.time > existingEntry.time) {
            latestDataMap.set(tagName, entry);
        }
    }

    // Mengubah Map kembali menjadi array
    return Array.from(latestDataMap.values());
};


export async function GET(request: Request): Promise<NextResponse<ResponseData | { error: string }>> {
    
    const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL + "/api/get_pressure_data";
    try {
        // Ambil parameter 'mode' dari URL
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode');

        // 1. Ambil Data dari API Eksternal (tanpa cache)
        const res = await fetch(API_URL, {
            cache: "no-store", 
        });

        if (!res.ok) {
            // KASUS 1: External API mengembalikan status HTTP error (misal 404, 500)
            return createEmptyResponse(
                502, // Menggunakan 502 Bad Gateway atau 200. Memilih 502 untuk menunjukkan kegagalan hulu.
                `External API error: HTTP ${res.status}. Returning empty data.`
            );
        }

        // Terapkan type assertion langsung ke DataPWI[] sesuai format API
        const result = await res.json();
        
        const rawData: DataPWI[] = Array.isArray(result) ? result as DataPWI[] : [];
        
        console.log("Jumlah entri rawData:", rawData.length);
        
        // 2. Validasi Data Mentah
        if (!isDataValid(rawData)) {
            // KASUS 2: Data valid secara struktur, tetapi kosong/tidak ada nilai pressure valid
            return createEmptyResponse(200, "API PWI: Data mentah tidak valid (kosong atau semua nol). Returning empty data.");
        }

        let responseData: DataPWI[];

        // 3. Tentukan Mode Respon
        if (mode === 'all') {
            // Jika mode=all, kirimkan semua data mentah
            responseData = rawData;
        } else {
            // Default atau mode=latest, filter hanya data terakhir untuk setiap tagname
            responseData = getLatestDataByTag(rawData);
        }

        // 4. Kirim Data yang Sudah Diproses
        return NextResponse.json({ data: responseData }, { status: 200 });

    } catch (error) {
        // KASUS 3: Error fetch (misalnya, jaringan down) atau error pemrosesan JSON
        console.error("Error fetching or processing PWI data (Returning empty data):", error);
        
        // Mengembalikan data kosong (data: []) dengan status 200 atau 500
        return NextResponse.json({ data: [] }, { status: 500 });
    }
}