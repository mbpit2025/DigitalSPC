"use client";
import { useDashboardData } from "@/context/DashboardDataContext";
import Badge from "../ui/badge/Badge";
import { GroupIcon, ArrowUpIcon } from "@/icons";
import { UptimeBar } from "../dashboard/Uptime";
import { CardProps, DataPoint } from "@/types/production-standards";


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
  const { data, standardData } = useDashboardData();

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
    standardData["DEFAULT"];

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
                  <>
                    ({HOT_TEMP_MIN}-{HOT_TEMP_MAX}) °C
                  </>
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
                  <>
                    ({COLD_TEMP_MIN}-{COLD_TEMP_MAX}) °C
                  </>
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
