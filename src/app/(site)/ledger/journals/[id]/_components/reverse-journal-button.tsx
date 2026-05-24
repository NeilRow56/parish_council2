'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { reverseJournalAction } from '../actions'

export function ReverseJournalButton({
  journalEntryId,
  source
}: {
  journalEntryId: string
  source: string | null
}) {
  const router = useRouter()
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
        const result = await reverseJournalAction(journalEntryId)
        toast.success('Journal reversed.')
        const sourceQuery = source ? `?source=${source}` : '?source=manual-journal'
        router.push(`/ledger/journals/${result.journalEntryId}${sourceQuery}`)
        router.refresh()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not reverse journal.'
        setError(message)
        toast.error(message)
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
            : 'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40 disabled:opacity-50'
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
