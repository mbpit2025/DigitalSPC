"use client";

import React, { useEffect, useState } from "react";
import AlarmLogChart from "@/components/dashboard/AlarmChart";
import AlarmLog from "@/components/dashboard/AlarmLog";

// 📘 Tipe data (sesuaikan dengan struktur API kamu)
interface AlarmItem {
  id: number;
  plc_id: string;
  tag_name: string;
  alarm_type: "HIGH" | "LOW" | string;
  violated_value: number;
  treshold_value: number;
  alarm_time: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  is_active: number;
}

type AlarmApiResponse = {
  data: AlarmItem[];
};

export default function AlarmSections() {
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [loading, setLoading] = useState(true);

  // =====================================================
  // 🔁 Fetch data alarm setiap 3 detik
  // =====================================================
  useEffect(() => {
    const fetchAlarms = async () => {
      try {
        const res = await fetch("http://10.2.14.71:3000/api/alarm", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch alarm data");

        const json: AlarmApiResponse = await res.json();
        setAlarms(json.data || []);
      } catch (error) {
        console.error("Error fetching alarm data:", error);
      } finally {
        setLoading(false);
      }
    };

    // Panggil pertama kali saat komponen mount
    fetchAlarms();

    // Interval 3 detik (3000 ms)
    const interval = setInterval(fetchAlarms, 30000);

    // Cleanup interval saat unmount
    return () => clearInterval(interval);
  }, []);

  // =====================================================
  // 🧭 Render UI
  // =====================================================
  return (
    <section className="min-h-screen bg-gray-800 p-6 flex flex-col gap-4">
      {loading ? (
        <div className="text-center text-gray-300">Loading alarm data...</div>
      ) : (
        <div className="grid grid-cols-6 gap-4">
            <div className="col-span-6 xl:col-span-3">
              <AlarmLogChart alarms={alarms} />
            </div>
            <div className="col-span-6 xl:col-span-3">
              <AlarmLog alarms={alarms} />
            </div>
        </div>
      )}
    </section>
  );
}
