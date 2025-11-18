'use client';

import { useState, useEffect, useCallback } from 'react'; // Tambahkan useCallback
import { PLCS } from '@/utils/plcMaps';

type HistoryResponse = {
  today: any[];
  this_week: any[];
  this_month: any[];
};

export default function McPage({ plcName }: { plcName: string }) {
  const [plcId, setPlcId] = useState<string | null>(null);
  const [tagRanges, setTagRanges] = useState<string[][]>([]);
  const [notFound, setNotFound] = useState(false);

  const [data, setData] = useState<HistoryResponse>({
    today: [],
    this_week: [],
    this_month: []
  });

  const [isLoading, setIsLoading] = useState(true);

  // --- BAGIAN 1: LOGIKA PENCARIAN PLC (HANYA SEKALI) ---
  useEffect(() => {
    // Log debugging:
    console.log('1. Raw plcName received:', `"${plcName}"`, 'Length:', plcName.length);

    // Sanitasi String (sudah benar)
    const cleanPlcName = plcName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '');

    console.log('2. Cleaned plcName used for search:', `"${cleanPlcName}"`, 'Length:', cleanPlcName.length);

    const found = PLCS.find(
      p => {
        const plcNameInMap = p.name.trim().toLowerCase();
        if (plcNameInMap === cleanPlcName) {
          console.log('3. MATCH FOUND! PLC ID:', p.id);
        }
        return plcNameInMap === cleanPlcName;
      }
    );

    if (!found) {
      // ✅ Pencarian GAGAL secara definitif
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    // ✅ Pencarian SUKSES: Update state
    setPlcId(found.id);
    setTagRanges(found.tagRanges);
    // Kita TIDAK menyetel isLoading di sini, karena loading akan berlanjut 
    // sampai fetch data pertama selesai.

  }, [plcName]);

  // --- BAGIAN 2: FUNGSI FETCH DATA ---
  // Gunakan useCallback untuk memastikan fungsi tidak berubah kecuali plcId berubah.
  const fetchData = useCallback(async () => {
    // Karena fungsi ini hanya akan dipanggil di useEffect 
    // setelah plcId disetel, kita tidak perlu memeriksa 'if (!plcId)' di sini.

    // Tambahkan pemeriksaan safety jika dipanggil saat transisi
    if (!plcId) return; 

    try {
      const res = await fetch(`/api/history/${plcId}`, { cache: "no-store" });
      const json = await res.json();

      setData({
        today: Array.isArray(json.today) ? json.today : [],
        this_week: Array.isArray(json.this_week) ? json.this_week : [],
        this_month: Array.isArray(json.this_month) ? json.this_month : [],
      });
    } catch (err) {
      console.error("Fetch error:", err);
      // Opsional: Anda dapat menyetel notFound(true) di sini jika API gagal, 
      // tetapi untuk saat ini kita biarkan data kosong.
    } finally {
      setIsLoading(false); // Selesai loading
    }
  }, [plcId]); // Dependensi: plcId

  // --- BAGIAN 3: LOGIKA INTERVAL ---
  useEffect(() => {
    // Jika sudah ditandai tidak ditemukan (dari useEffect pertama), berhenti.
    if (notFound) return;

    // 🛑 PERUBAHAN KRITIS:
    // HANYA jalankan fetchData dan interval jika plcId sudah disetel (tidak null).
    if (plcId) {
      // Panggil fetchData pertama kali.
      fetchData();

      // Mulai interval.
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
    
    // Jika plcId masih null, kita tunggu di sini.
  }, [plcId, notFound, fetchData]); // Dependensi: plcId, notFound, dan fetchData (dari useCallback)

  // --- BAGIAN 4: RENDER ---
  // ✅ tampilkan jika PLC tidak ditemukan
  if (notFound) {
    return (
      <div className="text-red-500 bg-gray-800 p-4 rounded-lg">
        Mesin "{plcName}" tidak ditemukan.
      </div>
    );
  }

  // Tampilkan UI utama
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 bg-gray-700 text-white p-4 rounded-lg">
        {plcName} {plcId && `(ID: ${plcId})`}
      </div>

      {isLoading ? (
        <div className='col-span-12 text-white'>Loading...</div>
      ) : (
        <div className="col-span-12 text-white space-y-4">
          <div className="flex flex-col">
            <span>Today: {data.today.length}</span>
            <span>This Week: {data.this_week.length}</span>
            <span>This Month: {data.this_month.length}</span>
          </div>

          <div>
            <h2 className="font-bold">Tag Ranges:</h2>
            {tagRanges.map((group, idx) => (
              <div key={idx} className="p-2 bg-gray-800 rounded-md mt-1">
                Group {idx + 1}: {group.join(", ")}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}