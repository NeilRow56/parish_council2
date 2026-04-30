'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { updateJournalDescriptionsAction } from '../actions'

type JournalLineInput = {
  id: string
  nominalCode: string
  nominalName: string
  description: string | null
  debit: string | number | null
  credit: string | number | null
}

function formatAmount(value: string | number | null) {
  const amount = Number(value ?? 0)

  return amount === 0
    ? '—'
    : amount.toLocaleString('en-GB', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
}

export function EditJournalForm({
  journalEntryId,
  description,
  lines
}: {
  journalEntryId: string
  description: string
  lines: JournalLineInput[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [journalDescription, setJournalDescription] = useState(description)
  const [lineDescriptions, setLineDescriptions] = useState(() =>
    lines.map(line => ({
      id: line.id,
      description: line.description ?? ''
    }))
  )

  function updateLineDescription(id: string, value: string) {
    setLineDescriptions(current =>
      current.map(line =>
        line.id === id ? { ...line, description: value } : line
      )
    )
  }

  function handleSave() {
    setError(null)

    startTransition(async () => {
      try {
        await updateJournalDescriptionsAction({
          journalEntryId,
          description: journalDescription,
          lines: lineDescriptions
        })

        router.refresh()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not update journal.'
        )
      }
    })
  }

  return (
    <div className='space-y-6'>
      <section className='rounded-lg border bg-white p-4 shadow-sm'>
        {error && (
          <p className='mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
            {error}
          </p>
        )}

        <label className='text-sm font-medium text-zinc-700'>
          Journal description
        </label>
        <input
          value={journalDescription}
          onChange={event => setJournalDescription(event.target.value)}
          className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
        />

        <div className='mt-4 flex justify-end'>
          <button
            type='button'
            onClick={handleSave}
            disabled={isPending}
            className='inline-flex items-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
          >
            <Save className='h-4 w-4' />
            {isPending ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </section>

      <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
        <table className='w-full border-collapse text-sm'>
          <thead className='bg-zinc-50 text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Nominal code</th>
              <th className='px-4 py-3 font-medium'>Line description</th>
              <th className='px-4 py-3 text-right font-medium'>Debit</th>
              <th className='px-4 py-3 text-right font-medium'>Credit</th>
            </tr>
          </thead>

          <tbody>
            {lines.map(line => {
              const currentDescription =
                lineDescriptions.find(item => item.id === line.id)
                  ?.description ?? ''

              return (
                <tr key={line.id} className='border-t'>
                  <td className='px-4 py-3 font-medium'>
                    {line.nominalCode} — {line.nominalName}
                  </td>

                  <td className='px-4 py-3'>
                    <input
                      value={currentDescription}
                      onChange={event =>
                        updateLineDescription(line.id, event.target.value)
                      }
                      className='w-full rounded-md border px-3 py-2 text-sm'
                    />
                  </td>

                  <td className='px-4 py-3 text-right'>
                    {formatAmount(line.debit)}
                  </td>

                  <td className='px-4 py-3 text-right'>
                    {formatAmount(line.credit)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
