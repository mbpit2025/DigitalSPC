"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic"; // Import dynamic
import Button from "@/components/ui/button/Button";
import LineInfo from "@/components/dashboard/LineInfo";
import { useProductionSettings } from "@/hooks/useProductionSettings";

// ----------------------------------------------------
// 1. Dynamic Imports untuk Komponen yang Berbasis Browser (Charts & Cards)
// ----------------------------------------------------

// Komponen Cards
const BPMCard = dynamic(() => import("@/components/cards/BpmCards").then(mod => mod.BPMCard), { ssr: false });
const PreHeatCard = dynamic(() => import("@/components/cards/PreheatCards").then(mod => mod.PreHeatCard), { ssr: false });
const Primer1Card = dynamic(() => import("@/components/cards/Primer1Card").then(mod => mod.Primer1Card), { ssr: false });
const Primer2Card = dynamic(() => import("@/components/cards/Primer2Card").then(mod => mod.Primer2Card), { ssr: false });
const CementingCard = dynamic(() => import("@/components/cards/Cementing").then(mod => mod.CementingCard), { ssr: false });
const UniversalCard = dynamic(() => import("@/components/cards/UniversalCard").then(mod => mod.UniversalCard), { ssr: false });
const ChillerCard = dynamic(() => import("@/components/cards/ChillerCard").then(mod => mod.ChillerCard), { ssr: false });
const GaugeCard2 = dynamic(() => import("@/components/cards/GaugeCard2").then(mod => mod.GaugeCard2), { ssr: false });


// Komponen Charts
const ChartBPM = dynamic(() => import("@/components/charts/line/ChartBPM").then(mod => mod.ChartBPM), { ssr: false });
const ChartPreheat = dynamic(() => import("@/components/charts/line/ChartPreheat").then(mod => mod.ChartPreheat), { ssr: false });
const ChartPrimer1 = dynamic(() => import("@/components/charts/line/ChartPrimer1").then(mod => mod.ChartPrimer1), { ssr: false });
const ChartPrimer2 = dynamic(() => import("@/components/charts/line/ChartPrimer2").then(mod => mod.ChartPrimer2), { ssr: false });
const ChartCementing = dynamic(() => import("@/components/charts/line/ChartCementing").then(mod => mod.ChartCementing), { ssr: false });
const ChartChiller = dynamic(() => import("@/components/charts/line/ChartChiller").then(mod => mod.ChartChiller), { ssr: false });


