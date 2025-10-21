// 📁 src/app/dashboard/settings/[model]/SettingLineClient.tsx
'use client';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import PageBreadcrumb from '@/components/common/PageBreadCrumb';
import Select from '@/components/form/Select';
import StdTable from '@/components/tables/StdTable';
import Button from '@/components/ui/button/Button';
import { PlusIcon } from '@/icons';
import STANDARDS_DATA from '@/data/standards.json';

// --- Definisi Tipe dan Data Tiruan (Mock) ---
export type StandardLimit = { [key: string]: number };
export type StandardsData = Record<string, StandardLimit>;

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
  const [standardData, setStandardData] = useState<StandardsData>(STANDARDS_DATA as StandardsData);
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});

  const [initialSelectedModel, initialAlert] = useMemo((): [string, string | null] => {
    const models = Object.keys(standardData);
    const desiredModelId = model?.toUpperCase();
    const isModelFound = models.includes(desiredModelId);
    const fallbackModel = models[0] || '';

    if (isModelFound) return [desiredModelId, null];

    let alertMessage: string | null = null;
    if (model && !isModelFound) {
      alertMessage = `Model dengan ID '${model}' tidak ditemukan. Menggunakan model default: ${fallbackModel}.`;
    } else if (!model) {
      alertMessage = `Tidak ada Model ID di URL. Menggunakan model default: ${fallbackModel}.`;
    }

    return [fallbackModel, alertMessage];
  }, [model, standardData]);

  const [selectedModelId, setSelectedModelId] = useState<string>(initialSelectedModel);

  useEffect(() => {
    if (initialAlert) alert(initialAlert);
  }, [initialAlert]);

  const modelOptions = useMemo(
    () => Object.keys(standardData).map(key => ({ label: key, value: key })),
    [standardData]
  );

  const currentStandard = useMemo(
    () => standardData[selectedModelId] || DEFAULT_NEW_MODEL,
    [standardData, selectedModelId]
  );

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
    const newModelId = prompt('Masukkan nama Model baru (cth: AB500):');
    if (!newModelId) return;
    if (standardData[newModelId]) {
      alert(`Model ${newModelId} sudah ada.`);
      return;
    }
    const newStandard = JSON.parse(JSON.stringify(DEFAULT_NEW_MODEL));
    setStandardData(prev => ({ ...prev, [newModelId]: newStandard }));
    setSelectedModelId(newModelId);
    setDirtyKeys({});
    alert(`Model ${newModelId} berhasil dibuat!`);
  }, [standardData]);

    const handleSaveRow = useCallback(
    async (keyMin: keyof StandardLimit, keyMax: keyof StandardLimit) => {
        const valueMin = standardData[selectedModelId][keyMin];
        const valueMax = standardData[selectedModelId][keyMax];

        const payload = {
        modelId: selectedModelId,
        keyMin,
        keyMax,
        valueMin,
        valueMax,
        };

        try {
        console.log("🔄 Mengirim pembaruan ke API:", payload);
        const res = await fetch("/api/standards/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menyimpan data");

        // Bersihkan status dirty key
        setDirtyKeys(prev => {
            const newKeys = { ...prev };
            delete newKeys[keyMin];
            delete newKeys[keyMax];
            return newKeys;
        });

        alert(`✅ Parameter ${keyMin} & ${keyMax} berhasil disimpan ke database standards`);
        } catch (err) {
        console.error(err);
        alert("❌ Gagal menyimpan perubahan ke server.");
        }
    },
    [selectedModelId, standardData]
    );


  return (
    <div className="flex flex-col gap-4">
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
