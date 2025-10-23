import { NextResponse } from 'next/server';
import { dbQuery, PlcData } from '@/app/lib/db'; // Sesuaikan path


export async function GET() {
  try {

    const query = `
          SELECT
              t1.*
          FROM
              plc_data AS t1
          INNER JOIN (
              SELECT
                  plc_id,
                  tag_name,
                  MAX(timestamp) AS max_timestamp
              FROM
                  plc_data
              GROUP BY
                  plc_id,
                  tag_name
          ) AS t2 ON t1.plc_id = t2.plc_id AND t1.tag_name = t2.tag_name AND t1.timestamp = t2.max_timestamp
    `;
    
    // Gunakan fungsi dbQuery untuk hasil yang aman dan bertipe
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