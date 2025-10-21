"use client";
import React, { useCallback, useEffect, useState } from "react";
import Badge from "../ui/badge/Badge";
import { GroupIcon, 
  ArrowUpIcon
 } from "@/icons";
import { UptimeBar } from "../dashboard/Uptime";
import STANDARDS from "@/data/standards.json";
import {
  MachineStandardLimits,
  CardProps,
} from "@/types/production-standards";

interface DataPWI {
  plc_id: number;
  plc_name: string;
  tagname: string;
  pressure: string;
  time: string;
  counter: number;
}

const DATA_MAP = {
  "B1-01": { plcId: "1", hotTag: "data1", coldTag: "data2" },
  "B1-02": { plcId: "4", hotTag: "data3", coldTag: "data4" },
};

const STANDARDS_BY_MODEL: Record<string, MachineStandardLimits> = STANDARDS as Record<
  string,
  MachineStandardLimits
>;

export const GaugeCard = ({ selectedCell, selectedModel }: CardProps) => {
  const [dataPwi, setDataPwi] = useState<DataPWI[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = DATA_MAP[selectedCell];
  const selectedPlcIds = config ? [config.plcId] : [];

  const standards =
    selectedModel && STANDARDS_BY_MODEL[selectedModel]
      ? STANDARDS_BY_MODEL[selectedModel]
      : STANDARDS_BY_MODEL["DEFAULT"];

  const { GM_PRESS_MAX, GM_PRESS_MIN, GM_TIME_MAX, GM_TIME_MIN } = standards;

  // =====================================================
  // 🔹 FETCH DATA API
  // =====================================================
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL}/api/pwi-api/mc-data`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: { data: DataPWI[] } = await response.json();
      setDataPwi(result.data || []);
    } catch (err) {
      console.error("❌ Failed to fetch pressure data:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setDataPwi([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Polling setiap 30 detik
  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 30000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // =====================================================
  // 🔹 FILTER & AMBIL NILAI DARI TAG
  // =====================================================
  const filteredData = dataPwi.filter((item) =>
    selectedPlcIds.includes(String(item.plc_id))
  );

  const hotData = filteredData.find(
    (item) => config && String(item.plc_id) === config.plcId && item.tagname === config.hotTag
  );

  const coldData = filteredData.find(
    (item) => config && String(item.plc_id) === config.plcId && item.tagname === config.coldTag
  );

  const hotPressure = Number(hotData?.pressure ?? 0);
  const coldPressure = Number(coldData?.pressure ?? 0);

  const isHotNormal =
    !isNaN(hotPressure) &&
    hotPressure >= GM_PRESS_MIN &&
    hotPressure <= GM_PRESS_MAX;

  const isColdNormal =
    !isNaN(coldPressure) &&
    coldPressure >= GM_TIME_MIN &&
    coldPressure <= GM_TIME_MAX;

  const overallStatus = isHotNormal && isColdNormal ? "NORMAL" : "ABNORMAL";
  const badgeColor = overallStatus === "NORMAL" ? "success" : "error";

  // =====================================================
  // 🔹 RENDER
  // =====================================================
  return (
    <div className="flex w-full gap-6 flex-col col-span-4 md:col-span-2 lg:col-span-1">
      {!config ? (
        <div className="p-4 border border-red-300 bg-red-50 rounded-xl text-sm text-red-700">
          ⚠️ Invalid cell configuration for <b>{selectedCell}</b>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] flex flex-col justify-between">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
              <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
            </div>
            <h3 className="text-right text-gray-800 dark:text-white/90">
              Gauge Marking
            </h3>
          </div>

          {/* Error Message */}
          {error && <p className="text-red-600 text-sm mt-2">Error: {error}</p>}

          {/* Data Display */}
          <div className="flex flex-wrap gap-4 items-end justify-between mt-5 md:px-2">
            {/* Pressure */}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Pressure Value
              </span>
              <div className="flex flex-col mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {isLoading ? "..." : `${hotPressure.toFixed(2)} Kgf`}
                <span className="text-xs text-gray-400">
                  ({GM_PRESS_MIN}-{GM_PRESS_MAX}) Kgf
                </span>
              </div>
            </div>

            {/* Time */}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Time Press
              </span>
              <div className="flex flex-col mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {isLoading ? "..." : `${coldPressure.toFixed(2)} s`}
                <span className="text-xs text-gray-400">
                  ({GM_TIME_MIN}-{GM_TIME_MAX}) s
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 w-full flex flex-col items-center">
            <Badge
              variant="light"
              color={badgeColor}
              size="sm"
              startIcon={<ArrowUpIcon />}
            >
              {overallStatus}
            </Badge>
            <UptimeBar value={70} />
          </div>

        </div>
      )}
    </div>
  );
};
