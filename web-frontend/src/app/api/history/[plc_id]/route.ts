import { NextResponse } from 'next/server';
import { dbQuery } from '@/app/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ plc_id: string }> }) {
  try {
    const { plc_id } = await params;

    if (!plc_id) {
      return NextResponse.json(
        { message: 'Parameter plc_id wajib disertakan dalam URL.' },
        { status: 400 }
      );
    }

    // ✅ 1. Data hari ini
    const todayQuery = `
      SELECT id, plc_id, tag_name, avg_value, start_time, end_time
      FROM plc_history
      WHERE plc_id = ?
        AND DATE(start_time) = CURDATE()
      ORDER BY start_time ASC
    `;
    const todayData = await dbQuery(todayQuery, [plc_id]);

    // ✅ 2. Data minggu ini (avg, min, max per jam)
    const weekQuery = `
      SELECT 
        tag_name,
        DATE_FORMAT(start_time, '%Y-%m-%d %H:00:00') AS hour_slot,
        AVG(avg_value) AS avg_value,
        MIN(avg_value) AS min_value,
        MAX(avg_value) AS max_value
      FROM plc_history
      WHERE plc_id = ?
        AND start_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY tag_name, hour_slot
      ORDER BY hour_slot ASC
    `;
    const weekData = await dbQuery(weekQuery, [plc_id]);

    // ✅ 3. Data bulan ini (avg, min, max per hari)
    const monthQuery = `
      SELECT
        tag_name,
        DATE(start_time) AS day,
        AVG(avg_value) AS avg_value,
        MIN(avg_value) AS min_value,
        MAX(avg_value) AS max_value
      FROM plc_history
      WHERE plc_id = ?
        AND start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY tag_name, day
      ORDER BY day ASC
    `;
    const monthData = await dbQuery(monthQuery, [plc_id]);

    return NextResponse.json(
      {
        today: todayData,
        this_week: weekData,
        this_month: monthData,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error(`API Error for PLC ID:`, error);
    return NextResponse.json(
      { message: 'Gagal membaca data PLC berdasarkan ID.', error: (error as Error).message },
      { status: 500 }
    );
  }
}
