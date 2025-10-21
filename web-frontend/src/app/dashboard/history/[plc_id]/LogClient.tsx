'use client';

import React, { useEffect, useState, useMemo } from "react";
import { addDays, subDays, startOfDay } from "date-fns";
import LogTable from "./LogTable";

interface PlcData {
  id: number;
  plc_id: string;
  plc_name: string;
  tag_name: string;
  value: number;
  timestamp: string;
}

interface LogClientProps {
  plcId: string;
}

export default function LogClient({ plcId }: LogClientProps) {
  const [data, setData] = useState<PlcData[]>([]);
  const [filtered, setFiltered] = useState<PlcData[]>([]);
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  // 🔹 Filter tambahan
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "plc_name",
    "tag_name",
    "value",
    "timestamp",
  ]);

  // Ambil data dari API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/log/${plcId}`);
        const json = await res.json();
        setData(json);
        setFiltered(json);
      } catch (err) {
        console.error("Gagal mengambil data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [plcId]);

  // Dapatkan semua tag unik
  const uniqueTags = useMemo(
    () => Array.from(new Set(data.map((d) => d.tag_name))),
    [data]
  );

  // Filter data berdasarkan tanggal + tag
  useEffect(() => {
    const filteredData = data.filter((d) => {
      const ts = new Date(d.timestamp);
      const matchDate = ts >= startDate && ts <= addDays(endDate, 1);
      const matchTag =
        selectedTags.length === 0 || selectedTags.includes(d.tag_name);
      return matchDate && matchTag;
    });
    setFiltered(filteredData);
  }, [startDate, endDate, selectedTags, data]);

  // Tombol cepat untuk filter waktu
  const handleFilter = (range: "day" | "week" | "month") => {
    const now = new Date();
    if (range === "day") setStartDate(subDays(now, 1));
    if (range === "week") setStartDate(subDays(now, 7));
    if (range === "month") setStartDate(subDays(now, 30));
    setEndDate(now);
  };

  // Toggle kolom
  const toggleColumn = (col: string) => {
    setVisibleColumns((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    );
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">
        Log Data Mesin - PLC ID:{" "}
        <span className="text-blue-600">{plcId}</span>
      </h1>

      {/* Filter tanggal */}
      <div className="flex flex-wrap items-center gap-3 border-b pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => handleFilter("day")}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Per Hari
          </button>
          <button
            onClick={() => handleFilter("week")}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Per Minggu
          </button>
          <button
            onClick={() => handleFilter("month")}
            className="px-3 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
          >
            Per Bulan
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-700">Dari:</label>
          <input
            type="date"
            value={startDate.toISOString().substring(0, 10)}
            onChange={(e) => setStartDate(new Date(e.target.value))}
            className="border rounded-md p-1"
          />
          <label className="text-sm text-gray-700">Sampai:</label>
          <input
            type="date"
            value={endDate.toISOString().substring(0, 10)}
            onChange={(e) => setEndDate(new Date(e.target.value))}
            className="border rounded-md p-1"
          />
        </div>
      </div>

      {/* Filter tag */}
      <div className="flex flex-wrap gap-3 border-b pb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Filter Tag:
          </h3>
          <div className="flex flex-wrap gap-2">
            {uniqueTags.map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setSelectedTags((prev) =>
                    prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
                      : [...prev, tag]
                  )
                }
                className={`px-3 py-1 rounded-full border text-sm ${
                  selectedTags.includes(tag)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter kolom */}
      <div className="border-b pb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          Kolom yang ditampilkan:
        </h3>
        <div className="flex flex-wrap gap-3">
          {["plc_name", "tag_name", "value", "timestamp"].map((col) => (
            <label key={col} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={visibleColumns.includes(col)}
                onChange={() => toggleColumn(col)}
              />
              <span className="capitalize">{col.replace("_", " ")}</span>
            </label>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Memuat data...</p>
      ) : (
        <LogTable data={filtered} visibleColumns={visibleColumns} />
      )}
    </div>
  );
}
