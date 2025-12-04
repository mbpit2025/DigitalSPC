// data-collector/config.js


// Definisi 6 PLC (Minimalis)
const PLCS = [
  { id: "1", name: 'BPM-01', ip: '10.2.13.74', port: 502, unitId: 1 },
  { id: "2", name: 'CHAMBER-01', ip: '10.2.13.75', port: 502, unitId: 2 },
  { id: "3", name: 'CHILLER-01', ip: '10.2.13.76', port: 502, unitId: 3 },
  { id: "4", name: 'BPM-02', ip: '10.2.13.77', port: 502, unitId: 4 },
  { id: "5", name: 'CHAMBER-02', ip: '10.2.13.78', port: 502, unitId: 5 },
  { id: "6", name: 'CHILLER-02', ip: '10.2.13.95', port: 502, unitId: 6 },
];

// --- AUTO ASSIGN line_name based on plc_id ---
PLCS.forEach(plc => {
  const plcIdNum = parseInt(plc.id);
  if (plcIdNum >= 1 && plcIdNum <= 3) {
    plc.line_name = "B1-01";
  } else if (plcIdNum >= 4 && plcIdNum <= 6) {
    plc.line_name = "B1-02";
  } else {
    plc.line_name = `UNKNOWN_LINE_${plc.id}`; // fallback untuk keamanan
  }
});


// --- TAG RANGES (tetap seperti sebelumnya) ---
PLCS.forEach(plc => {
  plc.tagRanges = {
    ...(plc.name.includes('BPM') ? {
      'data2|data3|data8|data9': { min: 80, max: 90 },
      'data4|data5|data6|data7': { min: 27, max: 30 },
    } : {}),
    ...(plc.name.includes('CHAMBER') ? {
      'data2|data3': { min: 75.7, max: 79 },
      'data4|data5': { min: 50.7, max: 54 },
      'data6|data7': { min: 51, max: 55 },
      'data8|data9': { min: 61, max: 64 },
    } : {}),
    ...(plc.name.includes('CHILLER') ? {
      'data2|data3': { min: 26, max: 29 }
    } : {}),
    'default': { min: 50, max: 55 }
  };
});


const DATA_POINTS_MAP = [];
const START_REGISTER = 5000;
const TOTAL_POINTS = 26;
const GLOBAL_DEFAULT_RANGE = { min: 0, max: 1 }; // Jika tidak ada konfigurasi spesifik
const HISTORY_WINDOW_MINUTES = 15;
const HISTORY_PROCESS_DELAY_MINUTES = 2; // tunda pemrosesan 2 menit
const POLLING_INTERVAL = 5000;  


for (let i = 0; i < TOTAL_POINTS; i++) {
    DATA_POINTS_MAP.push({
        tag_name: `data${i + 1}`,
        register: START_REGISTER + i,
        type: 'INT16',
        count: 1,
    });
}
module.exports = {
    PLCS,
    DATA_POINTS_MAP,
    POLLING_INTERVAL,
    GLOBAL_DEFAULT_RANGE,
    HISTORY_WINDOW_MINUTES,
    HISTORY_PROCESS_DELAY_MINUTES,
};
