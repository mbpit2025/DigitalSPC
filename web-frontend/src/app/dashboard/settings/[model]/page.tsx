import { dbQuery } from '@/app/lib/db';
import SettingLineClient from '@/components/SettingLineClient';
import { notFound } from 'next/navigation';

export default async function SettingLinePage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params; // model di URL → ex: u204, bpm01, dll

  if (!model) {
    notFound();
  }

  try {
    // Cek apakah model valid, ambil model_id juga
    const sql = `SELECT model_id, model_name FROM model WHERE model_name = ?`;
    const results = await dbQuery(sql, [model]);

    if (!results || results.length === 0) {
      notFound();
    }

    const { model_id, model_name } = results[0] as  { model_id: string; model_name: string };

    // Kirim model_id dan model_name ke komponen client
    return <SettingLineClient modelId={model_id} modelName={model_name} />;
  } catch (error) {
    console.error('Database error in model page:', error);
    notFound();
  }
}
