// 📁 src/app/dashboard/settings/[model]/page.tsx
import SettingLineClient from "@/components/SettingLineClient";

export default async function SettingLinePage({ params }: { params: Promise<{ model: string }> }) {
  const { model } = await params; // ✅ OK di server component
  return <SettingLineClient model={model} />; // ✅ Kirim ke komponen client
}
