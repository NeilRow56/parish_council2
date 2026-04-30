'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { saveBankOpeningBalanceAction } from '../actions'

type OpeningBalanceRow = {
  connectionId: string
  accountName: string
  accountLast4: string | null
  sortCode: string | null
  nominalCodeId: string
  nominalCode: string
  nominalName: string
  openingBalance: string
}

function formatMoneyInput(value: string) {
  const cleaned = value.replace(/,/g, '').trim()
  const parsed = Number(cleaned)

  if (!Number.isFinite(parsed)) return value

  return parsed.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export function OpeningBalancesForm({
  financialYearId,
  rows
}: {
  financialYearId: string
  rows: OpeningBalanceRow[]
}) {
  const [isPending, startTransition] = useTransition()
  const [balances, setBalances] = useState(() =>
    Object.fromEntries(
      rows.map(row => [row.connectionId, formatMoneyInput(row.openingBalance)])
    )
  )

  function updateBalance(connectionId: string, value: string) {
    setBalances(current => ({
      ...current,
      [connectionId]: value
    }))
  }

  function saveBalance(connectionId: string) {
    startTransition(async () => {
      try {
        await saveBankOpeningBalanceAction({
          financialYearId,
          connectionId,
          openingBalance: balances[connectionId] ?? '0.00'
        })

        toast.success('Opening balance saved')
      } catch (err) {
        toast.error('Could not save opening balance', {
          description: err instanceof Error ? err.message : 'Please try again.'
        })
      }
    })
  }

  if (rows.length === 0) {
    return (
      <div className='rounded-lg border bg-white p-8 text-center text-sm text-zinc-500 shadow-sm'>
        No linked bank accounts found. Link bank accounts to nominal bank codes
        first.
      </div>
    )
  }

  return (
    <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
      <table className='w-full table-fixed border-collapse text-sm'>
        <colgroup>
          <col />
          <col className='w-64' />
          <col className='w-44' />
          <col className='w-28' />
        </colgroup>

        <thead className='bg-zinc-50 text-left text-zinc-600'>
          <tr>
            <th className='px-4 py-3 font-medium'>Bank account</th>
            <th className='px-4 py-3 font-medium'>Nominal code</th>
            <th className='px-4 py-3 text-right font-medium'>
              Opening balance
            </th>
            <th className='px-4 py-3' />
          </tr>
        </thead>

        <tbody>
          {rows.map(row => (
            <tr key={row.connectionId} className='border-t'>
              <td className='px-4 py-3'>
                <div className='font-medium'>{row.accountName}</div>
                <div className='text-xs text-zinc-500'>
                  {row.sortCode ? `${row.sortCode} · ` : ''}
                  {row.accountLast4 ? `****${row.accountLast4}` : ''}
                </div>
              </td>

              <td className='px-4 py-3'>
                {row.nominalCode} — {row.nominalName}
              </td>

              <td className='px-4 py-3'>
                <input
                  type='text'
                  inputMode='decimal'
                  value={balances[row.connectionId] ?? ''}
                  onChange={event =>
                    updateBalance(row.connectionId, event.target.value)
                  }
                  onBlur={() =>
                    updateBalance(
                      row.connectionId,
                      formatMoneyInput(balances[row.connectionId] ?? '0.00')
                    )
                  }
                  className='w-full rounded-md border px-3 py-2 text-right'
                />
              </td>

              <td className='px-4 py-3 text-right'>
                <button
                  type='button'
                  onClick={() => saveBalance(row.connectionId)}
                  disabled={isPending}
                  className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50'
                >
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
