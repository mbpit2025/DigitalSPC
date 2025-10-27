'use client';

import React, { useEffect, useState } from 'react';
import PageBreadcrumb from '@/components/common/PageBreadCrumb';
import Link from 'next/link';
import { ArrowRightIcon } from '@/icons';

// --- tipe data satu baris standar ---
type StandardRow = {
  parameter_name: string;
  min_value: number | string;
  max_value: number | string;
};

// --- mapping untuk label dan urutan ---
const parameterMap: Record<string, { label: string; order: number }> = {
  HOT_TEMP: { label: 'BPM Hot Temperature', order: 1 },
  COLD_TEMP: { label: 'BPM Cold Temperature', order: 2 },
  CH_OT_TEMP: { label: 'CH Out Temp', order: 3 },
  CH_UP_TEMP: { label: 'CH Upper Temp', order: 4 },
  CM_OT_TEMP: { label: 'CM Out Temp', order: 5 },
  CM_UP_TEMP: { label: 'CM Upper Temp', order: 6 },
  GM_PRESS: { label: 'GM Pressure', order: 7 },
  GM_TIME: { label: 'GM Time', order: 8 },
  PM1_OT_TEMP: { label: 'PM1 Out Temp', order: 9 },
  PM1_UP_TEMP: { label: 'PM1 Upper Temp', order: 10 },
  PM2_OT_TEMP: { label: 'PM2 Out Temp', order: 11 },
  PM2_UP_TEMP: { label: 'PM2 Upper Temp', order: 12 },
  PR_OT_TEMP: { label: 'PR Out Temp', order: 13 },
  PR_UP_TEMP: { label: 'PR Upper Temp', order: 14 },
  UP_PRESSURE: { label: 'Up Pressure', order: 15 },
  UP_TIME: { label: 'Up Time', order: 16 },
};

export default function SettingLineClient({ modelId, modelName }: { modelId: string, modelName: string }) {
  const [standards, setStandards] = useState<StandardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // fetch dan normalize (pastikan min/max adalah string untuk input controlled)
  useEffect(() => {
    async function fetchStandards() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/standards/${modelName}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // normalize: pastikan min/max dalam bentuk string supaya input controlled
        const normalized: StandardRow[] =
          (data.data || []).map((r: StandardRow) => ({
            parameter_name: r.parameter_name,
            min_value: r.min_value != null ? String(r.min_value) : '',
            max_value: r.max_value != null ? String(r.max_value) : '',
          })) || [];

        setStandards(normalized);
      } catch (err) {
        console.error(err);
        setError('Gagal memuat data standard.');
      } finally {
        setLoading(false);
      }
    }

    if (modelName) fetchStandards();
  }, [modelName]);

  // update berdasarkan parameter_name (bukan index)
  const handleInputChange = (
    parameter: string,
    field: 'min_value' | 'max_value',
    value: string
  ) => {
    setStandards((prev) =>
      prev.map((r) =>
        r.parameter_name === parameter ? { ...r, [field]: value } : r
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // konversi min/max ke number (atau null) sebelum dikirim
      const payload = standards.map((s) => ({
        parameter_name: s.parameter_name,
        min_value:
          s.min_value === '' ? null : Number(String(s.min_value).trim()),
        max_value:
          s.max_value === '' ? null : Number(String(s.max_value).trim()),
      }));

      const res = await fetch(`/api/standards/${modelId}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standards: payload }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Failed to save (${res.status}) ${txt}`);
      }

      // optional: refresh data dari server setelah sukses
      // atau hanya tampilkan notifikasi
      alert('✅ Data berhasil disimpan!');
    } catch (err) {
      console.error(err);
      alert('❌ Terjadi kesalahan saat menyimpan data.');
    } finally {
      setSaving(false);
    }
  };

  // urutkan berdasarkan parameterMap.order, fallback ke alphabet
  const sortedStandards = [...standards].sort((a, b) => {
    const oA = parameterMap[a.parameter_name]?.order ?? 999;
    const oB = parameterMap[b.parameter_name]?.order ?? 999;
    if (oA !== oB) return oA - oB;
    // fallback: parameter_name alphabetical to keep deterministic
    return a.parameter_name.localeCompare(b.parameter_name);
  });

  return (
    <div className="flex flex-col gap-4">
      <PageBreadcrumb pageTitle="Standard Setting" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {modelName.toUpperCase()}
            </h1>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>

          {loading ? (
            <p className="text-gray-500">Loading standards...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <table className="min-w-full text-sm text-left border-2 border-gray-100 dark:border-gray-700 dark:bg-gray-200">
              <thead className="bg-blue-700 text-white">
                <tr>
                  <th className="px-4 py-2">Parameter</th>
                  <th className="px-4 py-2">Min Value</th>
                  <th className="px-4 py-2">Max Value</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandards.map((row) => {
                  const mapInfo = parameterMap[row.parameter_name];
                  const displayLabel = mapInfo?.label || row.parameter_name;

                  return (
                    <tr
                      key={row.parameter_name}
                      className="border-t border-gray-200 dark:border-gray-500 hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-900 dark:text-white"
                    >
                      <td className="px-4 py-2 font-medium">{displayLabel}</td>

                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={row.min_value as string}
                          onChange={(e) =>
                            handleInputChange(
                              row.parameter_name,
                              'min_value',
                              e.target.value
                            )
                          }
                          className="w-28 rounded border px-2 py-1 bg-gray-50 dark:bg-gray-500 text-center"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={row.max_value as string}
                          onChange={(e) =>
                            handleInputChange(
                              row.parameter_name,
                              'max_value',
                              e.target.value
                            )
                          }
                          className="w-28 rounded border px-2 py-1 bg-gray-50 dark:bg-gray-500 text-center"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        <Link href='/dashboard/settings' className='text-gray-700 p-2 flex gap-4 hover:text-blue-500'><ArrowRightIcon size={20}/> Back to Settings</Link>
        </div>
      </div>
    </div>
  );
}
