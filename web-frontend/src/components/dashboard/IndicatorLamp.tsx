import React, { useState, useEffect } from 'react';

interface IndicatorLightProps {
  status: 'on' | 'off' | 'warning';
  label?: string; // opsional: label di bawah lampu
}

const IndicatorLight: React.FC<IndicatorLightProps> = ({ status, label }) => {
  const [isVisible, setIsVisible] = useState(true);

  // Atur kedipan hanya saat status aktif ('on' atau 'warning')
  useEffect(() => {
    if (status === 'off') {
      setIsVisible(true); // mati = selalu terlihat sebagai abu-abu (tidak berkedip)
      return;
    }

    // Kedip: toggle setiap 1000ms
    const interval = setInterval(() => {
      setIsVisible(prev => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [status]);

  // Tentukan warna berdasarkan status
  const getLightColor = () => {
    if (status === 'off') return 'bg-gray-500'; // mati = abu-abu
    if (status === 'warning') return 'bg-yellow-400'; // warning = kuning
    return 'bg-green-500'; // on = hijau
  };

  // Jika status aktif, ikuti state kedip (`isVisible`)
  const lightClass = status === 'off' 
    ? getLightColor() 
    : isVisible 
      ? getLightColor() 
      : 'bg-gray-700'; // saat "off" dalam siklus kedip

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* Lampu utama */}
        <div
          className={`w-4 h-4 rounded-full ${lightClass} shadow-lg transition-colors duration-100`}
        />
        {/* Efek glow (opsional) */}
        {status !== 'off' && isVisible && (
          <div
            className={`absolute inset-0 rounded-full blur-sm opacity-70 ${
              status === 'warning' ? 'bg-yellow-400' : 'bg-green-500'
            }`}
          />
        )}
      </div>
      {label && <span className="mt-1 text-sm text-white">{label}</span>}
    </div>
  );
};

export default IndicatorLight;