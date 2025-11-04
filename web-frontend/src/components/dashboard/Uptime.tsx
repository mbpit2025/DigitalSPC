import React from 'react'

export const UptimeBar = ({ value } : { value: number }) => {
  return (
    <>
    <div className="flex items-center justify-between gap-4 w-full">
        <span className="text-sm text-gray-500 dark:text-gray-400">Uptime</span>
        <div className="relative block h-2 w-full rounded-sm bg-gray-200 dark:bg-gray-800">
          {value <= 100 ? (
              // ✅ Normal progress
              <div
                className="absolute left-0 top-0 h-full bg-green-500 rounded-sm text-xs font-medium text-white"
                style={{ width: `${value}%` }}
              ></div>
            ) : (
              <div
                className="absolute left-0 top-0 h-full bg-red-500 rounded-sm text-xs font-medium text-white"
                style={{ width: `${value - 100}%` }}
              ></div>
            )}
        </div>
        { value <= 100 ? (        <span className="text-sm text-gray-500 dark:text-gray-400 text-nowrap">{String(value)} %</span>) : 
        (        <span className="text-sm text-gray-500 dark:text-red-400 text-nowrap" >{String(value)} %</span>)}

    </div>
    </>
  )
}
