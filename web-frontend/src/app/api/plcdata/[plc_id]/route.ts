import { NextResponse } from 'next/server';
import { getPlcDataFromLogs } from '@/app/lib/log-reader';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ plc_id: string }> }
) {
  let plc_id: string | undefined;

  try {
    const p = await params;
    plc_id = p.plc_id;

    if (!plc_id) {
      return NextResponse.json(
        { message: 'Parameter plc_id wajib disertakan dalam URL.' },
        { status: 400 }
      );
    }

    // Baca data dari file log (bukan MySQL)
    const data = await getPlcDataFromLogs(plc_id, 500);

    return NextResponse.json({
      status: 200,
      total_data: data.length,
      plc_id,
      data,
    });
  } catch (error) {
    console.error(`API Error for PLC ID ${plc_id || '<unknown>'}:`, error);
    return NextResponse.json(
      { message: 'Gagal membaca data PLC dari file log.', error: (error as Error).message },
      { status: 500 }
    );
  }
}