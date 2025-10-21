import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import Badge from "../ui/badge/Badge";

// Define the TypeScript interface for the table rows
interface AlarmLogData {
  id: number;
  mesin: string; // Nama mesin
  time: string; // Waktu alarm
  category: string; // Kategori alarm
  status: "Active" | "Acknowledged" | "Resolved"; // Status alarm
}

// Data dummy alarm log
const tableData: AlarmLogData[] = [
  // {
  //   id: 1,
  //   mesin: "Mesin Injection 01",
  //   time: "2025-09-12 08:35:20",
  //   category: "Overheat",
  //   status: "Active",
  // },
  // {
  //   id: 2,
  //   mesin: "Mesin Press 02",
  //   time: "2025-09-12 08:40:05",
  //   category: "Emergency Stop",
  //   status: "Acknowledged",
  // },
  // {
  //   id: 3,
  //   mesin: "Mesin Cutting 03",
  //   time: "2025-09-12 09:10:12",
  //   category: "Low Pressure",
  //   status: "Resolved",
  // },
  // {
  //   id: 4,
  //   mesin: "Mesin Packaging 04",
  //   time: "2025-09-12 09:22:45",
  //   category: "Door Open",
  //   status: "Active",
  // },
  // {
  //   id: 5,
  //   mesin: "Mesin CNC 05",
  //   time: "2025-09-12 09:30:18",
  //   category: "Sensor Fault",
  //   status: "Resolved",
  // },
];

export default function AlarmLog() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
      <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Alarm Log
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200">
            Filter
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-theme-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200">
            See all
          </button>
        </div>
      </div>
      <div className="max-w-full overflow-x-auto">
        <Table>
          {/* Table Header */}
          <TableHeader className="border-gray-100 dark:border-gray-800 border-y">
            <TableRow>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Mesin
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Time
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Alarm Category
              </TableCell>
              <TableCell
                isHeader
                className="py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Status
              </TableCell>
            </TableRow>
          </TableHeader>

          {/* Table Body */}
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {tableData.length == 0 ? <TableRow>No Error Found</TableRow> : tableData.map((alarm) => (
              <TableRow key={alarm.id}>
                <TableCell className="py-3 text-gray-800 text-theme-sm dark:text-white/90">
                  {alarm.mesin}
                </TableCell>
                <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                  {alarm.time}
                </TableCell>
                <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                  {alarm.category}
                </TableCell>
                <TableCell className="py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                  <Badge
                    size="sm"
                    color={
                      alarm.status === "Active"
                        ? "error"
                        : alarm.status === "Acknowledged"
                        ? "warning"
                        : "success"
                    }
                  >
                    {alarm.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
