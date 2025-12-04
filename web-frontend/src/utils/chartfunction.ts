interface ApiDataItem { tag_name: string; value: number; timestamp: string; }

const fetchChartData = async (plcId: string): Promise<ApiDataItem[]> => {
    const apiUrl = `/api/plcdata/${plcId}`; 
    const response = await fetch(apiUrl);
    if (!response.ok) {
        throw new Error(`Gagal mengambil data API untuk PLC ${plcId}: ${response.statusText}`);
    }
    const fullResponse: { data: ApiDataItem[] } = await response.json();
    
    // ✅ KUNCI PERBAIKAN: Ambil HANYA array 'data' dari objek respons.
    if (!Array.isArray(fullResponse.data)) { // Check keamanan tambahan
        console.error("Kunci 'data' dalam response API bukan array:", fullResponse);
        return []; // Pastikan selalu mengembalikan array
    }
    
    return fullResponse.data; // Mengembalikan array data yang benar
};

export { fetchChartData };