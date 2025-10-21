export interface StandardParameter {
  keyMin: string;
  keyMax: string;
  category: string;
}

export const STANDARD_MAP: Record<string, StandardParameter[]> = {
  ME420: [
    // 🔥 Back Part Molding
    {
      keyMin: "HOT_TEMP_MIN",
      keyMax: "HOT_TEMP_MAX",
      category: "Back Part Molding",
    },
    {
      keyMin: "COLD_TEMP_MIN",
      keyMax: "COLD_TEMP_MAX",
      category: "Back Part Molding",
    },

    // 🌡️ Pre Heating
    {
      keyMin: "PR_UP_TEMP_MIN",
      keyMax: "PR_UP_TEMP_MAX",
      category: "Pre Heating",
    },
    {
      keyMin: "PR_OT_TEMP_MIN",
      keyMax: "PR_OT_TEMP_MAX",
      category: "Pre Heating",
    },

    // 🎨 Primer 1
    {
      keyMin: "PM1_UP_TEMP_MIN",
      keyMax: "PM1_UP_TEMP_MAX",
      category: "Primer 1",
    },
    {
      keyMin: "PM1_OT_TEMP_MIN",
      keyMax: "PM1_OT_TEMP_MAX",
      category: "Primer 1",
    },

    // 🎨 Primer 2
    {
      keyMin: "PM2_UP_TEMP_MIN",
      keyMax: "PM2_UP_TEMP_MAX",
      category: "Primer 2",
    },
    {
      keyMin: "PM2_OT_TEMP_MIN",
      keyMax: "PM2_OT_TEMP_MAX",
      category: "Primer 2",
    },

    // 🧴 Cementing
    {
      keyMin: "CM_UP_TEMP_MIN",
      keyMax: "CM_UP_TEMP_MAX",
      category: "Cementing",
    },
    {
      keyMin: "CM_OT_TEMP_MIN",
      keyMax: "CM_OT_TEMP_MAX",
      category: "Cementing",
    },

    // ❄️ Chiller
    {
      keyMin: "CH_UP_TEMP_MIN",
      keyMax: "CH_UP_TEMP_MAX",
      category: "Chiller",
    },
    {
      keyMin: "CH_OT_TEMP_MIN",
      keyMax: "CH_OT_TEMP_MAX", 
      category: "Chiller",
    },

    // ⚙️ Gauge Marking
    {
      keyMin: "GM_PRESS_MIN",
      keyMax: "GM_PRESS_MAX",
      category: "Gauge Marking",
    },
    {
      keyMin: "GM_TIME_MIN",
      keyMax: "GM_TIME_MAX",
      category: "Gauge Marking",
    },

    // 🧰 Universal Press
    {
      keyMin: "UP_PRESSURE_MIN",
      keyMax: "UP_PRESSURE_MAX",
      category: "Universal Press",
    },
    {
      keyMin: "UP_TIME_MIN",
      keyMax: "UP_TIME_MAX",
      category: "Universal Press",
    },
  ],
};
