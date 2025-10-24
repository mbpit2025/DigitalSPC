// 📁 src/app/dashboard/settings/[model]/SettingLineClient.tsx
'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import PageBreadcrumb from '@/components/common/PageBreadCrumb';
import Select from '@/components/form/Select';
import StdTable from '@/components/tables/StdTable';
import Button from '@/components/ui/button/Button';
import { PlusIcon } from '@/icons';

// --- Definisi Tipe Data (Disederhanakan untuk Komponen) ---
export type StandardLimit = { [key: string]: number };
export type StandardsData = Record<string, StandardLimit>; // { "U204": { "HOT_TEMP_MIN": 80, ... } }

export type Model = {
    model_id: number;
    model_name: string;
}

// Tipe data untuk satu baris standar dari API
export type StandardRow = {
    parameter_name: string;
    min_value: number;
    max_value: number;
}

// Data Default (tetap digunakan untuk model baru di frontend)
const DEFAULT_NEW_MODEL: StandardLimit = {
    HOT_TEMP_MIN: 0, HOT_TEMP_MAX: 100,
    COLD_TEMP_MIN: 0, COLD_TEMP_MAX: 30,
    PR_UP_TEMP_MAX: 90, PR_UP_TEMP_MIN: 60,
    PR_OT_TEMP_MAX: 90, PR_OT_TEMP_MIN: 40,
    PM1_UP_TEMP_MAX: 90, PM1_UP_TEMP_MIN: 70,
    PM1_OT_TEMP_MAX: 80, PM1_OT_TEMP_MIN: 30,
    PM2_UP_TEMP_MAX: 80, PM2_UP_TEMP_MIN: 60,
    PM2_OT_TEMP_MAX: 70, PM2_OT_TEMP_MIN: 20,
    CM_UP_TEMP_MAX: 60, CM_UP_TEMP_MIN: 50,
    CM_OT_TEMP_MAX: 90, CM_OT_TEMP_MIN: 40,
    CH_UP_TEMP_MAX: 10, CH_UP_TEMP_MIN: 0,
    CH_OT_TEMP_MAX: 10, CH_OT_TEMP_MIN: 0,
    GM_PRESS_MAX: 30, GM_PRESS_MIN: 20,
    GM_TIME_MAX: 30, GM_TIME_MIN: 10,
    UP_PRESSURE_MAX: 40, UP_PRESSURE_MIN: 30,
    UP_TIME_MAX: 14, UP_TIME_MIN: 12,
};


