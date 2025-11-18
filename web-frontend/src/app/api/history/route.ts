import { NextResponse } from 'next/server';
import { dbQuery, PlcData } from '@/app/lib/db'; // Sesuaikan path

export async function GET() {
  try {

    const query = `
      SELECT id, plc_id, tag_name, avg_value, start_time, end_time 
      FROM plc_history  
      ORDER BY start_time ASC
    `;
    const results = await dbQuery<PlcData>(query);
    return NextResponse.json(results, { status: 200 });

  } catch (error) {
    console.error(`API Error for PLC ID:`, error);
    return NextResponse.json(
      { message: 'Gagal membaca data PLC berdasarkan ID.', error: (error as Error).message },
      { status: 500 }
    );
  }
}
