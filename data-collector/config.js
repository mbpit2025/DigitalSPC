// data-collector/config.js


// Definisi 6 PLC (Minimalis)
const PLCS = [
    { 
      id: "1", name: 'BPM_LINE_1', ip: '10.2.13.74', port: 502, unitId: 1, 
      tagRanges: {
          // Range 1: Diterapkan ke data1, data2, data3
          'data2|data3|data8|data9': { min: 80, max: 90 }, 
          // Range 2: Diterapkan ke data4, data5, data6
          'data4|data5|data6|data7': { min: 27, max: 30 }, 
          // Range Default jika tidak ada yang cocok
          'default': { min: 50, max: 55 }
      } 
    },
    { 
      id: "2", name: 'HEATING_LINE_1', ip: '10.2.13.75', port: 5000, unitId: 2,
      tagRanges: {
          'data4|data5': { min: 50.7, max: 54 }, // primer1
          'data6|data7': { min: 51, max: 55 }, //primer2 
          'data8|data9': { min: 61, max: 64 }, // cementing
          'default': { min: 75, max: 77 }
      } 
    },
    { id: "3", name: 'CHILLER_LINE_1', ip: '10.2.13.76', port: 502, unitId: 1,
        tagRanges: {
          'default': { min: 26, max: 29 }
      }
    },
    { id: "4", name: 'BPM_LINE_2', ip: '10.2.13.77', port: 502, unitId: 2,
              tagRanges: {
          // Range 1: Diterapkan ke data1, data2, data3
          'data2|data3|data8|data9': { min: 80, max: 90 }, 
          // Range 2: Diterapkan ke data4, data5, data6
          'data4|data5|data6|data7': { min: 15, max: 25 }, 
          // Range Default jika tidak ada yang cocok
          'default': { min: 50, max: 55 }
      } 
     },
    { id: "5", name: 'HEATING_LINE_2', ip: '10.2.13.78', port: 502, unitId: 2,
      tagRanges: {
          'data4|data5': { min: 50.5, max: 54.8 }, // primer1
          'data6|data7': { min: 51, max: 55 }, //primer2 
          'data8|data9': { min: 60.5, max: 64 }, // cementing
          'default': { min: 73, max: 78 }
      } 
     },
    { id: "6", name: 'CHILLER_LINE_2', ip: '10.2.13.79', port: 502, unitId: 2,
        tagRanges: {
          'default': { min: 26, max: 29 }
      }
     },
];


const DATA_POINTS_MAP = [];
const START_REGISTER = 5000;
const TOTAL_POINTS = 25;
const GLOBAL_DEFAULT_RANGE = { min: 50, max: 55 }; // Jika tidak ada konfigurasi spesifik

for (let i = 0; i < TOTAL_POINTS; i++) {
    DATA_POINTS_MAP.push({
        tag_name: `data${i + 1}`,
        register: START_REGISTER + i,
        type: 'INT16',
        count: 1,
    });
}

// Interval Polling (dalam milidetik)
const POLLING_INTERVAL = 20000; // 5 detik

module.exports = {
    PLCS,
    DATA_POINTS_MAP,
    POLLING_INTERVAL,
    GLOBAL_DEFAULT_RANGE, 
};
