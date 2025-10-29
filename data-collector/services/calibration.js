// services/calibration.js

const { evaluate } = require('mathjs'); 
const config = require('./sensor-config.json');

const sensorRegistry = config.sensorRegistry;
const kalibrasiConfigs = config.calibrationRules;

function calibrate(plc_id, tag_name, rawValue) {
  // 1. Temukan Tipe Sensor
  const sensorMapping = sensorRegistry.find(reg => 
    reg.plc_id === plc_id && reg.tag_name === tag_name
  );
  
  if (!sensorMapping) {
    // console.warn(`Sensor tidak terdaftar: ${plc_id}/${tag_name}`);
    return rawValue; // Kembalikan mentah
  }
  
  const sensorType = sensorMapping.sensor_type;
  const configs = kalibrasiConfigs[sensorType];

  // 2. Terapkan Kalibrasi Bertingkat (Stacking)
  const segmen = configs.find(config => 
    rawValue >= config.raw_min && rawValue < config.raw_max
  );

  if (!segmen) {
    // console.warn(`Rentang kalibrasi tidak ditemukan untuk ${sensorType} pada nilai ${rawValue}`);
    return rawValue; // Kembalikan mentah
  }
  
  // 3. Evaluasi Formula (mengganti 'x' dengan rawValue)
  const formulaTerformat = segmen.formula.replace(/x/g, rawValue);
  
  try {
    const calibratedValue = evaluate(formulaTerformat); 
    return calibratedValue;
  } catch (error) {
    console.error(`Error evaluasi formula untuk ${sensorType}: ${error.message}`);
    return rawValue; 
  }
}

module.exports = {
    calibrate
};