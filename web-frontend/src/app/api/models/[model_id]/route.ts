import { NextResponse } from 'next/server';
import { dbQuery } from '@/app/lib/db'; 

// --- Konfigurasi dan Interfaces yang Diperlukan ---
// Diambil dari api/model/route.ts untuk konsistensi
const DEFAULT_MODEL_ID = 5; 

interface PostBody {
    model_name: string;
}

interface UpdateResult {
    affectedRows?: number; // Digunakan oleh MySQL/MariaDB
    rowCount?: number;    // Digunakan oleh PostgreSQL (untuk hasil UPDATE/DELETE)
}

// ---------------------------------------------------------------------
// GET (Opsional: Mengambil detail model tunggal)
// ---------------------------------------------------------------------
// Meskipun fokus utamanya adalah PATCH/DELETE, menyediakan GET untuk detail ID adalah praktik yang baik.
export async function GET(req: Request, { params }: { params: Promise<{ model_id: string }> }) {
    
    const {model_id} = await params;
    const modelId = parseInt(model_id, 10);

    if (isNaN(modelId) || modelId <= 0) {
        return NextResponse.json({ message: "ID model tidak valid." }, { status: 400 });
    }

    try {
        const sql = `
            SELECT model_id, model_name, created_at, updated_at 
            FROM model 
            WHERE model_id = ?
        `;
        
        const results = await dbQuery(sql, [modelId]);
        
        if (results.length === 0) {
            return NextResponse.json({ message: "Model tidak ditemukan." }, { status: 404 });
        }

        return NextResponse.json(results[0], { status: 200 });

    } catch (error) {
        console.error(`Error retrieving model ${modelId}:`, error);
        return NextResponse.json(
            { message: "Gagal mengambil detail model", error: String(error) },
            { status: 500 }
        );
    }
}


// ---------------------------------------------------------------------
// PATCH (atau PUT): Mengubah nama model
// ---------------------------------------------------------------------
export async function PATCH(req: Request, { params }: { params: Promise<{ model_id: string }> }) {
    
    const {model_id} = await params;
    const modelId = parseInt(model_id, 10);

    try {
        const { model_name }: PostBody = await req.json();

        // 1. Validasi ID dan Input Nama
        if (isNaN(modelId) || modelId <= 0) {
            return NextResponse.json({ message: "ID model tidak valid." }, { status: 400 });
        }
        if (!model_name || typeof model_name !== 'string' || model_name.trim().length === 0) {
            return NextResponse.json({ message: "Nama model baru diperlukan dan harus berupa string valid." }, { status: 400 });
        }
        
        const cleanedModelName = model_name.trim().toUpperCase();

        // Pencegahan: Melarang modifikasi Model Default
        if (modelId === DEFAULT_MODEL_ID) {
             return NextResponse.json(
                { message: `Model ID ${DEFAULT_MODEL_ID} adalah model default standard dan tidak dapat diubah.` }, 
                { status: 403 } // 403 Forbidden
            );
        }

        // 2. Pemeriksaan Duplikasi (Tidak boleh sama dengan nama model lain yang sudah ada)
        const checkSql = "SELECT model_id FROM model WHERE model_name = ? AND model_id != ?";
        const existingModel = await dbQuery(checkSql, [cleanedModelName, modelId]); 

        if (existingModel && existingModel.length > 0) {
            return NextResponse.json(
                { message: `Nama model ${cleanedModelName} sudah digunakan oleh model lain.` }, 
                { status: 409 } // 409 Conflict
            );
        }

        // 3. Eksekusi Query UPDATE
        const updateModelSql = `
            UPDATE model 
            SET model_name = ?, updated_at = ? 
            WHERE model_id = ?
        `;
        const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' '); 
        const updateValues = [cleanedModelName, currentTime, modelId];

        // dbQuery mengembalikan objek metadata (bukan array data)
        const modelResult = await dbQuery(updateModelSql, updateValues); 
        const result: UpdateResult = modelResult as UpdateResult;

        const affectedRows = result.affectedRows ?? result.rowCount;
        
        if (affectedRows === 0) {
             // 404 jika ID model ada tapi tidak ada baris yang diubah (mungkin ID tidak ada)
             return NextResponse.json({ message: `Model ID ${modelId} tidak ditemukan atau tidak ada perubahan nama.` }, { status: 404 });
        }
        
        // 4. Respon Sukses
        return NextResponse.json(
            { message: `Model ID ${modelId} berhasil diperbarui dengan nama ${cleanedModelName}.` }, 
            { status: 200 } // 200 OK
        );

    } catch (error) {
        console.error(`Error saat memperbarui Model ID ${modelId}:`, error);
        
        // 5. Penanganan Error Umum
        return NextResponse.json(
            { message: "Gagal memperbarui Model karena kesalahan server.", error: String(error) },
            { status: 500 }
        );
    }
}


// ---------------------------------------------------------------------
// DELETE: Menghapus model berdasarkan ID
// ---------------------------------------------------------------------
export async function DELETE(req: Request, { params }: { params: Promise<{ model_id: string }>}) {
    const {model_id} = await params;
    const modelId = parseInt(model_id, 10);

    try {
        // 1. Validasi ID
        if (isNaN(modelId) || modelId <= 0) {
            return NextResponse.json({ message: "ID model tidak valid." }, { status: 400 });
        }
        
        // Pencegahan: Melarang penghapusan Model Default
        if (modelId === DEFAULT_MODEL_ID) {
             return NextResponse.json(
                { message: `Model ID ${DEFAULT_MODEL_ID} adalah model default standard dan tidak dapat dihapus.` }, 
                { status: 403 } // 403 Forbidden
            );
        }
        
        // 2. Penghapusan Data Terkait (jika tidak menggunakan ON DELETE CASCADE)
        // ASUMSI: Tabel 'standard' memiliki relasi ke 'model' melalui model_id.
        // Jika skema database menggunakan FOREIGN KEY dengan ON DELETE CASCADE, query ini tidak diperlukan.
        // Namun, jika tidak ada ON DELETE CASCADE, kita harus menghapus data terkait terlebih dahulu:
        const deleteStandardSql = `DELETE FROM standard WHERE model_id = ?`;
        await dbQuery(deleteStandardSql, [modelId]);
        
        // 3. Eksekusi Query DELETE Model
        const deleteModelSql = `DELETE FROM model WHERE model_id = ?`;
        
        const modelResult = await dbQuery(deleteModelSql, [modelId]);
        const result: UpdateResult = modelResult as UpdateResult;
        
        const affectedRows = result.affectedRows ?? result.rowCount;
        
        if (affectedRows === 0) {
            // 404 jika tidak ada baris yang terhapus (ID tidak ditemukan)
            return NextResponse.json({ message: `Model ID ${modelId} tidak ditemukan.` }, { status: 404 });
        }
        
        // 4. Respon Sukses
        return NextResponse.json(
            { message: `Model ID ${modelId} dan semua nilai standard terkait berhasil dihapus.` }, 
            { status: 200 } // 200 OK (atau 204 No Content, tapi 200 dengan body lebih informatif)
        );

    } catch (error) {
        console.error(`Error saat menghapus Model ID ${modelId}:`, error);
        
        // 5. Penanganan Error Umum
        return NextResponse.json(
            { message: "Gagal menghapus Model karena kesalahan server.", error: String(error) },
            { status: 500 }
        );
    }
}

