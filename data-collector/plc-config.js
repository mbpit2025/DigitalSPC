// plc-config.js

// --- MODBUS REGISTERS & DATA POINTS ---
const START_REGISTER = 5000;
// Jumlah Register (Sesuai dengan jumlah DATA_POINTS_MAP)
const REGISTER_COUNT = 9; 

const DATA_POINTS_MAP = [
    { tag_name: "data1", alias_base: "Speed Conveyor" }, 
    { tag_name: "data2", alias_base: "Hot 1" }, 
    { tag_name: "data3", alias_base: "Hot 2" },
    { tag_name: "data4", alias_base: "Cold 1" },
    { tag_name: "data5", alias_base: "Cold 2" },
    { tag_name: "data6", alias_base: "Cold 3 " },
    { tag_name: "data7", alias_base: "Cold 4" },
    { tag_name: "data8", alias_base: "Hot 3" },
    { tag_name: "data9", alias_base: "Hot 4" },
];

// --- PLC CONFIGURATION ---
const PLCS_CONFIG = [
    { name: "PLC_A", ip: "10.2.13.74", port: 5000, unitId: 1, startRegister: START_REGISTER, count: REGISTER_COUNT },
    { name: "PLC_B", ip: "10.2.13.75", port: 5000, unitId: 2, startRegister: START_REGISTER, count: REGISTER_COUNT },
    { name: "PLC_C", ip: "10.2.13.76", port: 5000, unitId: 3, startRegister: START_REGISTER, count: REGISTER_COUNT },
    { name: "PLC_D", ip: "10.2.13.77", port: 5000, unitId: 4, startRegister: START_REGISTER, count: REGISTER_COUNT },
    { name: "PLC_E", ip: "10.2.13.78", port: 5000, unitId: 5, startRegister: START_REGISTER, count: REGISTER_COUNT },
    { name: "PLC_F", ip: "10.2.13.95", port: 5000, unitId: 6, startRegister: START_REGISTER, count: REGISTER_COUNT },
];

// --- APP SETTINGS ---
module.exports = {
    DATA_POINTS_MAP,
    PLCS_CONFIG,
    API_PORT: 3005,
    POLLING_INTERVAL_MS: 1000,       // Interval polling (1 detik)
    CONNECTION_TIMEOUT_MS: 5000,     // Timeout koneksi Modbus (5 detik)
    DELAY_BETWEEN_PLCS_MS: 200,      // Jeda antar polling PLC (0.2 detik)
};