import { NextResponse } from 'next/server';
import { dbQuery } from '@/app/lib/db'; // Asumsi path ke fungsi dbQuery Anda

// --- Konfigurasi ---
// Asumsi ID model DEFAULT adalah 1 (berdasarkan request dan data gambar)
const DEFAULT_MODEL_ID = 5; 

// --- Interfaces ---
interface ModelRecord {
    model_id: number;
    model_name: string;
    created_at: string;
    updated_at: string;
}

interface PostBody {
    model_name: string;
}

interface InsertResult {
    insertId?: number; // Digunakan oleh MySQL/MariaDB
    rowCount?: number; // Digunakan oleh PostgreSQL (untuk hasil INSERT)
}

// ---------------------------------------------------------------------
// GET: Mengambil daftar model
// ---------------------------------------------------------------------
export async function GET() {
    try {
        const sql = `
            SELECT * FROM model 
            ORDER BY model_id DESC
        `;
        
        const results = await dbQuery(sql);
        
        return NextResponse.json(results, { status: 200 });

    } catch (error) {
        console.error("Error retrieving models:", error);
        return NextResponse.json(
            { message: "Gagal mengambil daftar model", error: String(error) },
            { status: 500 }
        );
    }
}


// ---------------------------------------------------------------------
// POST: Membuat Model baru dan menyalin nilai standard default
// ---------------------------------------------------------------------
export async function POST(req: Request) {
    try {
        const { model_name }: PostBody = await req.json();
        
        // 1. Validasi Input
        if (!model_name || typeof model_name !== 'string' || model_name.trim().length === 0) {
            return NextResponse.json({ message: "Nama model diperlukan dan harus berupa string valid." }, { status: 400 });
        }
        
        const cleanedModelName = model_name.trim().toUpperCase();

        // 2. Pemeriksaan Duplikasi
        const checkSql = "SELECT model_id FROM model WHERE model_name = ?";
        // dbQuery mengembalikan array hasil untuk SELECT
        const existingModel: ModelRecord[] = await dbQuery(checkSql, [cleanedModelName]); 

        if (existingModel && existingModel.length > 0) {
            console.warn(`Attempted to create duplicate model: ${cleanedModelName}`);
            // Mengembalikan status 409 Conflict
            return NextResponse.json({ message: `Model ${cleanedModelName} sudah ada dalam database.` }, { status: 409 });
        }

        // 3. Eksekusi Query INSERT Model Baru
        const insertModelSql = `
            INSERT INTO model (model_name, created_at, updated_at)
            VALUES (?, ?, ?)
        `;
        // Format waktu untuk MySQL DATETIME
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' '); 
        const modelValues = [cleanedModelName, currentTime, currentTime];

        // dbQuery untuk INSERT mengembalikan objek metadata (bukan array data)
        const modelResult: ModelRecord[] = await dbQuery(insertModelSql, modelValues); 
        const result: InsertResult = modelResult as InsertResult;

        const newModelId = result.insertId || null; 
        
        if (!newModelId) {
            // Penanganan jika ID tidak berhasil didapatkan (e.g. masalah koneksi/skema)
            throw new Error("Gagal mendapatkan ID setelah memasukkan model baru. Operasi INSERT mungkin gagal.");
        }
        
        // 4. COPY Standard Value dari Model DEFAULT ke Model Baru (Tabel standard)
        const copyStandardSql = `
            INSERT INTO standard (model_id, parameter_name, min_value, max_value)
            SELECT 
                ?,                 -- [1] ID Model Baru
                parameter_name, 
                min_value, 
                max_value
            FROM 
                standard
            WHERE 
                model_id = ?;      -- [2] ID Model Default (Sumber)
        `;
        const copyValues = [newModelId, DEFAULT_MODEL_ID];
        
        await dbQuery(copyStandardSql, copyValues); // Eksekusi query copy

        // 5. Respon Sukses
        return NextResponse.json(
            { 
                message: `Model ${cleanedModelName} berhasil dibuat (ID: ${newModelId}) dan nilai standard default telah disalin.`, 
                id: newModelId 
            }, 
            { status: 201 } // 201 Created
        );

    } catch (error) {
        console.error("Error saat menambahkan Model baru dan menyalin standard:", error);
        
        // 6. Penanganan Error Umum
        return NextResponse.json(
            { message: "Gagal menambahkan Model baru karena kesalahan server.", error: String(error) },
            { status: 500 }
        );
    }
}
