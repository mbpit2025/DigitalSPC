import { NextResponse } from 'next/server';
import { dbQuery } from '@/app/lib/db'; 
interface AlarmLogEntry {
  id: number;
  plc_id: string;
  tag_name: string;
  alarm_type: 'HIGH' | 'LOW' ; 
  violated_value: number;
  treshold_value: number;
  alarm_time: string; 
  status: 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED';
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  is_active: 0 | 1; 
}

export async function GET() {
  try {

    const query = `
          SELECT * FROM alarm_log WHERE DATE(alarm_time) = CURRENT_DATE ORDER BY alarm_time DESC
    `;
    
    const results = await dbQuery<AlarmLogEntry>(query);

    return NextResponse.json({ status: 200, total_data: results.length, data: results });

  } catch (error) {
    console.error(`API Error for Alarm Log:`, error);
    return NextResponse.json(
      { message: 'Gagal membaca data Alarm', error: (error as Error).message },
      { status: 500 }
    );
  }
}