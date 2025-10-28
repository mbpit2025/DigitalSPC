"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";
import { ArrowDownIcon, ArrowUpIcon } from "@/icons";
import { TAG_TO_NAME_MAP } from "@/utils/tagMap";

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

interface AlarmLogProps {
  alarms: AlarmItem[];
}

/**
 * Komponen utama untuk menampilkan tabel alarm log.
 * - Mendukung filter by status dan type.
 * - Nama sensor dimapping dari plc_id + tag_name.
 */
export default function AlarmLog({ alarms }: AlarmLogProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ACTIVE");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // 🔹 Helper: ubah plc_id & tag_name jadi nama sensor
  const getMappedName = (plc_id: string, tag_name: string): string => {
    const id = Number(plc_id);
    const mapped = TAG_TO_NAME_MAP[id]?.[tag_name];
    return mapped ?? `${plc_id}-${tag_name}`;
  };

  // 🔹 Filter data berdasarkan status & type
  const filteredAlarms = useMemo(() => {
    return alarms.filter((alarm) => {
      const matchStatus =
        statusFilter === "ALL" || alarm.status === statusFilter;
      const matchType = typeFilter === "ALL" || alarm.alarm_type === typeFilter;
      return matchStatus && matchType;
    });
  }, [alarms, statusFilter, typeFilter]);

  const handleReset = () => {
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 max-h-[700px]">
      {/* Header Section */}
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Alarm Log
        </h3>

        {/* Filter Section */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter Status */}
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </select>

          {/* Filter Alarm Type */}
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value="HIGH">High</option>
            <option value="LOW">Low</option>
          </select>

          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="max-w-full overflow-x-auto dark:bg-gray-700 max-h-[650px]">
        <Table>
          {/* Table Header */}
          <TableHeader className="border-gray-100 dark:border-gray-800 bg-blue-500 dark:bg-blue-950 border-y">
            <TableRow className="dark:text-white">
              <TableCell isHeader className="text-center text-theme-xs py-4">
                Checking Point
              </TableCell>
              <TableCell isHeader className="text-center text-theme-xs">
                Alarm Type
              </TableCell>
              <TableCell isHeader className="text-center text-theme-xs">
                Violated / Threshold
              </TableCell>
              <TableCell isHeader className="text-center text-theme-xs">
                Active Time
              </TableCell>
              <TableCell isHeader className="text-center text-theme-xs">
                Status
              </TableCell>
              <TableCell isHeader className="text-center text-theme-xs">
                Resolved Time
              </TableCell>
            </TableRow>
          </TableHeader>

          {/* Table Body */}
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredAlarms.length > 0 ? (
              filteredAlarms.map((alarm) => (
                <TableRow
                  key={alarm.id}
                  className="hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                >
                  {/* Checking Point */}
                  <TableCell className="py-3 text-center font-semibold text-gray-700 dark:text-gray-200">
                    {getMappedName(alarm.plc_id, alarm.tag_name)}
                  </TableCell>

                  {/* Alarm Type */}
                  <TableCell className="py-3 text-center">
                    <Badge
                      size="sm"
                      color={
                        alarm.alarm_type === "HIGH"
                          ? "error"
                          : alarm.alarm_type === "LOW"
                          ? "success"
                          : "warning"
                      }
                    >
                      {alarm.alarm_type === "HIGH" ? (
                        <ArrowUpIcon />
                      ) : (
                        <ArrowDownIcon />
                      )}
                    </Badge>
                  </TableCell>

                  {/* Values */}
                  <TableCell className="py-3 text-center text-gray-500 dark:text-gray-400">
                    {alarm.violated_value.toFixed(2)} /{" "}
                    {alarm.treshold_value.toFixed(2)}
                  </TableCell>

                  {/* Active Time */}
                  <TableCell className="py-3 text-center text-gray-500 dark:text-gray-400">
                    {new Date(alarm.alarm_time).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-3 text-center">
                    <Badge
                      size="sm"
                      color={
                        alarm.status === "ACTIVE"
                          ? "error"
                          : alarm.status === "ACKNOWLEDGED"
                          ? "warning"
                          : "success"
                      }
                    >
                      {alarm.status}
                    </Badge>
                  </TableCell>

                  {/* Resolved Time */}
                  <TableCell className="py-3 text-center text-gray-500 dark:text-gray-400">
                    {alarm.resolved_at
                      ? new Date(alarm.resolved_at).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta",
                        })
                      : "-"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="py-4 text-center text-gray-500 dark:text-gray-400 col-span-6"
                >
                  No alarm data found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
