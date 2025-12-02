import React, { useRef, useEffect, useState } from 'react';
import { GaugeComponent } from 'react-gauge-component';

interface TempGaugeProps {
  min: number;
  max: number;
  value: number;
  label: string;
  qty : number;
  time: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AnyGauge = GaugeComponent as any;

const TempGauge: React.FC<TempGaugeProps> = ({ min, max, value, label, qty, time }) => {
  const containerRef = useRef<HTMLDivElement>( null);
  const [gaugeSize, setGaugeSize] = useState({ width: 300, height: 150 });

  // 🔴 Hitung apakah nilai di luar batas
  const isOutOfRange = value < min || value > max;
  const valueColor = isOutOfRange ? '#FF0000' : '#FFFFFF';

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        const height = Math.max(100, width * 0.5);
        setGaugeSize({ width, height });
      }
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div ref={containerRef} className="w-full flex justify-center" style={{ height: 'auto' }}>
        {gaugeSize.width > 0 && (
          <AnyGauge
            type="semicircle"
            minValue={0}
            maxValue={120}
            width={gaugeSize.width}
            height={gaugeSize.height}
            arc={{
              colorArray: ['#00FF15', '#FFFF00', '#FF2121'], // safe → warning → danger
              padding: 0.04,
              width: 0.1,
              subArcs: [
                { limit: min, showTick: true },
                { limit: max, showTick: true },
                { limit: 120, showTick: true },
              ],
            }}
            pointer={{
              type: 'arrow',
              elastic: false,
              animationDelay: 5,
              width: 20,
              baseColor: '#FFFFFF',
              color: '#FFFFFF',
            }}
            value={value}
            labels={{
              valueLabel: {
                formatTextValue: (v: number) => `${v} °C`,
                maxDecimalDigits: 2,
                style: {
                  fontSize: '40px',
                  fontWeight: 'bold',
                  fill: valueColor, // ✅ Warna teks dinamis
                },
              },
            }}
          />
        )}
      </div>
      <div className="w-full flex text-sm justify-between text-gray-300">
        <p>Time:  {time} s</p>
        <p>Qty : {qty} pcs</p>
      </div>
      <h2 className="mt-2 text-center text-white text-xl font-semibold bg-white/10 w-full">{label} </h2>
    </div>
  );
};

export default TempGauge;