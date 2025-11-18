export const PLCS = [
  { 
    id: "1",
    name: 'BPM01',
    ip: '10.2.13.74',
    port: 502,
    unitId: 1,
    tagRanges: [
      ["data2", "data3", "data8", "data9"],  // Group 1
      ["data4", "data5", "data6", "data7"],  // Group 2
    ]
  },

  { 
    id: "2",
    name: 'HEATING01',
    ip: '10.2.13.75',
    port: 502,
    unitId: 2,
    tagRanges: [
      ["data4", "data5"],     // primer1
      ["data6", "data7"],     // primer2
      ["data8", "data9"],     // cementing
    ]
  },

  { 
    id: "3",
    name: 'CHILLER01',
    ip: '10.2.13.76',
    port: 502,
    unitId: 1,
    tagRanges: [
      // tidak ada default, berarti semua data dianggap satu range
      ["data1","data2","data3","data4","data5","data6","data7","data8","data9"]
    ]
  },

  { 
    id: "4",
    name: 'BPM02',
    ip: '10.2.13.77',
    port: 502,
    unitId: 2,
    tagRanges: [
      ["data2", "data3", "data8", "data9"], // Group 1
      ["data4", "data5", "data6", "data7"], // Group 2
    ]
  },

  { 
    id: "5",
    name: 'HEATING02',
    ip: '10.2.13.78',
    port: 502,
    unitId: 2,
    tagRanges: [
      ["data4", "data5"],     // primer1
      ["data6", "data7"],     // primer2
      ["data8", "data9"],     // cementing
    ]
  },

  { 
    id: "6",
    name: 'CHILLER02',
    ip: '10.2.13.79',
    port: 502,
    unitId: 2,
    tagRanges: [
      ["data1","data2","data3","data4","data5","data6","data7","data8","data9"]
    ]
  }
];
