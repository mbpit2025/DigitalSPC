import React from 'react'

export const UptimeBar = ({ value } : { value: number }) => {
  return (
    <>
    <div className="flex items-center justify-between gap-4 w-full">
        <span className="text-sm text-gray-500 dark:text-gray-400">Uptime</span>
        <div className="relative block h-2 w-full rounded-sm bg-gray-200 dark:bg-gray-800">
        <div
          className="absolute left-0 top-0 flex h-full items-center justify-center rounded-sm bg-brand-500 text-xs font-medium text-white"
          style={{ width: `${value}%` }}
        ></div>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{value}%</span>
    </div>
    </>
  )
}
