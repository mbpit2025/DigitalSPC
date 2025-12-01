import { NextResponse } from "next/server";

// --- 1. Define Interfaces for Type Safety ---

interface DataPoint {
    plc_id: string;
    plc_name: string;
    tag_name: string;
    value: number;
    timestamp: string; // Assuming a timestamp is always present
}

interface Notification {
    message: string;
    level: 'info' | 'warning' | 'error'; // Example properties
    [key: string]: unknown; // Allow other properties, but specify the common ones
}

interface StoredNotification extends Notification {
    timestamp: string; // The timestamp added by the server
}

// --- 2. Use Interfaces for Global State ---
// PERBAIKAN: Mengganti 'any[]' dengan tipe spesifik
let latestData: DataPoint[] = [];
const notifications: StoredNotification[] = [];

// Helper: Ambil nilai plcId dari query, handle multiple (opsional)
function getPlcIdsFromQuery(searchParams: URLSearchParams): string[] | null {
  const plcIdParam = searchParams.get("plcId");
  if (!plcIdParam) return null;

  // Mendukung: ?plcId=1,2,3 atau ?plcId=1
  return plcIdParam.split(",").map(id => id.trim()).filter(id => id.length > 0);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const plcIdFilter = getPlcIdsFromQuery(searchParams);

  let filteredData = latestData;

  if (plcIdFilter) {
    const filterSet = new Set(plcIdFilter);
    filteredData = latestData.filter((item) => filterSet.has(item.plc_id));
  }

  return NextResponse.json({
    latestData: filteredData,
    notifications,
  });
}

export async function POST(req: Request) {
    try {
        // Define the expected structure of the request body
        interface RequestBody {
            latestData?: DataPoint[];
            notification?: Notification;
        }

        const body: RequestBody = await req.json();

        if (body.latestData) {
            // PERBAIKAN: Type assertion is not needed as body is already typed
            latestData = body.latestData;
            console.log("[API] Data diterima:", latestData.length, "rows");
        }

        if (body.notification) {
            const newNotification: StoredNotification = {
                ...body.notification,
                timestamp: new Date().toISOString(),
            };
            notifications.push(newNotification);
            console.log("[API] Notifikasi diterima:", body.notification);
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        console.error("[API] Error:", err);
        return NextResponse.json({ success: false }, { status: 400 });
    }
}