export default function Dashboard() {
    const [selectedCell, setSelectedCell] = useState<'B1-01' | 'B1-02'>('B1-01');
    
    // 1. TAMBAHKAN STATE UNTUK MODEL YANG DIPILIH
    const [selectedModel, setSelectedModel] = useState<string | null>(null);

    // 2. INTEGRASIKAN HOOK SETTINGS
    // CATATAN: Pastikan useProductionSettings TIDAK mengakses 'window' di luar useEffect.
    const { data, loading, error } = useProductionSettings();


    // 3. LOGIKA UNTUK MENENTUKAN MODEL DEFAULT
    useEffect(() => {
        // Hanya atur model default jika data settings sudah dimuat dan selectedModel masih null
        if (data && selectedModel === null) {
            const currentLineData = data[selectedCell];
            if (currentLineData && currentLineData.model.length > 0) {
                // Atur model pertama dari line yang dipilih sebagai default
                setSelectedModel(currentLineData.model[0]);
            }
        }
    }, [data, selectedCell, selectedModel]);


    // 4. LOGIKA UNTUK MERESET MODEL SAAT CELL BERUBAH
    useEffect(() => {
        if (data && selectedCell) {
            const newCellData = data[selectedCell];
            // Jika cell baru memiliki model, set model pertama sebagai default
            if (newCellData && newCellData.model.length > 0) {
                setSelectedModel(newCellData.model[0]);
            } else {
                setSelectedModel(null);
            }
        }
    }, [data, selectedCell]); // Jalankan ini ketika selectedCell berubah



    // Helper untuk menentukan varian tombol yang aktif (Tidak Berubah)
    const getButtonVariant = (cellName: 'B1-01' | 'B1-02') => 
        selectedCell === cellName ? 'primary' : 'outline';


    // Tampilkan loading jika data settings belum siap
    if (loading || selectedModel === null) {
        return (
            <div className="p-10 text-center text-lg text-gray-500 dark:text-gray-400">
                Loading Dashboard Configuration...
            </div>
        );
    }
    
    // Tampilkan error jika gagal fetch settings
    if (error) {
           return (
             <div className="p-10 text-center text-red-500 bg-red-100 rounded-xl">
                 Error loading settings: {error.message}
             </div>
         );
    }

    return (
        <div className="grid grid-cols-12 gap-2 md:gap-6">
            <div className="col-span-12 flex xl:col-span-12 bg-gray-200 dark:bg-gray-950 p-2 gap-2 rounded-xl">
                {/* Tombol Cell 1 */}
                <Button 
                    size="sm" 
                    variant={getButtonVariant('B1-01')} 
                    className="w-60"
                    onClick={() => setSelectedCell('B1-01')} 
                >
                    B1-01
                </Button>
                {/* Tombol Cell 2 */}
                <Button 
                    size="sm" 
                    variant={getButtonVariant('B1-02')} 
                    className="w-60"
                    onClick={() => setSelectedCell('B1-02')} 
                >
                    B1-02
                </Button>
            </div>

            {/* LINE DASHBOARD INFO */}
            {/* Component LineInfo tidak perlu dynamic import kecuali memiliki masalah yang sama */}
            <LineInfo 
                selectedLineName={selectedCell} 
                selectedModel={selectedModel} 
                onModelChange={setSelectedModel}
            />

            {/* CARD COMPONENTS (Sekarang menggunakan Dynamic Imports) */}
            <div className="col-span-12 grid sm:grid-cols-2 grid-cols-4 md:grid-cols-8 gap-4">
                <BPMCard selectedCell={selectedCell} selectedModel={selectedModel} title="Back Part Molding"/>

                <PreHeatCard selectedCell={selectedCell} selectedModel={selectedModel} title="Pre Heating" />       

                <GaugeCard2 selectedCell={selectedCell} selectedModel={selectedModel} title="Gauge Marking"/>

                <Primer1Card selectedCell={selectedCell} selectedModel={selectedModel} title="Primer 1"/>

                <Primer2Card selectedCell={selectedCell} selectedModel={selectedModel} title="Primer 2"/>

                <CementingCard selectedCell={selectedCell} selectedModel={selectedModel} title="Cementing"/>

                <UniversalCard selectedCell={selectedCell} selectedModel={selectedModel} title="Cementing"/>

                <ChillerCard selectedCell={selectedCell} selectedModel={selectedModel} title="Chiller"/>

            </div>

            <hr className="w-screen border-gray-600"/>

            {/* CHART COMPONENTS (Sekarang menggunakan Dynamic Imports) */}
            <div className="col-span-12 grid grid-cols-12 gap-4">
                <ChartBPM selectedCell={selectedCell} selectedModel={selectedModel} title="BPM Chart" />

                <ChartPreheat selectedCell={selectedCell} selectedModel={selectedModel} title="Pre Heating" />

                <ChartPrimer1 selectedCell={selectedCell} selectedModel={selectedModel} title="Primer 1" />

                <ChartPrimer2 selectedCell={selectedCell} selectedModel={selectedModel} title="Primer 2" />

                <ChartCementing selectedCell={selectedCell} selectedModel={selectedModel} title="Cementing" />
                
                <ChartChiller selectedCell={selectedCell} selectedModel={selectedModel} title="Chiller" />

            </div>

            <div className="col-span-12 xl:col-span-12">
                {/* <AlarmLog /> */}
                {/* Alarm Summary */}
            </div>
        </div>
    );
}