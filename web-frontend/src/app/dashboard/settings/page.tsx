'use client';

import Link from "next/link";
import { useState, useMemo, useEffect, useCallback } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";

// 📘 Tipe data untuk Model
export type Model = {
  model_id: number;
  model_name: string;
};

// 📘 Tipe data untuk struktur API eksternal
type CellInfo = Record<string, { model: string[]; target: string }>;

const VALID_CHARS_REGEX = /^[A-Z0-9]*$/;
const MAX_MODEL_LENGTH = 20;

const EXTERNAL_API_URL = 'http://10.2.11.4:6060/api/get_cell_information';

export default function SettingIndexPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [externalModels, setExternalModels] = useState<string[]>([]);
  const [isExternalDataLoading, setIsExternalDataLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // ============================================================
  // 🧠 Fungsi: Validasi input
  // ============================================================
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    let value: string = e.target.value.toUpperCase();

    if (value === '' || VALID_CHARS_REGEX.test(value)) {
      setNewModelName(value);
      setValidationError('');
    } else {
      setValidationError('Hanya huruf (A-Z) dan angka (0-9) yang diizinkan.');
    }

    if (value.length > MAX_MODEL_LENGTH) {
      setValidationError(`Nama model terlalu panjang (maks ${MAX_MODEL_LENGTH} karakter).`);
    }
  };

  const isFormValid = useMemo(() => {
    const trimmedName = newModelName.trim();
    return trimmedName.length > 0 && VALID_CHARS_REGEX.test(trimmedName) && !isSubmitting;
  }, [newModelName, isSubmitting]);

  // ============================================================
  // 📡 Fetch data model utama
  // ============================================================
  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/models');
      if (!response.ok) throw new Error('Gagal mengambil data model.');
      const data: Model[] = await response.json();
      setModels(data);
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan saat memuat data model.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // 📡 Fetch data model eksternal
  // ============================================================
  const fetchExternalModels = useCallback(async () => {
    setIsExternalDataLoading(true);
    try {
      const response = await fetch(EXTERNAL_API_URL);
      if (!response.ok) throw new Error('Gagal mengambil data rekomendasi model.');
      const cellInfo: CellInfo = await response.json();

      const allModels = new Set<string>();
      Object.values(cellInfo).forEach(cell => {
        cell.model.forEach(model => allModels.add(model.toUpperCase()));
      });

      setExternalModels(Array.from(allModels).sort());
    } catch (err) {
      console.error("Error fetching external models:", err);
    } finally {
      setIsExternalDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
    fetchExternalModels();
  }, [fetchModels, fetchExternalModels]);

  // ============================================================
  // ➕ Fungsi: Tambah model
  // ============================================================
  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: newModelName.trim().toUpperCase() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal menambahkan model baru.');
      }

      setNewModelName('');
      setIsModalOpen(false);
      await fetchModels();
      alert(`✅ Model ${newModelName.trim().toUpperCase()} berhasil ditambahkan!`);
    } catch (err: unknown) {
      console.error("Error creating model:", (err as Error).message);
      setError((err as Error).message);
      alert(`❌ Gagal membuat model: ${(err as Error).message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================
  // 🗑️ Fungsi: Hapus model berdasarkan model_id
  // ============================================================
  const handleDeleteModel = async (model_id: number, model_name: string) => {
    if (!confirm(`Yakin ingin menghapus model "${model_name}"? Data standar juga akan ikut terhapus.`)) return;

    try {
      const response = await fetch(`/api/models/${model_id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Gagal menghapus model.');
      }

      alert(`🗑️ Model ${model_name} berhasil dihapus.`);
      await fetchModels(); // refresh list
    } catch (err) {
      console.error(err);
      alert(`❌ Terjadi kesalahan: ${(err as Error).message}`);
    }
  };

  // ============================================================
  // 🧱 Render
  // ============================================================
  return (
    <main className="flex flex-col gap-6">
      <PageBreadcrumb pageTitle="Standard Settings" />

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Daftar Model Standar
          </h1>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setError(null);
              setNewModelName('');
              setIsModalOpen(true);
            }}
          >
            Buat Model Baru
          </Button>
        </div>

        {error && (
          <div className="text-red-500 dark:text-red-400 p-3 bg-red-100 dark:bg-red-900 rounded-lg mb-4">
            🚨 Error: {error}
          </div>
        )}

        {isLoading ? (
          <p className="text-brand-500 animate-pulse">Memuat data model...</p>
        ) : models.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            Belum ada model standar. Klik tombol di atas.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {models.map((model) => (
              <li
                key={model.model_id}
                className="py-4 flex justify-between items-center"
              >
                <div>
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    {model.model_name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Klik untuk buka pengaturan standar model ini.
                  </p>
                </div>

                <div className="flex gap-3 items-center">
                  <Link
                    href={`/dashboard/settings/${model.model_name.toLowerCase()}`}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Lihat Detail →
                  </Link>
                  <button
                    onClick={() => handleDeleteModel(model.model_id, model.model_name)}
                    className="text-red-600 hover:text-red-800 font-semibold text-sm"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- Modal Tambah Model Baru --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm mx-auto shadow-xl">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Buat Model Baru
            </h3>
            <form onSubmit={handleCreateModel}>
              <div className="mb-6">
                <label
                  htmlFor="modelName"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Nama Model (Hanya A-Z dan 0-9)
                </label>
                <input
                  id="modelName"
                  type="text"
                  list="modelSuggestions"
                  value={newModelName}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-offset-0 transition-colors duration-150
                    ${validationError
                      ? 'border-red-500 ring-red-500 bg-red-50 dark:bg-gray-700'
                      : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-brand-500 focus:border-brand-500 dark:focus:ring-brand-400 dark:focus:border-brand-400'
                    } text-gray-900 dark:text-white uppercase`}
                  placeholder={isExternalDataLoading ? "Memuat saran..." : "Masukkan nama model"}
                  required
                  maxLength={MAX_MODEL_LENGTH}
                />

                {validationError && (
                  <p className="text-sm text-red-500 mt-1 flex items-center">
                    ⚠️ {validationError}
                  </p>
                )}

                <datalist id="modelSuggestions">
                  {externalModels.map((model) => (
                    <option key={model} value={model} />
                  ))}
                </datalist>

                {!isExternalDataLoading && externalModels.length > 0 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Saran tersedia dari data PWI.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Batal
                </Button>
                <Button
                  variant="primary"
                  onClick={()=>{handleCreateModel}}
                  disabled={!isFormValid || isSubmitting}
                >
                  {isSubmitting ? 'Memproses...' : 'Simpan Model'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
