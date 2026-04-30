'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { createManualJournalAction } from '../actions'

type NominalCodeOption = {
  id: string
  code: string
  name: string
  type: string
}

type JournalLine = {
  id: string
  nominalCodeId: string
  description: string
  debit: string
  credit: string
}

function createEmptyLine(): JournalLine {
  return {
    id: crypto.randomUUID(),
    nominalCodeId: '',
    description: '',
    debit: '',
    credit: ''
  }
}

function parseMoneyInput(value: string) {
  const cleaned = value.replace(/,/g, '').trim()
  const number = Number(cleaned)

  if (!Number.isFinite(number) || number < 0) {
    return ''
  }

  return number.toFixed(2)
}

function formatMoneyInput(value: string) {
  const parsed = parseMoneyInput(value)

  if (!parsed) return ''

  return Number(parsed).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatMoney(value: number) {
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export function ManualJournalForm({
  nominalCodes,
  financialYearId
}: {
  nominalCodes: NominalCodeOption[]
  financialYearId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<JournalLine[]>([
    createEmptyLine(),
    createEmptyLine()
  ])

  const totals = useMemo(() => {
    const debit = lines.reduce(
      (sum, line) => sum + Number(line.debit.replace(/,/g, '') || 0),
      0
    )

    const credit = lines.reduce(
      (sum, line) => sum + Number(line.credit.replace(/,/g, '') || 0),
      0
    )

    return {
      debit,
      credit,
      difference: debit - credit
    }
  }, [lines])

  function updateLine(id: string, patch: Partial<JournalLine>) {
    setLines(current =>
      current.map(line => (line.id === id ? { ...line, ...patch } : line))
    )
  }

  function removeLine(id: string) {
    setLines(current => current.filter(line => line.id !== id))
  }

  function addLine() {
    setLines(current => [...current, createEmptyLine()])
  }

  function handleSubmit() {
    setError(null)

    startTransition(async () => {
      try {
        await createManualJournalAction({
          financialYearId,
          date,
          description,
          lines
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not post journal.')
      }
    })
  }

  const balances = Math.round(totals.difference * 100) === 0
  const canSubmit = balances && totals.debit > 0 && !isPending

  return (
    <div className='rounded-lg border bg-white shadow-sm'>
      <div className='space-y-4 border-b p-4'>
        {error && (
          <p className='rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
            {error}
          </p>
        )}

        <div className='grid gap-4 md:grid-cols-3'>
          <div>
            <label className='text-sm font-medium'>Date</label>
            <input
              type='date'
              value={date}
              onChange={event => setDate(event.target.value)}
              className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
            />
          </div>

          <div className='md:col-span-2'>
            <label className='text-sm font-medium'>Description</label>
            <input
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder='e.g. Correct miscoding from bank feed'
              className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
            />
          </div>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full table-fixed border-collapse text-sm'>
          <colgroup>
            <col className='w-60' />
            <col />
            <col className='w-38' />
            <col className='w-38' />
            <col className='w-12' />
          </colgroup>

          <thead className='bg-zinc-50 text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Nominal code</th>
              <th className='px-4 py-3 font-medium'>Line description</th>
              <th className='px-4 py-3 text-right font-medium'>Debit</th>
              <th className='px-4 py-3 text-right font-medium'>Credit</th>
              <th className='px-4 py-3' />
            </tr>
          </thead>

          <tbody>
            {lines.map(line => (
              <tr key={line.id} className='border-t'>
                <td className='px-4 py-3'>
                  <select
                    value={line.nominalCodeId}
                    title={
                      nominalCodes.find(code => code.id === line.nominalCodeId)
                        ? `${nominalCodes.find(code => code.id === line.nominalCodeId)?.code} — ${
                            nominalCodes.find(
                              code => code.id === line.nominalCodeId
                            )?.name
                          }`
                        : ''
                    }
                    onChange={event =>
                      updateLine(line.id, {
                        nominalCodeId: event.target.value
                      })
                    }
                    className='w-full truncate rounded-md border px-3 py-2'
                  >
                    <option value=''>Select code</option>
                    {nominalCodes.map(code => (
                      <option key={code.id} value={code.id}>
                        {code.code} — {code.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td className='px-4 py-3'>
                  <input
                    value={line.description}
                    onChange={event =>
                      updateLine(line.id, {
                        description: event.target.value
                      })
                    }
                    placeholder='Optional'
                    className='w-full rounded-md border px-3 py-2'
                  />
                </td>

                <td className='px-4 py-3 text-right'>
                  <input
                    type='text'
                    inputMode='decimal'
                    value={line.debit}
                    onChange={event =>
                      updateLine(line.id, {
                        debit: event.target.value,
                        credit: event.target.value ? '' : line.credit
                      })
                    }
                    onBlur={() =>
                      updateLine(line.id, {
                        debit: formatMoneyInput(line.debit)
                      })
                    }
                    className='w-full rounded-md border px-3 py-2 text-right'
                  />
                </td>

                <td className='px-4 py-3 text-right'>
                  <input
                    type='text'
                    inputMode='decimal'
                    value={line.credit}
                    onChange={event =>
                      updateLine(line.id, {
                        credit: event.target.value,
                        debit: event.target.value ? '' : line.debit
                      })
                    }
                    onBlur={() =>
                      updateLine(line.id, {
                        credit: formatMoneyInput(line.credit)
                      })
                    }
                    className='w-full rounded-md border px-3 py-2 text-right'
                  />
                </td>

                <td className='px-4 py-3 text-right'>
                  <button
                    type='button'
                    onClick={() => removeLine(line.id)}
                    disabled={lines.length <= 2}
                    className='rounded-md p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-40'
                  >
                    <Trash2 className='h-4 w-4' />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot className='border-t bg-zinc-50 font-semibold'>
            <tr>
              <td className='px-4 py-3' colSpan={2}>
                Totals
              </td>

              <td className='py-3 pr-7 text-right'>
                {formatMoney(totals.debit)}
              </td>
              <td className='py-3 pr-7 text-right'>
                {formatMoney(totals.credit)}
              </td>

              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className='flex items-center justify-between gap-4 border-t p-4'>
        <div className='text-sm'>
          {balances ? (
            <span className='text-zinc-600'>Journal balances.</span>
          ) : (
            <span className='text-red-600'>
              Difference: {formatMoney(totals.difference)}
            </span>
          )}
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={addLine}
            className='inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
          >
            <Plus className='h-4 w-4' />
            Add line
          </button>

          <button
            type='button'
            onClick={() => router.push('/ledger')}
            className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
          >
            Cancel
          </button>

          <button
            type='button'
            onClick={handleSubmit}
            disabled={!canSubmit}
            className='rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
          >
            {isPending ? 'Posting...' : 'Post journal'}
          </button>
        </div>
      </div>
    </div>
  )
}
