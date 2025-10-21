
import HistoryDataRequester from '@/hooks/HistoryDataRequester'; // Komponen baru

function HomePage() {  
  const requiredTags = ["data2", "data3"];

  return (
    <div className="grid grid-cols-12 gap-2 md:gap-6">
      <div className="col-span-12 dark:text-gray-200">
        Home Page (Menggunakan Context)
      </div>
      
      {/* Meminta data histori untuk PLC 1 dan tag tertentu */}
      <HistoryDataRequester plcId={1} tagNames={requiredTags} />
    </div>
  )
}

export default HomePage;