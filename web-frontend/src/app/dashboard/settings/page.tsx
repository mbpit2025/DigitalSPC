'use client'

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import PageBreadcrumb from "@/components/common/PageBreadCrumb"
import Button from "@/components/ui/button/Button"

// 📘 Tipe data untuk Model (sesuai struktur tabel Model)
export type Model = {
    model_id: number;
    model_name: string;
}

// 📘 Tipe data untuk struktur API eksternal yang baru
type CellInfo = Record<string, { model: string[], target: string }>;

const EXTERNAL_API_URL = 'http://10.2.11.4:6060/api/get_cell_information';

export default function SettingIndexPage() {
    const [models, setModels] = useState<Model[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // State baru untuk data sumber model eksternal
    const [externalModels, setExternalModels] = useState<string[]>([]);
    const [isExternalDataLoading, setIsExternalDataLoading] = useState(true);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newModelName, setNewModelName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fungsi untuk mengambil daftar model utama (dari database Anda)
    const fetchModels = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/models'); // Asumsi endpoint /api/models
            if (!response.ok) {
                throw new Error('Gagal mengambil data model.');
            }
            const data: Model[] = await response.json();
            setModels(data);
        } catch (err) {
            console.error(err);
            setError('Terjadi kesalahan saat memuat data model.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fungsi untuk mengambil dan memproses data dari API eksternal
    const fetchExternalModels = useCallback(async () => {
        setIsExternalDataLoading(true);
        try {
            const response = await fetch(EXTERNAL_API_URL);
            if (!response.ok) {
                throw new Error('Gagal mengambil data rekomendasi model.');
            }
            const cellInfo: CellInfo = await response.json();

            // Ekstraksi dan konsolidasi semua model dari semua B-XX
            const allModels = new Set<string>();
            Object.values(cellInfo).forEach(cell => {
                cell.model.forEach(model => {
                    allModels.add(model.toUpperCase());
                });
            });

            setExternalModels(Array.from(allModels).sort());
        } catch (err) {
            console.error("Error fetching external models:", err);
            // Tidak perlu setError global, karena ini hanya fitur tambahan
        } finally {
            setIsExternalDataLoading(false);
        }
    }, []);

    // Panggil fetchModels dan fetchExternalModels saat komponen dimuat
    useEffect(() => {
        fetchModels();
        fetchExternalModels();
    }, [fetchModels, fetchExternalModels]);


    const handleCreateModel = async (e: React.FormEvent) => {
        // ... (Logika handleCreateModel tetap sama)
        e.preventDefault();
        if (!newModelName.trim()) return;

        setIsSubmitting(true);
        setError(null);

        try {
            // Menggunakan /api/models sesuai endpoint CRUD yang kita rancang
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
            await fetchModels(); // Refresh daftar model
            alert(`Model ${newModelName.trim().toUpperCase()} berhasil ditambahkan!`);

        } catch (err: unknown) {
            console.error("Error creating model:", (err as Error).message);
            setError((err as Error).message);
            alert(`Gagal membuat model: ${(err as Error).message}`);
        } finally {
            setIsSubmitting(false);
        }
    };


    // 3. Render komponen
    return (
        <main className="flex flex-col gap-6">
            {/* ... Breadcrumb dan Daftar Model ... */}
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
                            <li key={model.model_id} className="py-4 flex justify-between items-center">
                                {/* ... Tampilan Model ... */}
                                <div>
                                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">{model.model_name}</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Klik untuk buka pengaturan standar model ini.
                                    </p>
                                </div>
                                <Link
                                    href={`/dashboard/settings/${model.model_name.toLowerCase()}`}
                                    className="text-brand-500 hover:underline font-semibold"
                                >
                                    Lihat Detail →
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* --- Modal Form Buat Model Baru --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm mx-auto shadow-xl">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Buat Model Baru</h3>
                        <form onSubmit={handleCreateModel}>
                            <div className="mb-4">
                                <label htmlFor="modelName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Nama Model (Contoh: U300, S400)
                                </label>
                                <input
                                    id="modelName"
                                    type="text"
                                    list="modelSuggestions" // 🔑 Kunci: Menghubungkan input dengan datalist
                                    value={newModelName}
                                    onChange={(e) => setNewModelName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    placeholder={isExternalDataLoading ? "Memuat saran..." : "Masukkan nama model"}
                                    required
                                />

                                {/* 🔑 Kunci: Datalist untuk menampilkan saran dari API eksternal */}
                                <datalist id="modelSuggestions">
                                    {externalModels.map((model) => (
                                        <option key={model} value={model} />
                                    ))}
                                </datalist>

                                {isExternalDataLoading && (
                                    <p className="text-xs text-gray-400 mt-1">Memuat saran model...</p>
                                )}

                            </div>
                            <div className="flex justify-end gap-3">
                                <Button 
                                    variant="primary" 
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Batal
                                </Button>
                                <Button 
                                    variant="outline" 
                                    disabled={isSubmitting}
                                    onClick={() => handleCreateModel}
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