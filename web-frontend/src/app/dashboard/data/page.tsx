"use client";

import { useDashboardData } from "@/context/DashboardDataContext";
import React, { useEffect, useState } from "react";

interface DataPoint {
  plc_id: string;
  plc_name: string;
  tag_name: string;
  value: number;
  timestamp: string;
}

const REFRESH_INTERVAL = 15; // detik

export default function DashboardPage() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [counter, setCounter] = useState(REFRESH_INTERVAL);

  const dashData = useDashboardData()

  // Fetch data function
  const fetchData = async () => {
    try {
      const res = await fetch(`${process.env.API_ENDPOINT}/api/realtime`, {
        cache: "no-store",
      });
      const result = await res.json();

      const latestData: DataPoint[] = Array.isArray(result.latestData)
        ? result.latestData
        : [];

      setData(latestData);
      setCounter(REFRESH_INTERVAL); // reset counter setiap kali update data
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  useEffect(() => {
    fetchData(); // initial load

    // interval per detik untuk countdown
    const tick = setInterval(() => {
      setCounter((prev) => {
        if (prev <= 1) {
          fetchData(); // fetch ulang saat counter habis
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Group data per PLC
  const grouped = data.reduce<Record<string, DataPoint[]>>((acc, item) => {
    if (!acc[item.plc_name]) acc[item.plc_name] = [];
    acc[item.plc_name].push(item);
    return acc;
  }, {});

  return (
    <section className="min-h-screen bg-gray-800 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-200">PLC Dashboard</h1>
        <div className="text-gray-600 flex">
          Next update in:{" "}
          <p className="font-semibold text-blue-600">{counter}s</p>
        </div>
      </div>

      {/* Grid for PLCs */}
      <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-2">
        {Object.keys(grouped).map((plcName) => (
          <div
            key={plcName}
            className="bg-white rounded-xl shadow-lg p-5 border border-gray-200"
          >
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              {plcName}
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b text-gray-600">
                    <th className="py-2 px-3">Tag</th>
                    <th className="py-2 px-3">Value</th>
                    <th className="py-2 px-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {grouped[plcName].map((point, idx) => (
                    <tr
                      key={idx}
                      className="border-b hover:bg-gray-50 transition"
                    >
                      <td className="py-2 px-3 font-medium text-gray-800">
                        {point.tag_name}
                      </td>
                      <td className="py-2 px-3 text-blue-600 font-semibold">
                        {point.value}
                      </td>
                      <td className="py-2 px-3 text-gray-500 text-xs">
                        {new Date(point.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h1>Dashboard data Provider</h1>
        <pre className="text-gray-200">
          {JSON.stringify(dashData.standardData || {}, null, 2)}
        </pre>
      </div>


    </section>
  );
}
