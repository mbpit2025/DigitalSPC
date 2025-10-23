import { NextResponse } from 'next/server';
import { dbQuery, PlcData } from '@/app/lib/db'; // Sesuaikan path

export async function GET(request: Request, {params} : {params : Promise<{ plc_id : string}>}) {
  try {
    // 1. Ambil nilai plc_id dari parameter path URL
    const { plc_id } = await params;

    if (!plc_id) {
        return NextResponse.json(
            { message: 'Parameter plc_id wajib disertakan dalam URL.' },
            { status: 400 }
        );
    }

    // 2. Query untuk mengambil SEMUA data, difilter berdasarkan plc_id.
    // LIMIT dan OFFSET dihilangkan karena Anda meminta 'semua data'.
    const query = `
      SELECT id, plc_id, plc_name, tag_name, value, timestamp 
      FROM plc_data  
      ORDER BY timestamp ASC
    `;
    
    // Nilai plc_id dimasukkan sebagai prepared statement value untuk keamanan
    const values = [plc_id];
    
    // Gunakan fungsi dbQuery untuk hasil yang aman dan bertipe
    const results = await dbQuery<PlcData>(query, values);

    // Mengembalikan data sebagai JSON response
    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error(`API Error for PLC ID:`, error);
    // Mengembalikan pesan error yang jelas ke client
    return NextResponse.json(
      { message: 'Gagal membaca data PLC berdasarkan ID.', error: (error as Error).message },
      { status: 500 }
    );
  }
}
