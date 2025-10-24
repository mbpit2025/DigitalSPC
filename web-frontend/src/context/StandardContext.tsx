// 📁 src/contexts/StandardContext.tsx
'use client';

import React, { 
    createContext, 
    useContext, 
    useState, 
    useEffect, 
    useCallback, 
    useMemo 
} from 'react';
import { StandardsData, ModelOption } from '@/types/standards'; 

// --- 1. Definisi Tipe Context State ---
interface StandardContextType {
    standardData: StandardsData;
    modelOptions: ModelOption[];
    isLoading: boolean;
    error: string | null;
    refetchStandards: () => Promise<void>;
}

// Data default untuk Context
const defaultContextValue: StandardContextType = {
    standardData: {},
    modelOptions: [],
    isLoading: false,
    error: null,
    refetchStandards: async () => {}, // Fungsi kosong
};

// --- 2. Membuat Context ---
const StandardContext = createContext<StandardContextType>(defaultContextValue);

// --- 3. Custom Hook untuk Konsumsi Context ---
export const useStandards = () => {
    return useContext(StandardContext);
};

// --- 4. Provider Component ---
export const StandardProvider = ({ children }: { children: React.ReactNode }) => {
    const [standardData, setStandardData] = useState<StandardsData>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fungsi untuk mengambil data standar dari endpoint yang telah di-format
    const fetchStandards = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Asumsi /api/standards/all mengembalikan format JSON yang diinginkan: { "U204": { "HOT_TEMP_MIN": 80, ... }, ... }
            const response = await fetch('/api/standards'); 

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Respons server tidak OK.' }));
                throw new Error(errorData.message || 'Gagal mengambil semua data standar.');
            }

            const data: StandardsData = await response.json();
            setStandardData(data);
        } catch (err: unknown) {
            console.error("Error fetching all standards:", (err as Error).message);
            setError((err as Error).message || 'Terjadi kesalahan saat memuat data.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Panggil fetchStandards saat komponen dimuat
    useEffect(() => {
        fetchStandards();
    }, [fetchStandards]);

    // Generate options untuk Select/Dropdown
    const modelOptions = useMemo(() => {
        return Object.keys(standardData).map(key => ({ 
            label: key, 
            value: key 
        }));
    }, [standardData]);

    const contextValue = useMemo(() => ({
        standardData,
        modelOptions,
        isLoading,
        error,
        refetchStandards: fetchStandards, // Ekspos fungsi fetch untuk refresh
    }), [standardData, modelOptions, isLoading, error, fetchStandards]);

    return (
        <StandardContext.Provider value={contextValue}>
            {children}
        </StandardContext.Provider>
    );
};