export default function SettingLineClient({ model }: { model: string }) {
    // 1. State Data dan Status
    const [standardData, setStandardData] = useState<StandardsData>({});
    const [modelList, setModelList] = useState<Model[]>([]); // Menyimpan daftar model dari API
    const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});
    
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const [selectedModelId, setSelectedModelId] = useState<string>('');
    const [initialAlert, setInitialAlert] = useState<string | null>(null);

    // 2. Fungsi Pengambilan Data Utama (Standards Data Fetching)
    const fetchStandardsData = useCallback(async (initialModelName: string) => {
        setIsLoading(true);
        setFetchError(null);
        try {
            // A. Ambil daftar model
            const modelRes = await fetch('/api/models'); 
            if (!modelRes.ok) throw new Error('Gagal mengambil daftar model.');
            const models: Model[] = await modelRes.json();
            setModelList(models);

            if (models.length === 0) return;

            // B. Ambil semua standar (Contoh menggunakan Promise.all untuk efisiensi)
            const standardsPromises = models.map(async (m) => {
                // Asumsi endpoint untuk mengambil standar berdasarkan model ID
                const standardsRes = await fetch(`/api/models/${m.model_id}/standards`); 
                if (!standardsRes.ok) throw new Error(`Gagal mengambil standar untuk ${m.model_name}`);
                const rows: StandardRow[] = await standardsRes.json();
                
                // Konversi rows menjadi format StandardLimit (JSON style)
                const limits: StandardLimit = rows.reduce((acc, row) => {
                    acc[`${row.parameter_name}_MIN`] = row.min_value;
                    acc[`${row.parameter_name}_MAX`] = row.max_value;
                    return acc;
                }, {} as StandardLimit);

                return { modelName: m.model_name, limits };
            });

            const allStandards = await Promise.all(standardsPromises);
            
            // Konversi menjadi StandardsData
            const newStandardData: StandardsData = allStandards.reduce((acc, item) => {
                acc[item.modelName] = item.limits;
                return acc;
            }, {} as StandardsData);

            setStandardData(newStandardData);

            // C. Tentukan Model yang dipilih berdasarkan URL
            const modelsName = Object.keys(newStandardData);
            const desiredModelId = initialModelName?.toUpperCase();
            const isModelFound = modelsName.includes(desiredModelId);
            const fallbackModel = modelsName[0] || '';

            if (isModelFound) {
                setSelectedModelId(desiredModelId);
            } else {
                setSelectedModelId(fallbackModel);
                if (initialModelName) {
                    setInitialAlert(`Model dengan ID '${initialModelName}' tidak ditemukan. Menggunakan model default: ${fallbackModel}.`);
                }
            }
            
        } catch (error: unknown) {
            console.error("Error fetching data:", (error as Error).message);
            setFetchError(`Gagal memuat data standar dari server: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    // 3. Effect untuk memuat data saat komponen mount
    useEffect(() => {
        fetchStandardsData(model);
    }, [fetchStandardsData, model]);

    // Effect untuk menampilkan alert
    useEffect(() => {
        if (initialAlert) {
            alert(initialAlert);
            setInitialAlert(null); 
        }
    }, [initialAlert]);


    // 4. Memoized Values (seperti sebelumnya, tapi menggunakan state yang benar)
    const modelOptions = useMemo(
        () => Object.keys(standardData).map(key => ({ label: key, value: key })),
        [standardData]
    );

    const currentStandard = useMemo(
        () => standardData[selectedModelId] || DEFAULT_NEW_MODEL,
        [standardData, selectedModelId]
    );


    // 5. Handlers (diperbaiki jika perlu)
    
    const handleSelectModel = useCallback(
        (value: string): void => {
            if (Object.keys(dirtyKeys).length > 0) {
                const confirmChange = confirm(
                    "Perubahan belum disimpan. Yakin ingin berpindah model?"
                );
                if (!confirmChange) return;
                setDirtyKeys({});
            }
            setSelectedModelId(value);
        },
        [dirtyKeys]
    );

    const handleUpdateStandardValue = useCallback(
        (key: keyof StandardLimit, value: number | null) => {
            if (value === null || isNaN(value)) return;
            setStandardData(prev => ({
                ...prev,
                [selectedModelId]: {
                    ...prev[selectedModelId],
                    [key]: value,
                },
            }));
            setDirtyKeys(prev => ({ ...prev, [key]: true }));
        },
        [selectedModelId]
    );

    const handleCreateModel = useCallback(() => {
        // NOTE: Idealnya, ini harus memanggil POST /api/models dan POST /api/standards
        alert('Fungsionalitas "Buat Model Baru" perlu diimplementasikan untuk API POST!');
        // Untuk saat ini, kita hanya akan memanggil fetchStandardsData untuk me-refresh
        // fetchStandardsData(model); 
    }, []);

    const handleSaveRow = useCallback(
        async (keyMin: keyof StandardLimit, keyMax: keyof StandardLimit) => {
            // Cari model_id berdasarkan selectedModelId (model_name)
            const selectedModel = modelList.find(m => m.model_name === selectedModelId);
            if (!selectedModel) {
                alert("❌ Gagal menyimpan: Model ID tidak ditemukan di daftar model. Coba refresh.");
                return;
            }

            const valueMin = standardData[selectedModelId][keyMin];
            const valueMax = standardData[selectedModelId][keyMax];
            
            // Ekstrak nama parameter (misal: 'HOT_TEMP_MIN' menjadi 'HOT_TEMP')
            const parameterName = String(keyMin).split('_').slice(0, -1).join('_');


            // Kunci: Kirim model_id, nama parameter, dan kedua nilai min/max
            const payload = {
                model_id: selectedModel.model_id,
                parameter_name: parameterName,
                min_value: valueMin,
                max_value: valueMax,
            };

            try {
                console.log("🔄 Mengirim pembaruan ke API:", payload);
                // ⚠️ Asumsi endpoint PUT /api/standards menerima payload ini
                const res = await fetch("/api/standards", { 
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Gagal menyimpan data");

                // Bersihkan status dirty key
                setDirtyKeys(prev => {
                    const newKeys = { ...prev };
                    delete newKeys[keyMin];
                    delete newKeys[keyMax];
                    return newKeys;
                });

                alert(`✅ Parameter ${parameterName} berhasil disimpan.`);
            } catch (err: unknown) {
                console.error(err);
                alert(`❌ Gagal menyimpan perubahan ke server: ${(err as Error).message}`);
            }
        },
        [selectedModelId, standardData, modelList]
    );

    // 6. Tampilan Loading dan Error
    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 p-8 items-center justify-center min-h-[50vh]">
                <p className="text-xl text-brand-500 animate-pulse">Memuat data standar dari server...</p>
                {fetchError && <p className="text-red-500 mt-4">Error: {fetchError}</p>}
            </div>
        );
    }
    
    // 7. Render Komponen Utama
    return (
        <div className="flex flex-col gap-4">
            {/* ... (JSX seperti sebelumnya) ... */}
            <PageBreadcrumb pageTitle="Standard Setting" />

            <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="p-8">
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Model Settings</h1>

                    <div className="flex justify-between items-center mt-6">
                        <h2 className="text-gray-900 dark:text-white px-4">
                            Line ID: <br /> <span className="text-2xl text-brand-500">{model}</span>
                        </h2>

                        <h2 className="text-gray-900 dark:text-white px-4 py-8">
                            Standard Model: <br />
                            <span className="text-2xl text-brand-500">{selectedModelId}</span>
                            {Object.keys(dirtyKeys).length > 0 && (
                                <span className="text-sm text-red-500 ml-2">(Belum disimpan)</span>
                            )}
                        </h2>

                        <div className="flex items-center gap-4 w-80">
                            <Select
                                options={modelOptions}
                                placeholder="Pilih Model"
                                onChange={handleSelectModel}
                                value={selectedModelId}
                                className="dark:bg-dark-900"
                            />
                            <Button onClick={handleCreateModel}>
                                <PlusIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {selectedModelId ? (
                        <StdTable
                            modelId={selectedModelId}
                            standard={currentStandard}
                            onUpdate={handleUpdateStandardValue}
                            onSaveRow={handleSaveRow}
                            isDirty={dirtyKeys}
                        />
                    ) : (
                        <p className="mt-8 text-center text-gray-500 dark:text-gray-400">
                            Pilih model untuk mulai mengedit standar.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}