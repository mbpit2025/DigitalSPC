const { evaluate } = require('mathjs'); 
const config = require('./sensor-config.json');

const sensorRegistry = config.sensorRegistry;
const kalibrasiConfigs = config.calibrationRules;
const lookupTables = config.lookupTables || {};

/**
 * Fungsi Interpolasi Linear
 */
function interpolate(x, x1, y1, x2, y2) {
  // mengatasi pembagian 0
  if (x2 - x1 === 0) return y1;
  return y1 + ( (x - x1) * (y2 - y1) / (x2 - x1) );
}

/**
 * Lookup Table Converter
 */
function lookupConvert(sensorType, rawValue) {
  const table = lookupTables[sensorType];
  if (!table || table.length === 0) return null;

  // Urutkan berdasarkan nilai sensor kecil → besar
  const sorted = [...table].sort((a, b) => a.sensor - b.sensor);

  // Jika di bawah range
  if (rawValue <= sorted[0].sensor) return sorted[0].temp;

  // Jika di atas range
  if (rawValue >= sorted[sorted.length - 1].sensor) {
    return sorted[sorted.length - 1].temp;
  }

  // Cari dua titik terdekat
  for (let i = 0; i < sorted.length - 1; i++) {
    const low = sorted[i];
    const high = sorted[i + 1];

    if (rawValue >= low.sensor && rawValue <= high.sensor) {
      return Math.round(interpolate(
        rawValue, 
        low.sensor, low.temp, 
        high.sensor, high.temp
      ));
    }
  }

  return null;
}


/**
 * Fungsi Utama Kalibrasi
 */
function calibrate(plc_id, tag_name, rawValue) {
  const sensorMapping = sensorRegistry.find(reg => 
    reg.plc_id == plc_id && reg.tag_name == tag_name
  );

  if (!sensorMapping) return rawValue;

  const sensorType = sensorMapping.sensor_type;

  // ✅ 1. Coba lookup dulu
  const lookupResult = lookupConvert(sensorType, rawValue);
  if (lookupResult !== null) {
    return lookupResult;
  }

  // ✅ 2. Jika tidak ada lookup, fallback ke formula lama
  const configs = kalibrasiConfigs[sensorType];
  if (!configs) return rawValue;

  const segmen = configs.find(conf => 
    rawValue >= conf.raw_min && rawValue < conf.raw_max
  );

  if (!segmen) return rawValue;

  // ganti x dengan rawValue lalu hitung
  const formulaTerformat = segmen.formula.replace(/x/g, rawValue);

  try {
    const calibratedValue = evaluate(formulaTerformat); 
    return calibratedValue;
  } catch (error) {
    return rawValue;
  }
}

module.exports = { calibrate };
