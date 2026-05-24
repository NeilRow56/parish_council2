'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { setSelectedFinancialYearAction } from '@/app/(site)/financial-year-actions'

type FinancialYearOption = {
  id: string
  label: string
  isClosed: boolean
}

export function FinancialYearSelector({
  years,
  selectedFinancialYearId
}: {
  years: FinancialYearOption[]
  selectedFinancialYearId: string | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  if (years.length === 0 || !selectedFinancialYearId) {
    return null
  }

  return (
    <label className='flex items-center gap-2 text-sm text-slate-600'>
      <span className='font-medium text-slate-700'>Financial year:</span>
      <select
        value={selectedFinancialYearId}
        disabled={isPending}
        onChange={event => {
          const financialYearId = event.target.value

          startTransition(async () => {
            const result = await setSelectedFinancialYearAction(financialYearId)

            if (result.success) {
              router.refresh()
            }
          })
        }}
        className='h-9 rounded-md border border-emerald-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm outline-none hover:border-emerald-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60'
      >
        {years.map(year => (
          <option key={year.id} value={year.id}>
            {year.label}
            {year.isClosed ? ' (Closed)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
