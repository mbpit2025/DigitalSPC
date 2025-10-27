import { NextResponse } from "next/server";
import { dbQuery } from "@/app/lib/db"; // Asumsi dbQuery tersedia


// Mengambil model dari path parameter (misalnya: /api/models/U300/standards)
export async function GET( request : Request, { params }: { params: Promise<{ model: string }> }) {
    const {model} = await params;
    const modelName = model;
    
    // Cek jika model name tidak ada
    if (!modelName) {
        return NextResponse.json(
            { message: "Nama model tidak ditemukan di parameter URL." },
            { status: 400 }
        );
    }

    try {
        // SQL: Mengambil semua standar untuk model tertentu
        const sql = `
            SELECT parameter_name, min_value, max_value 
            FROM v_all_model_standards 
            WHERE model_name = ?
        `;
        const value = [modelName];
        
        const rawData = await dbQuery(sql, value);
        
        // Kembalikan objek limit, bukan objek berlevel dua
        return NextResponse.json({model : modelName, data: rawData}, { status: 200 });

    } catch (error) {
        console.error("Database error:", error);
        return NextResponse.json(
            { message: "Gagal mengambil daftar Standard dari database.", error: (error as Error).message },
            { status: 500 }
        );
    }
}
