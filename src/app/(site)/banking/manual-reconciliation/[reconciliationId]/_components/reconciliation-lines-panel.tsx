'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { undoManualBankLineClearingAction } from '../../actions'

export type ReconciledBankLine = {
  id: string
  journalEntryId: string
  date: string
  reference: string
  description: string
  debit: string
  credit: string
  reconciliationReference: string | null
}

function formatAmount(value: string) {
  const amount = Number(value)

  return amount === 0
    ? '—'
    : amount.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
}

export function ReconciliationLinesPanel({
  reconciliationId,
  lines,
  canUndo
}: {
  reconciliationId: string
  lines: ReconciledBankLine[]
  canUndo: boolean
}) {
  const router = useRouter()
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(
    new Set()
  )
  const [isUndoing, setIsUndoing] = useState(false)

  const selectedCount = useMemo(
    () => lines.filter(line => selectedLineIds.has(line.id)).length,
    [lines, selectedLineIds]
  )

  function toggleLine(lineId: string) {
    setSelectedLineIds(current => {
      const next = new Set(current)

      if (next.has(lineId)) {
        next.delete(lineId)
      } else {
        next.add(lineId)
      }

      return next
    })
  }

  function toggleAll() {
    setSelectedLineIds(current =>
      current.size === lines.length ? new Set() : new Set(lines.map(line => line.id))
    )
  }

  async function undoClearing(lineIds?: string[]) {
    if (isUndoing) return

    if (lineIds && !lineIds.length) {
      toast.error('Select at least one cleared bank line to undo.')
      return
    }

    setIsUndoing(true)

    try {
      const result = await undoManualBankLineClearingAction({
        reconciliationId,
        lineIds
      })

      if (!result.success) {
        toast.error(result.error)
        return
      }

      toast.success(
        `Clearing undone for ${result.unclearedCount} manual bank line${
          result.unclearedCount === 1 ? '' : 's'
        }.`
      )
      setSelectedLineIds(new Set())
      router.refresh()
    } catch {
      toast.error('Could not undo clearing for the selected bank lines.')
    } finally {
      setIsUndoing(false)
    }
  }

  return (
    <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
      <div className='flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-start md:justify-between'>
        <div>
          <h2 className='text-base font-semibold text-slate-950'>
            Cleared bank lines
          </h2>
          <p className='mt-1 text-sm text-slate-600'>
            These manual bank lines are linked to this reconciliation session.
          </p>
        </div>

        {canUndo && lines.length ? (
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              disabled={isUndoing || !selectedCount}
              onClick={() => undoClearing(Array.from(selectedLineIds))}
              className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40 disabled:opacity-50'
            >
              {isUndoing ? 'Undoing...' : `Undo selected (${selectedCount})`}
            </button>
            <button
              type='button'
              disabled={isUndoing}
              onClick={() => undoClearing()}
              className='rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50'
            >
              {isUndoing ? 'Undoing...' : 'Undo whole reconciliation'}
            </button>
          </div>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <div className='px-5 py-8 text-sm text-slate-600'>
          No cleared manual bank lines remain linked to this reconciliation.
        </div>
      ) : (
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[820px] text-sm'>
            <thead className='bg-emerald-50/30 text-left text-slate-600'>
              <tr>
                {canUndo ? (
                  <th className='w-12 px-4 py-3'>
                    <input
                      type='checkbox'
                      checked={selectedLineIds.size === lines.length}
                      onChange={toggleAll}
                      aria-label='Select all cleared manual bank lines'
                    />
                  </th>
                ) : null}
                <th className='px-4 py-3 font-medium'>Date</th>
                <th className='px-4 py-3 font-medium'>Journal</th>
                <th className='px-4 py-3 font-medium'>Description</th>
                <th className='px-4 py-3 font-medium'>Reference note</th>
                <th className='px-4 py-3 text-right font-medium'>Debit</th>
                <th className='px-5 py-3 text-right font-medium'>Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(line => (
                <tr key={line.id} className='border-t'>
                  {canUndo ? (
                    <td className='px-4 py-3'>
                      <input
                        type='checkbox'
                        checked={selectedLineIds.has(line.id)}
                        onChange={() => toggleLine(line.id)}
                        aria-label={`Select cleared line ${line.reference}`}
                      />
                    </td>
                  ) : null}
                  <td className='px-4 py-3'>{line.date}</td>
                  <td className='px-4 py-3'>
                    <Link
                      href={`/ledger/journals/${line.journalEntryId}`}
                      className='font-medium text-blue-700 hover:underline'
                    >
                      {line.reference}
                    </Link>
                  </td>
                  <td className='px-4 py-3'>{line.description}</td>
                  <td className='px-4 py-3 text-slate-600'>
                    {line.reconciliationReference || '—'}
                  </td>
                  <td className='px-4 py-3 text-right'>
                    {formatAmount(line.debit)}
                  </td>
                  <td className='px-5 py-3 text-right'>
                    {formatAmount(line.credit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
