import { NextResponse } from "next/server";
import { dbQuery } from "@/app/lib/db";

export async function PUT(
  req: Request,
  context: { params: Promise<{ model: string }> } // <- ubah jadi Promise
) {
  try {
    const { model } = await context.params; // <- harus di-await
    const { standards } = await req.json();

    if (!standards || standards.length === 0) {
      return NextResponse.json({ message: "No data to update." }, { status: 400 });
    }

    for (const s of standards) {
      const sql = `
        UPDATE standard 
        SET min_value = ?, max_value = ?
        WHERE model_id = ? AND parameter_name = ?
      `;
      const values = [s.min_value, s.max_value, model, s.parameter_name];
      await dbQuery(sql, values);
    }

    return NextResponse.json({ message: "Update success" }, { status: 200 });
  } catch (error) {
    console.error("Update error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
