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

export async function GET() {
    // Return latestData and notifications as defined types
    return NextResponse.json({ latestData, notifications });
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