"use client";

import React from "react";
import { STANDARD_MAP } from "@/data/standard-map";
import { MachineStandardLimits } from "@/types/production-standards";

interface StdTableProps {
  modelId: string;
  standard: Partial<MachineStandardLimits>; // ✅ jadikan Partial biar aman jika belum lengkap
  onUpdate: (key: keyof MachineStandardLimits, value: number | null) => void;
  onSaveRow: (
    keyMin: keyof MachineStandardLimits,
    keyMax: keyof MachineStandardLimits
  ) => Promise<void>;
  isDirty: Record<string, boolean>;
}

export default function StdTable({
  modelId,
  standard,
  onUpdate,
  onSaveRow,
  isDirty,
}: StdTableProps) {
  const parameters = STANDARD_MAP[modelId as keyof typeof STANDARD_MAP];

  if (!parameters) {
    return (
      <div className="p-6 text-center text-gray-500">
        <h2 className="text-xl font-semibold">Data tidak ditemukan</h2>
        <p>Pastikan model ID memiliki mapping standar yang sesuai.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg shadow mt-6">
      <table className="min-w-full text-sm text-left border-collapse">
        <thead className="bg-gray-100 border-b">
          <tr>
            <th className="px-4 py-2 font-semibold text-gray-700">Category</th>
            <th className="px-4 py-2 font-semibold text-gray-700">Key (Min)</th>
            <th className="px-4 py-2 font-semibold text-gray-700">Min Value</th>
            <th className="px-4 py-2 font-semibold text-gray-700">Key (Max)</th>
            <th className="px-4 py-2 font-semibold text-gray-700">Max Value</th>
            <th className="px-4 py-2 font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((param, index) => {
            const minValue = standard[param.keyMin as keyof MachineStandardLimits];
            const maxValue = standard[param.keyMax as keyof MachineStandardLimits];
            const dirty =
              isDirty[param.keyMin] || isDirty[param.keyMax];

            return (
              <tr
                key={index}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="px-4 py-2 font-medium">{param.category}</td>
                <td className="px-4 py-2">{param.keyMin}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={minValue ?? ""}
                    onChange={(e) =>
                      onUpdate(
                        param.keyMin as keyof MachineStandardLimits,
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    className="border rounded px-2 py-1 w-24"
                  />
                </td>
                <td className="px-4 py-2">{param.keyMax}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    value={maxValue ?? ""}
                    onChange={(e) =>
                      onUpdate(
                        param.keyMax as keyof MachineStandardLimits,
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    className="border rounded px-2 py-1 w-24"
                  />
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() =>
                      onSaveRow(
                        param.keyMin as keyof MachineStandardLimits,
                        param.keyMax as keyof MachineStandardLimits
                      )
                    }
                    disabled={!dirty}
                    className={`px-3 py-1 rounded transition-colors ${
                      dirty
                        ? "bg-blue-500 text-white hover:bg-blue-600"
                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Save
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
