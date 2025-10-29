"use client";
import React from "react";
import { useDashboardData } from "@/context/DashboardDataContext";
import Badge from "../ui/badge/Badge";
import { GroupIcon, 
  ArrowUpIcon
 } from "@/icons";
import { UptimeBar } from "../dashboard/Uptime";
import { CardProps, DataPoint } from "@/types/production-standards";


const DATA_MAP = {
    'B1-01': {
        plcId: "2", // Asumsi PLC ID 1 untuk Back Part Molding di B1-01
        hotTag: "data4", // Tag untuk Upper Temp
        coldTag: "data5", // Tag untuk Outsole Temp
    },
    'B1-02': {
        plcId: "5", // Asumsi PLC ID 4 untuk Back Part Molding di B1-02
        hotTag: "data4", // Tag yang berbeda untuk Upper Temp di B1-02
        coldTag: "data5", // Tag yang berbeda untuk Outsole Temp di B1-02
    },
};


export const Primer1Card = ({selectedCell, selectedModel} : CardProps) => {
  const { data, standardData } = useDashboardData();
 
  const config = DATA_MAP[selectedCell];
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
    standardData["DEFAULT"];
  
  
  const { PM1_OT_TEMP_MIN, PM1_OT_TEMP_MAX, PM1_UP_TEMP_MIN, PM1_UP_TEMP_MAX } = standards;
  

  // PLC yang dipilih (string)
  const selectedPlcIds = [config.plcId];

  // Filter data sesuai PLC id
  const filteredData: DataPoint[] = data.filter((item) =>
    selectedPlcIds.includes(item.plc_id)
  );

  // Ambil satu data tertentu misal PLC 1
  const outsoleTemp = filteredData.find(
    (item) => item.plc_id === config.plcId && item.tag_name === config.hotTag
  );
  const upperTemp = filteredData.find(
    (item) => item.plc_id === config.plcId && item.tag_name === config.coldTag
  );

  // Hitung status normal/abnormal
  const isHotNormal =
    outsoleTemp?.value !== undefined &&
    outsoleTemp.value >= PM1_OT_TEMP_MIN &&
    outsoleTemp.value <= PM1_OT_TEMP_MAX;

  const isColdNormal =
    upperTemp?.value !== undefined &&
    upperTemp.value >= PM1_UP_TEMP_MIN &&
    upperTemp.value <= PM1_UP_TEMP_MAX;

  // Badge logic
  const overallStatus = isHotNormal && isColdNormal ? "NORMAL" : "ABNORMAL";
  const badgeColor = overallStatus === "NORMAL" ? "success" : "error";

  return (
    <div className="flex w-full gap-6 flex-col col-span-4 md:col-span-2 lg:col-span-1">

      {/* Contoh Card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
            <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
          </div>
          <h3 className="text-right text-gray-800 dark:text-white/90">
            Primer 1 / Cleaning
          </h3>
        </div>

        <div className="flex flex-wrap gap-4 items-end justify-between mt-5 md:px-2">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              OUTSOLE Temp Avg
            </span>
            <div className="flex flex-col mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {outsoleTemp ? `${outsoleTemp.value} °C` : "--"} 
              <span className="text-xs text-gray-400">
              ({PM1_OT_TEMP_MIN}-{PM1_OT_TEMP_MAX}) °C
              </span>
            </div>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              UPPER Temp Avg
            </span>
            <div className="flex flex-col mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              <h1>
                {upperTemp ? `${upperTemp.value} °C` : "--"}
              </h1>
              <span className="text-xs text-gray-400">
                ({PM1_UP_TEMP_MIN}-{PM1_UP_TEMP_MAX}) °C
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
