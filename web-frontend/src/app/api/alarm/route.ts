// app/api/alarms/route.ts
import { NextResponse } from 'next/server';
import { dbQuery } from '@/app/lib/db';

// GET: Mengambil daftar alarm log (untuk tampilan tabel frontend)
export async function GET() {
    try {
        // Mengambil semua log alarm, diurutkan dari yang terbaru
        const sql = `
            SELECT * FROM alarm_log 
            ORDER BY alarm_time DESC
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

// PUT: Memperbarui status alarm (misalnya, Acknowledge)
// export async function PUT(req: Request) {
//     try {
//         const { id, newStatus, acknowledgedBy } = await req.json();

//         if (!id || !newStatus) {
//             return NextResponse.json({ message: "ID alarm dan status baru diperlukan." }, { status: 400 });
//         }
        
//         let updateSql = '';
//         let values: any[] = [];
//         const currentTime = new Date().toISOString().slice(0, 19).replace('T', ' '); // Format MySQL DATETIME

//         if (newStatus === 'ACKNOWLEDGED') {
//             updateSql = `
//                 UPDATE alarm_log 
//                 SET status = 'ACKNOWLEDGED', acknowledged_by = ?, acknowledged_at = ?
//                 WHERE id = ? AND status = 'ACTIVE'
//             `;
//             values = [acknowledgedBy || 'System', currentTime, id];
//         } else if (newStatus === 'RESOLVED') {
//             updateSql = `
//                 UPDATE alarm_log 
//                 SET status = 'RESOLVED', resolved_at = ?
//                 WHERE id = ? AND status IN ('ACTIVE', 'ACKNOWLEDGED')
//             `;
//             values = [currentTime, id];
//         } else {
//             return NextResponse.json({ message: "Status tidak valid." }, { status: 400 });
//         }

//         const result: any = await dbQuery(updateSql, values);
        
//         if (result.affectedRows === 0) {
//              return NextResponse.json({ message: "Alarm tidak ditemukan atau sudah dalam status tersebut." }, { status: 404 });
//         }

//         return NextResponse.json({ message: `Alarm ${id} berhasil diperbarui menjadi ${newStatus}.` }, { status: 200 });

//     } catch (error) {
//         return NextResponse.json(
//             { message: "Gagal memperbarui status alarm", error },
//             { status: 500 }
//         );
//     }
// }