'use client'

import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Loader2 } from 'lucide-react'

function getFilename(response: Response) {
  const disposition = response.headers.get('content-disposition')
  const match = disposition?.match(/filename="([^"]+)"/)

  return match?.[1] ?? 'income-expenditure.pdf'
}

export function ExportPdfButton({ href }: { href: string }) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleExport(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()

    if (isLoading) return

    setIsLoading(true)

    try {
      const response = await fetch(href)

      if (!response.ok) {
        throw new Error('PDF export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = getFilename(response)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <a
      href={href}
      onClick={handleExport}
      className='inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 aria-disabled:pointer-events-none aria-disabled:opacity-70'
      aria-busy={isLoading}
      aria-disabled={isLoading}
    >
      {isLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
      {isLoading ? 'Rendering PDF...' : 'Export PDF'}
    </a>
  )
}
