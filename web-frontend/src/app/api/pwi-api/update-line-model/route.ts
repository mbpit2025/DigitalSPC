import { NextResponse } from 'next/server';
import { dbQuery } from '@/app/lib/db';

// --- Types ---
interface ModelRow {
  model_id: number;
  model_name: string;
}

interface LineModelStatusRow {
  line_name: string;
  model_id: number;
  model_name: string;
  status: string;
  start_time: string;
  updated_at: string;
}

// --- POST Request Body ---
interface UpdateLineModelRequestBody {
  line_name: string;
  model_name: string;
}

// --- GET Response Structure ---
interface GetLineModelResponse {
  models: { model_id: number; model_name: string }[];
  activeModels: {
    [line_name: string]: {
      model_id: number;
      model_name: string;
      status: string;
      start_time: string;
      updated_at: string;
    };
  };
}

// --------------------------------------------------
// ✅ GET handler: Ambil semua model + model aktif per line
// --------------------------------------------------
export async function GET() {
  try {
    // 1. Ambil semua model
    const models: ModelRow[] = await dbQuery('SELECT model_id, model_name FROM model ORDER BY model_name');

    // 2. Ambil data aktif per line
    const activeLines: LineModelStatusRow[] = await dbQuery(
      'SELECT line_name, model_id, model_name, status, start_time, updated_at FROM line_model_status'
    );

    // 3. Format activeModels sebagai object dengan key = line_name
    const activeModels: GetLineModelResponse['activeModels'] = {};
    for (const row of activeLines) {
      activeModels[row.line_name] = {
        model_id: row.model_id,
        model_name: row.model_name,
        status: row.status,
        start_time: row.start_time,
        updated_at: row.updated_at,
      };
    }

    const response: GetLineModelResponse = {
      models,
      activeModels,
    };

    return NextResponse.json(response);
  } catch (err: unknown) {
    console.error('[API ERROR] GET /update-line-model:', err);
    return NextResponse.json(
      { error: 'Failed to fetch model and line status data' },
      { status: 500 }
    );
  }
}

// --------------------------------------------------
// ✅ POST handler: Update model untuk suatu line
// --------------------------------------------------
export async function POST(req: Request) {
  try {
    const body: UpdateLineModelRequestBody = await req.json();
    const { line_name, model_name } = body;

    if (!line_name || !model_name || typeof line_name !== 'string' || typeof model_name !== 'string') {
      return NextResponse.json(
        { error: 'line_name and model_name are required and must be strings' },
        { status: 400 }
      );
    }

    // 1. Cari model_id
    const modelRows: ModelRow[] = await dbQuery(
      'SELECT model_id FROM model WHERE model_name = ? LIMIT 1',
      [model_name]
    );

    if (modelRows.length === 0) {
      return NextResponse.json(
        { error: `Model "${model_name}" not found` },
        { status: 404 }
      );
    }

    const model_id = modelRows[0].model_id;

    // 2. Update line_model_status
    const updated_at = new Date().toISOString();
    await dbQuery(
      `
        UPDATE line_model_status 
        SET model_id = ?, model_name = ?, updated_at = ?
        WHERE line_name = ?
      `,
      [model_id, model_name, updated_at, line_name]
    );

    console.log(`[API] Updated line ${line_name} to model ${model_name} (ID: ${model_id})`);
    return NextResponse.json({
      success: true,
      message: 'Model updated successfully',
      data: { line_name, model_name, model_id, updated_at },
    });
  } catch (err: unknown) {
    console.error('[API ERROR] POST /update-line-model:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}