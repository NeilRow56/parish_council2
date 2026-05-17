// app/(site)/vat/returns/_components/vat-return-period-select.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type VatPeriodOption = {
  label: string
  periodStart: string
  periodEnd: string
}

export function VatReturnPeriodSelect({
  financialYearId,
  selectedStart,
  selectedEnd,
  options
}: {
  financialYearId: string
  selectedStart: string
  selectedEnd: string
  options: VatPeriodOption[]
}) {
  const router = useRouter()

  const safeSelectedStart = selectedStart ?? ''
  const safeSelectedEnd = selectedEnd ?? ''

  const selectedValue = `${safeSelectedStart}|${safeSelectedEnd}`

  const isPreset = options.some(
    option =>
      option.periodStart === safeSelectedStart &&
      option.periodEnd === safeSelectedEnd
  )

  const [mode, setMode] = useState<'preset' | 'custom'>(
    isPreset ? 'preset' : 'custom'
  )

  const [customStart, setCustomStart] = useState(safeSelectedStart)
  const [customEnd, setCustomEnd] = useState(safeSelectedEnd)

  function goToPeriod(
    periodStart: string,
    periodEnd: string,
    includeFinancialYearId = true
  ) {
    const params = new URLSearchParams({
      periodStart,
      periodEnd
    })

    if (includeFinancialYearId) {
      params.set('financialYearId', financialYearId)
    }

    router.push(`/vat/returns?${params.toString()}`)
  }

  return (
    <div className='space-y-3'>
      <div className='flex gap-2'>
        <button
          type='button'
          onClick={() => setMode('preset')}
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            mode === 'preset'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Preset periods
        </button>

        <button
          type='button'
          onClick={() => setMode('custom')}
          className={`rounded-md border px-3 py-2 text-sm font-medium ${
            mode === 'custom'
              ? 'bg-slate-900 text-white'
              : 'bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Custom dates
        </button>
      </div>

      {mode === 'preset' ? (
        <select
          name='period'
          value={isPreset ? selectedValue : ''}
          onChange={event => {
            const [periodStart, periodEnd] =
              event.currentTarget.value.split('|')

            goToPeriod(periodStart, periodEnd)
          }}
          className='w-full rounded-md border px-3 py-2 text-sm'
        >
          {!isPreset && <option value=''>Custom period selected</option>}

          {options.map(option => (
            <option
              key={`${option.periodStart}-${option.periodEnd}`}
              value={`${option.periodStart}|${option.periodEnd}`}
            >
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <div className='grid gap-3 md:grid-cols-[1fr_1fr_auto]'>
          <div>
            <label className='mb-1 block text-xs font-medium text-slate-500'>
              From
            </label>
            <input
              type='date'
              value={customStart || ''}
              onChange={event => setCustomStart(event.target.value)}
              className='w-full rounded-md border px-3 py-2 text-sm'
            />
          </div>

          <div>
            <label className='mb-1 block text-xs font-medium text-slate-500'>
              To
            </label>
            <input
              type='date'
              value={customEnd || ''}
              onChange={event => setCustomEnd(event.target.value)}
              className='w-full rounded-md border px-3 py-2 text-sm'
            />
          </div>

          <div className='flex items-end'>
            <button
              type='button'
              onClick={() => goToPeriod(customStart, customEnd, false)}
              disabled={!customStart || !customEnd || customStart > customEnd}
              className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50'
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
