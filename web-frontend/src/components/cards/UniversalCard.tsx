"use client";
import { useEffect, useState, useCallback } from "react";
import Badge from "../ui/badge/Badge";
import { GroupIcon, 
  ArrowUpIcon
 } from "@/icons";
import { UptimeBar } from "../dashboard/Uptime";
import STANDARDS from "@/data/standards.json";
import { MachineStandardLimits, CardProps } from "@/types/production-standards";

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
    plc_name: "UNIVERSAL PRESS_B1-01 RIGHT",
    tag_name: "data_tag_5",
    time: "data_tag_6",
  },
  "B1-02": {
    plc_name: "UNIVERSAL PRESS_B1-02 RIGHT",
    tag_name: "data_tag_8",
    time: "data_tag_9",
  },
};

const STANDARDS_BY_MODEL: Record<string, MachineStandardLimits> = STANDARDS as Record<
  string,
  MachineStandardLimits
>;

export const UniversalCard = ({ selectedCell, selectedModel }: CardProps) => {
  const [dataPwi, setDataPwi] = useState<DataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = DATA_MAP[selectedCell];
  const selectedPlcIds = [config.plc_name];
  const API_ENDPOINT = `${process.env.NEXT_PUBLIC_LOCAL_API_BASE_URL ?? ""}/api/pwi-api/mc-data`;

  // 🔁 Fungsi fetch API — dibuat useCallback agar tidak bikin interval ganda
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(API_ENDPOINT, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Gagal mengambil data dari API (${res.status})`);
      const json = await res.json();

      const dataArray: DataPoint[] = Array.isArray(json)
        ? json
        : json.data || [];

      setDataPwi(dataArray);
      setIsLoading(false);
      setError(null);
    } catch (error: unknown) {
      console.error("Fetch error:", error);
      setError("Terjadi kesalahan saat mengambil data");
      setIsLoading(false);
    }
  }, [API_ENDPOINT]);

  // 🕒 Jalankan pertama kali + interval tiap 10 detik
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // 30 detik
    return () => clearInterval(interval);
  }, [fetchData]);

  // ✅ Filter data sesuai PLC
  const filteredData = dataPwi.filter((item) =>
    selectedPlcIds.includes(item.plc_name)
  );

  // Ambil nilai dari data yang difilter
  const pressureValue = filteredData[0]?.pressure ?? "0.00";

  // ✅ Ambil standard berdasarkan model
  const standards =
    selectedModel && STANDARDS_BY_MODEL[selectedModel]
      ? STANDARDS_BY_MODEL[selectedModel]
      : STANDARDS_BY_MODEL["DEFAULT"];

  const {
    UP_PRESSURE_MIN = 0,
    UP_PRESSURE_MAX = 100,
  } = standards;

  const isHotNormal =
    !isNaN(Number(pressureValue)) &&
    Number(pressureValue) >= UP_PRESSURE_MIN &&
    Number(pressureValue) <= UP_PRESSURE_MAX;

  const overallStatus = isHotNormal ? "NORMAL" : "ABNORMAL";
  const badgeColor = overallStatus === "NORMAL" ? "success" : "error";

  return (
    <div className="flex w-full gap-6 flex-col col-span-4 md:col-span-2 lg:col-span-1 h-full">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
            <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
          </div>
          <h3 className="text-right text-gray-800 dark:text-white/90">
            Universal Press
          </h3>
        </div>

        {error ? (
          <p className="text-red-500 mt-4 text-sm">{error}</p>
        ) : isLoading ? (
          <p className="text-gray-400 mt-4">Loading data...</p>
        ) : (
          <div className="flex flex-wrap items-end justify-between mt-5 md:px-2">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Pressure Avg
              </span>
            <div className="flex flex-col mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {pressureValue} Kgf
                <span className="text-xs text-gray-400">
                  ({UP_PRESSURE_MIN}-{UP_PRESSURE_MAX}) Kgf
                </span>
              </div>
            </div>
            {/* <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Time Press
              </span>
            <div className="flex flex-col mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
                {timeValue} S
                <span className="text-xs text-gray-400 ml-6">
                  ({UP_TIME_MIN}-{UP_TIME_MAX}) S
                </span>
              </div>
            </div> */}
          </div>
        )}

        <div className="mt-6 w-full flex flex-col items-center gap-2">
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
