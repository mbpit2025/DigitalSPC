"use client";
import { useState, useEffect } from "react";
import { useDashboardData } from "@/context/DashboardDataContext";
import Badge from "../ui/badge/Badge";
import { GroupIcon, ArrowUpIcon } from "@/icons";
import { UptimeBar } from "../dashboard/Uptime";
import { MachineStandardLimits, CardProps, DataPoint } from "@/types/production-standards";

const FALLBACK_STANDARDS: MachineStandardLimits = {
  HOT_TEMP_MIN: 80,
  HOT_TEMP_MAX: 90,
  COLD_TEMP_MIN: 10,
  COLD_TEMP_MAX: 40,
  PR_UP_TEMP_MAX: 80,
  PR_UP_TEMP_MIN: 70,
  PR_OT_TEMP_MAX: 80,
  PR_OT_TEMP_MIN: 70,
  PM1_UP_TEMP_MAX: 55,
  PM1_UP_TEMP_MIN: 50,
  PM1_OT_TEMP_MAX: 55,
  PM1_OT_TEMP_MIN: 50,
  PM2_UP_TEMP_MAX: 55,
  PM2_UP_TEMP_MIN: 50,
  PM2_OT_TEMP_MAX: 55,
  PM2_OT_TEMP_MIN: 50,
  CM_UP_TEMP_MAX: 65,
  CM_UP_TEMP_MIN: 60,
  CM_OT_TEMP_MAX: 65,
  CM_OT_TEMP_MIN: 60,
  CH_UP_TEMP_MAX: 31,
  CH_UP_TEMP_MIN: 25,
  CH_OT_TEMP_MAX: 25,
  CH_OT_TEMP_MIN: 31,
  GM_PRESS_MAX: 3,
  GM_PRESS_MIN: 2.5,
  GM_TIME_MAX: 3,
  GM_TIME_MIN: 2,
  UP_PRESSURE_MAX: 40,
  UP_PRESSURE_MIN: 35,
  UP_TIME_MAX: 12,
  UP_TIME_MIN: 10,
};

const BPM_CELL_MAP = {
  "B1-01": {
    plcId: "1",
    hotTag: "data2",
    coldTag: "data5",
  },
  "B1-02": {
    plcId: "4",
    hotTag: "data2",
    coldTag: "data5",
  },
};

export const BPMCard = ({ selectedCell, selectedModel }: CardProps) => {
  const { data } = useDashboardData();
  const [standardData, setStandardData] = useState<Record<string, MachineStandardLimits>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ambil data standard dari API
  useEffect(() => {
    const fetchStandards = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/standards`);
        if (!res.ok) throw new Error("Failed to fetch standard data");
        const result = await res.json();
        setStandardData(result || {});
      } catch (err: unknown) {
        console.error("Error fetching standard data:", (err as Error).message);
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStandards();
  }, []);


  const config = BPM_CELL_MAP[selectedCell];
  if (!config) {
    return (
      <div className="p-5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-gray-600 dark:text-gray-400">
          Invalid cell selection: {selectedCell}
        </p>
      </div>
    );
  }

  const standards =
    (selectedModel && standardData[selectedModel]) ||
    standardData["DEFAULT"] ||
    FALLBACK_STANDARDS;

  const { HOT_TEMP_MIN, HOT_TEMP_MAX, COLD_TEMP_MIN, COLD_TEMP_MAX } = standards;

  // Filter data sesuai PLC
  const filteredData: DataPoint[] = data.filter((item) =>
    [config.plcId].includes(item.plc_id)
  );

  const hotTemp = filteredData.find(
    (item) => item.plc_id === config.plcId && item.tag_name === config.hotTag
  );
  const coldTemp = filteredData.find(
    (item) => item.plc_id === config.plcId && item.tag_name === config.coldTag
  );

  // Hitung status normal/abnormal
  const isHotNormal =
    hotTemp?.value !== undefined &&
    hotTemp.value >= HOT_TEMP_MIN &&
    hotTemp.value <= HOT_TEMP_MAX;

  const isColdNormal =
    coldTemp?.value !== undefined &&
    coldTemp.value >= COLD_TEMP_MIN &&
    coldTemp.value <= COLD_TEMP_MAX;

  const overallStatus = isHotNormal && isColdNormal ? "NORMAL" : "ABNORMAL";
  const badgeColor = overallStatus === "NORMAL" ? "success" : "error";


  if (error) {
    return (
      <div className="p-5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 flex-col col-span-4 md:col-span-2 lg:col-span-1 h-full">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
            <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
          </div>
          <h3 className="text-right text-gray-800 dark:text-white/90">
            Back Part Molding {selectedCell} : {selectedModel || "N/A"}
          </h3>
        </div>

        <div className="flex flex-wrap gap-4 items-end justify-between mt-5 md:px-2">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              HEATING Temp Avg
            </span>
            <div className="flex flex-col mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {hotTemp ? `${hotTemp.value} °C` : "--"} 
              <span className="text-xs text-gray-400">
                {isLoading ? "loading Standards..." : (
                  <>
                    ({HOT_TEMP_MIN}-{HOT_TEMP_MAX}) °C
                  </>
                )}
              </span>
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Cold Molding Temp Avg
            </span>
            <div className="flex flex-col mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {coldTemp ? `${coldTemp.value} °C` : "--"}
              <span className="text-xs text-gray-400">
                {isLoading ? "loading Standards..." : (
                  <>
                    ({COLD_TEMP_MIN}-{COLD_TEMP_MAX}) °C
                  </>
                )}  
              </span>
            </div>
          </div>
        </div>

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
