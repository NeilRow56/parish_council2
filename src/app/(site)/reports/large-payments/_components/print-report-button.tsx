// src/app/(site)/reports/large-payments/_components/print-report-button.tsx
'use client'

export function PrintReportButton() {
  return (
    <button
      type='button'
      onClick={() => window.print()}
      className='rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 print:hidden'
    >
      Print / save PDF
    </button>
  )
}
