import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { modelId, keyMin, keyMax, valueMin, valueMax } = body;

    if (!modelId || !keyMin || !keyMax)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    // 📄 Path absolut ke standards.json
    const filePath = path.join(process.cwd(), "src", "data", "standards.json");

    // 📖 Baca isi file JSON
    const fileData = await fs.readFile(filePath, "utf-8");
    const json = JSON.parse(fileData);

    // Pastikan model ada
    if (!json[modelId]) {
      json[modelId] = {};
    }

    // Update nilai di model
    json[modelId][keyMin] = valueMin;
    json[modelId][keyMax] = valueMax;

    // 💾 Tulis kembali ke file JSON
    await fs.writeFile(filePath, JSON.stringify(json, null, 2));

    return NextResponse.json({ success: true, updated: { modelId, keyMin, keyMax } });
  } catch (error: unknown) {
    console.error("Error updating standards.json:", error);
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
