import { NextResponse } from 'next/server';
import { dbQuery, PlcData } from '@/app/lib/db'; // Sesuaikan path


export async function GET() {
  try {

    const query = `
          SELECT * FROM v_latest_plc_data
    `;
    
    const results = await dbQuery<PlcData>(query);

    // Mengembalikan data sebagai JSON response
    return NextResponse.json({ status: 200, total_data: results.length, latestData: results });

  } catch (error) {
    console.error(`API Error for PLC ID:`, error);
    // Mengembalikan pesan error yang jelas ke client
    return NextResponse.json(
      { message: 'Gagal membaca data PLC berdasarkan ID.', error: (error as Error).message },
      { status: 500 }
    );
  }
}