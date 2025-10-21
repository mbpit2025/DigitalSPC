'use client';

import Button from '@/components/ui/button/Button';
import { useState } from 'react';
import Image from 'next/image';
import BarChartOne from '@/components/charts/bar/BarChartOne';

function BpmPage() {

  const [selectedCell, setSelectedCell] = useState<'B1-01' | 'B1-02'>('B1-01');

  const getButtonVariant = (cellName: 'B1-01' | 'B1-02') => 
    selectedCell === cellName ? 'primary' : 'outline';

  return (
    <div className="flex flex-col h-screen">
        <div className="col-span-12 flex justify-center md:justify-start xl:col-span-12 bg-gray-200 dark:bg-gray-950 p-2 gap-2 rounded-xl">
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
        <div className="col-span-12 xl:col-span-12 bg-white dark:bg-gray-900 p-4 rounded-xl shadow">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                Back Part Molding | {selectedCell}
            </h2>
        </div>
        <div className='grid grid-cols-12 gap-4'>
          <div className='relative col-span-12 md:col-span-6 border p-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-300 '>
            <Image
              src="/images/grid-image/image-01.png"
              alt="BPM Line Diagram"
              width={600}
              height={600}
              className="object-cover w-full h-auto rounded-lg"
            />
            <div className="absolute bottom-2 md:bottom-4 p-2 bg-white/30 text-white text-sm rounded w-[96%] md:w-[98%] lg:w-[99%] flex flex-col justify-between gap-2">
              <div className="flex flex-col w-full justify-around border rounded-sm bg-red-600/80 p-2">
                <h1 className='text-center'>Heating Process</h1>
                <div className='flex justify-around py-2 font-semibold'>
                  <div>10°C/30 s</div>
                  <div>10°C/30 s</div>
                  <div>10°C/30 s</div>
                  <div>10°C/30 s</div>
                </div>
              </div>  
              <div className="flex flex-col w-full justify-around border rounded-sm bg-blue-700/80 p-2">
                <h1 className='text-center'>Cooling Process</h1>
                <div className='flex justify-around py-2 font-semibold'>
                  <div>10°C/30 s</div>
                  <div>10°C/30 s</div>
                  <div>10°C/30 s</div>
                  <div>10°C/30 s</div>
                </div>  
              </div>  
            </div>
          </div>


          <div className='relative col-span-12 md:col-span-6 border p-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-300 '>
           
          </div>
        </div>

        <div className='col-span-6 border p-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-300 mt-6'>
          <h1>
            BPM Back Part Molding - {selectedCell} Output Chart
          </h1>
          <BarChartOne/>
          {/* Additional content can go here */}
        </div>

        <div className='col-span-6 border p-4 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-300 mt-6'>
          <h1>
            BPM Back Part Molding - {selectedCell} Output Chart
          </h1>
          {/* Additional content can go here */}
        </div>
      </div>
  )
}

export default BpmPage