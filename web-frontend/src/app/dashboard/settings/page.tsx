'use client'

import Link from "next/link"
import PageBreadcrumb from "@/components/common/PageBreadCrumb"
import standards from "@/data/standards.json";

// 📘 Tipe data model (sesuai struktur di data.json kamu)
export type StandardLimit = Record<string, number>;
export type StandardsData = Record<string, StandardLimit>;

export default function SettingIndexPage() {

  const models = Object.keys(standards);

  return (
    <main className="flex flex-col gap-6">
      <PageBreadcrumb pageTitle="Standard Settings" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Daftar Model Standar
        </h1>

        {models.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Belum ada model standar.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {models.map((modelId) => (
              <li key={modelId} className="py-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">{modelId}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Klik untuk buka pengaturan standar model ini.
                  </p>
                </div>
                <Link
                  href={`/dashboard/settings/${modelId.toLowerCase()}`}
                  className="text-brand-500 hover:underline font-semibold"
                >
                  Lihat Detail →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
