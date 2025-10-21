"use client";

import React from "react";
import { useDashboardData } from "@/context/DashboardDataContext";

export default function DashboardPage() {
  const { data, counter } = useDashboardData();

  const grouped = data.reduce<Record<string, typeof data>>((acc, item) => {
    if (!acc[item.plc_name]) acc[item.plc_name] = [];
    acc[item.plc_name].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">PLC Dashboard</h1>
        <p className="text-gray-600">
          Next update in:{" "}
          <span className="font-semibold text-blue-600">{counter}s</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Object.keys(grouped).map((plcName) => (
          <div key={plcName} className="bg-white rounded-xl shadow-lg p-5 border">
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
                    <tr key={idx} className="border-b hover:bg-gray-50 transition">
                      <td className="py-2 px-3 font-medium">{point.tag_name}</td>
                      <td className="py-2 px-3 text-blue-600 font-semibold">{point.value}</td>
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
    </div>
  );
}
