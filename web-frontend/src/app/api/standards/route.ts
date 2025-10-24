import { NextResponse } from "next/server";
import { dbQuery } from "@/app/lib/db";

interface StandardRecord {
    model_name: string;
    parameter_name: string;
    min_value: number;
    max_value: number;
}

export async function GET() {
    try {
        // Mengambil semua log alarm, diurutkan dari yang terbaru
        const sql = `
            SELECT * FROM v_all_model_standards
        `;
        
        const rawData = await dbQuery(sql);
        const finalStandards: Record<string, Record<string, number>> = {};

        (rawData as StandardRecord[]).forEach((row) => {
            const { model_name, parameter_name, min_value, max_value } = row;

            if (!finalStandards[model_name]) {
                // Inisialisasi model jika belum ada
                finalStandards[model_name] = {};
            }
        
        finalStandards[model_name][`${parameter_name}_MIN`] = parseFloat(String(min_value));
        finalStandards[model_name][`${parameter_name}_MAX`] = parseFloat(String(max_value));
    });
       
        return NextResponse.json(finalStandards, { status: 200 });

    } catch (error) {
        return NextResponse.json(
            { message: "Gagal mengambil daftar alarm", error },
            { status: 500 }
        );
    }
}
