'use client';

import React from "react";

interface PlcData {
  id: number;
  plc_id: string;
  plc_name: string;
  tag_name: string;
  value: number;
  timestamp: string;
}

interface LogTableProps {
  data: PlcData[];
  visibleColumns: string[];
}

export default function LogTable({ data, visibleColumns }: LogTableProps) {
  if (!data || data.length === 0)
    return <p className="text-gray-500">Tidak ada data dalam periode ini.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border shadow">
      <table className="min-w-full text-sm text-left">
        <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
          <tr>
            <th className="px-3 py-2">#</th>
            {visibleColumns.includes("plc_name") && (
              <th className="px-3 py-2">PLC Name</th>
            )}
            {visibleColumns.includes("tag_name") && (
              <th className="px-3 py-2">Tag</th>
            )}
            {visibleColumns.includes("value") && (
              <th className="px-3 py-2">Value</th>
            )}
            {visibleColumns.includes("timestamp") && (
              <th className="px-3 py-2">Timestamp</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.id}
              className={i % 2 === 0 ? "bg-white" : "bg-gray-50 hover:bg-gray-100"}
            >
              <td className="px-3 py-2">{i + 1}</td>
              {visibleColumns.includes("plc_name") && (
                <td className="px-3 py-2">{row.plc_name}</td>
              )}
              {visibleColumns.includes("tag_name") && (
                <td className="px-3 py-2">{row.tag_name}</td>
              )}
              {visibleColumns.includes("value") && (
                <td className="px-3 py-2">{row.value}</td>
              )}
              {visibleColumns.includes("timestamp") && (
                <td className="px-3 py-2">
                  {new Date(row.timestamp).toLocaleString("id-ID")}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
