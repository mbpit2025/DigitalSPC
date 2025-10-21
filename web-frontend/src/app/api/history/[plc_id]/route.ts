import { NextResponse } from 'next/server';
import { dbQuery, PlcData } from '@/app/lib/db'; // Sesuaikan path

export async function GET(request: Request, {params} : {params : Promise<{ plc_id : string}>}) {
  try {
    const { plc_id } = await params;
    console.log(plc_id)

    if (!plc_id) {
        return NextResponse.json(
            { message: 'Parameter plc_id wajib disertakan dalam URL.' },
            { status: 400 }

        );
    }

    const query = `
      SELECT id, plc_id, tag_name, avg_value, start_time, end_time 
      FROM plc_history 
      WHERE plc_id = ? 
      ORDER BY start_time ASC
    `;
    
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
