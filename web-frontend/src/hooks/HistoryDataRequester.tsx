// src/hooks/HistoryDataRequester.tsx

'use client';
import React, { useMemo } from 'react';
import { useHistory } from '@/context/HistoryContext'; // Sesuaikan path
// import { HistoryChart } from '@/components/charts/history/historyChart'; // Komponen chart
import HistoryData from '@/components/dashboard/historyData';

interface DataRequesterProps {
  plcId: number;
  tagNames: string[];
}

const HistoryDataRequester: React.FC<DataRequesterProps> = ({ plcId, tagNames }) => {
  const { getHistoryData, isLoading, error } = useHistory();

  // Gunakan useMemo agar filtering hanya berjalan saat props atau getHistoryData berubah
  const filteredData = useMemo(() => {
    return getHistoryData({ plc_id: plcId, tag_names: tagNames });
  }, [plcId, tagNames, getHistoryData]);

  if (isLoading) return <p>Loading history...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;

  return (
    <div className='col-span-12'>
      <h3 className="text-lg font-bold">Data untuk PLC {plcId} ({tagNames.join(', ')})</h3>
      {/* <HistoryChart data={filteredData} /> */}
      <HistoryData data={filteredData} />
    </div>
  );
};

export default HistoryDataRequester;