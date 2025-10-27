"use client";
import React, { useEffect, useState } from "react";
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

interface DataPoint {
  plc_id: number;
  plc_name: string;
  tagname: string;
  pressure: string;
  time: string;
  count: number;
}
// 🗺️ Map PLC dan tag yang digunakan
const DATA_MAP = {
  "B1-01": {
    plc_name: "GAUGE MARKING_B1-01 RIGHT",
    tag_name: "data_tag_1", // Tag tekanan
    time: "data_tag_2", // Tag waktu
  },
  "B1-02": {
    plc_name: "GAUGE MARKING_B1-01 LEFT",
    tag_name: "data_tag_3",
    time: "data_tag_4",
  },
};

const STANDARDS_BY_MODEL: Record<string, MachineStandardLimits> = STANDARDS as Record<
  string,
  MachineStandardLimits
>;

export const GaugeCard2 = ({ selectedCell, selectedModel }: CardProps) => {
  const [dataPwi, setDataPwi] = useState<DataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = DATA_MAP[selectedCell];
  const selectedPlcIds = [config.plc_name];

  // 🔁 Fungsi fetch API
  const fetchData = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL}/api/pwi-api/mc-data`, {
        cache: "no-store",
      });
      // if (!res.ok) throw new Error("Gagal mengambil data dari API");
      const json = await res.json();

      const dataArray: DataPoint[] = Array.isArray(json)
        ? json
        : json.data || [];

      setDataPwi(dataArray);
      setIsLoading(false);
    } catch (error) {
      console.error("Fetch error:", error);
      setIsLoading(false);
      setError("error fetch")
    }
  };

  // 🕒 Jalankan pertama kali + setiap 10 detik
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10 detik
    return () => clearInterval(interval);
  }, []);

  // ✅ Filter data sesuai PLC
  const filteredData = dataPwi.filter((item) =>
    selectedPlcIds.includes(item.plc_name)
  );
  
  const pressureValue = filteredData[0]?.pressure || "0.00";

  // Ambil standard dari model, fallback ke DEFAULT
  const standards =
    selectedModel && STANDARDS_BY_MODEL[selectedModel]
      ? STANDARDS_BY_MODEL[selectedModel]
      : STANDARDS_BY_MODEL["DEFAULT"];

  const { GM_PRESS_MAX, GM_PRESS_MIN } = standards;

  const isHotNormal =
    !isNaN(Number(pressureValue)) &&
    Number(pressureValue) >= GM_PRESS_MIN &&
    Number(pressureValue) <= GM_PRESS_MAX;

  const overallStatus = isHotNormal ? "NORMAL" : "ABNORMAL";
  const badgeColor = overallStatus === "NORMAL" ? "success" : "error";
  console.log(error)

  return (
    <div className="flex w-full gap-6 flex-col col-span-4 md:col-span-2 lg:col-span-1 h-full">
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
        {/* {error && <p className="text-red-600 text-sm mt-2">Error: {error}</p>} */}

        {/* Data Display */}
        <div className="flex flex-wrap gap-4 items-end justify-between mt-5 md:px-2">
          {/* Pressure */}
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Pressure Value
            </span>
            <div className="flex flex-col mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {isLoading ? "..." : `${Number(pressureValue).toFixed(2)} Kgf`}
              <span className="text-xs text-gray-400">
                ({GM_PRESS_MIN}-{GM_PRESS_MAX}) Kgf
              </span>
            </div>
          </div>

          {/* Time */}
          {/* <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Time Press
            </span>
            <div className="flex flex-col mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {isLoading ? "..." : `${coldPressure.toFixed(2)} s`}
              <span className="text-xs text-gray-400">
                ({GM_TIME_MIN}-{GM_TIME_MAX}) s
              </span>
            </div>
          </div> */}
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
    </div>
  );
};
