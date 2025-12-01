import React from 'react'
import Link from 'next/link'

function NavMc() {
  return (
    <div className='flex gap-4 p-6 text-white'>
        <Link href="/dashboard/history/bpm" className='hover:bg-blue-700 px-8 py-4 bg-blue-500'>B1-01: BPM</Link>
    </div>
  )
}

export default NavMc