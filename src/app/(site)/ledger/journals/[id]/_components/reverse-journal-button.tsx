'use client'

import { useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { reverseJournalAction } from '../actions'

export function ReverseJournalButton({
  journalEntryId
}: {
  journalEntryId: string
}) {
  const [isPending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleReverse() {
    setError(null)

    if (!confirming) {
      setConfirming(true)
      return
    }

    startTransition(async () => {
      try {
        await reverseJournalAction(journalEntryId)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not reverse journal.'
        )
      }
    })
  }

  return (
    <div className='space-y-2'>
      {error && (
        <p className='rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          {error}
        </p>
      )}

      <button
        type='button'
        onClick={handleReverse}
        disabled={isPending}
        className={
          confirming
            ? 'inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50'
            : 'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50'
        }
      >
        <RotateCcw className='h-4 w-4' />
        {isPending
          ? 'Reversing...'
          : confirming
            ? 'Confirm reversal'
            : 'Reverse journal'}
      </button>
    </div>
  )
}
