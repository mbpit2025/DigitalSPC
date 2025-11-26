import { NextResponse } from "next/server";
import { dbQuery } from "@/app/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ period:  "daily" | "weekly" | "monthly" }> }
) {
  const { period } = await params; // tidak perlu await
  const search = new URL(request.url).searchParams;

  const category = search.get("cat");
  const tagsParam = search.get("tags");

  if (!tagsParam)
    return NextResponse.json({ error: "tags required" }, { status: 400 });

  const tags = tagsParam.split(",");

  // ======================================
  // 🔎 Filter category (aman + fleksibel)
  // ======================================
  const allowCategory = ["BPM", "CHAMBER", "CHILLER"];
  let categorySQL = "";
  const categoryParams: string[] = [];

  if (category && allowCategory.includes(category.toUpperCase())) {
    categorySQL = `AND p.name LIKE ?`;
    categoryParams.push(category.toUpperCase() + "%");
  }

  // ======================================
  // 📌 Base SQL berdasarkan period
  // ======================================
  let sql = "";
  switch (period) {
    case "daily":
      sql = `
        SELECT p.name AS plc_name, h.tag_name, HOUR(h.start_time) AS hour,
               MAX(h.avg_value) AS value
        FROM plc_history h
        JOIN plcs p ON h.plc_id = p.plc_id
        WHERE h.tag_name IN (${tags.map(() => "?").join(",")})
          AND DATE(h.start_time) = CURDATE()
          ${categorySQL}
        GROUP BY p.name, h.tag_name, hour
        ORDER BY hour ASC;
      `;
      break;

    case "weekly":
      sql = `
        SELECT p.name AS plc_name, h.tag_name, DATE(h.start_time) AS day,
               FLOOR(HOUR(h.start_time)/3) AS range_3,
               MAX(h.avg_value) AS value
        FROM plc_history h
        JOIN plcs p ON h.plc_id = p.plc_id
        WHERE h.tag_name IN (${tags.map(() => "?").join(",")})
          AND h.start_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
          ${categorySQL}
        GROUP BY p.name, h.tag_name, day, range_3
        ORDER BY day ASC, range_3 ASC;
      `;
      break;

    case "monthly":
      sql = `
        SELECT p.name AS plc_name, h.tag_name, DATE(h.start_time) AS day,
               AVG(h.avg_value) AS value
        FROM plc_history h
        JOIN plcs p ON h.plc_id = p.plc_id
        WHERE h.tag_name IN (${tags.map(() => "?").join(",")})
          AND MONTH(h.start_time) = MONTH(CURDATE())
          ${categorySQL}
        GROUP BY p.name, h.tag_name, day
        ORDER BY day ASC;
      `;
      break;

    default:
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  // ======================================
  // ⛑️ Eksekusi Query dengan parameter binding
  // ======================================
  try {
    const params = [...tags, ...categoryParams]; // gabung params
    const result = await dbQuery(sql, params);
    return NextResponse.json(result);
  } catch (err) {
    console.error("❌ Query Error:", err);
    return NextResponse.json(
      { error: "Query failed: " + (err as Error).message },
      { status: 500 }
    );
  }
}
