// app/api/model/route.ts
import { NextResponse } from 'next/server';
import { dbQuery } from '@/app/lib/db';

interface ModelRecord {
    model_id: number;
    model_name: string;
    created_at: string;
    updated_at: string;
}

// GET: Mengambil daftar alarm log (untuk tampilan tabel frontend)
export async function GET() {
    try {
        // Mengambil semua log alarm, diurutkan dari yang terbaru
        const sql = `
            SELECT * FROM model 
            ORDER BY model_id DESC
        `;
        
        const results = await dbQuery(sql);
        
        return NextResponse.json(results, { status: 200 });

    } catch (error) {
        return NextResponse.json(
            { message: "Gagal mengambil daftar alarm", error },
            { status: 500 }
        );
    }
}


export async function POST(req: Request) {
    try {
        const { model_name } = await req.json();
        console.log(model_name)

        if (!model_name) {
            return NextResponse.json({ message: "Nama model diperlukan." }, { status: 400 });
        }

        const sql = `
            INSERT INTO model (model_name, created_at, updated_at)
            VALUES (?, ?, ?)
        `;
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format MySQL DATETIME
        const values = [model_name, currentTime, currentTime];

        const result: ModelRecord[] = await dbQuery(sql, values);

        return NextResponse.json({ message: `Model ${model_name} berhasil dibuat.`, id: result[0].model_id }, { status: 201 });

    } catch (error) {
        return NextResponse.json(
            { message: "Gagal Menambahkan Model baru", error },
            { status: 500 }
        );
    }
}