import { NextResponse, NextRequest } from 'next/server';
import { dbQuery, PlcData } from '@/app/lib/db'; // Sesuaikan path

const PAGE_LIMIT = 15; 

/**
 * Route Handler GET untuk mengambil data dari tabel plc_data (15 data berikutnya)
 * Contoh URL: /api/plc-data?offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Ambil parameter offset dan pastikan nilainya valid
    const offsetParam = searchParams.get('offset');
    const offset = Math.max(0, parseInt(offsetParam || '0', 10)); // Pastikan offset >= 0

    // Query untuk mengambil 15 data, diurutkan dari yang terbaru
    const query = `
      SELECT id, plc_id, plc_name, tag_name, value, timestamp 
      FROM plc_data WHERE plc_name = "BPM_LINE_1"
      ORDER BY timestamp DESC, id DESC 
    `;
    
    // Gunakan fungsi dbQuery dengan tipe PlcData untuk hasil yang aman
    const results = await dbQuery<PlcData>(query, [PAGE_LIMIT, offset]);

    // Mengembalikan data sebagai JSON response
    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error("API Error:", error);
    // Mengembalikan pesan error yang jelas ke client
    return NextResponse.json(
      { message: 'Gagal membaca data PLC.', error: (error as Error).message },
      { status: 500 }
    );
  }
}