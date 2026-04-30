// src/app/bank-connections/sync-bank-button.tsx

'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'

import { syncBankConnectionAction } from '../actions'

export function SyncBankButton({ connectionId }: { connectionId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleSync() {
    startTransition(async () => {
      try {
        const result = await syncBankConnectionAction(connectionId)

        toast.success('Bank sync complete', {
          description: `Imported ${result.imported}, skipped ${result.skipped}.`
        })
      } catch (err) {
        toast.error('Bank sync failed', {
          description: err instanceof Error ? err.message : 'Please try again.'
        })
      }
    })
  }

  return (
    <button
      type='button'
      onClick={handleSync}
      disabled={isPending}
      className='rounded border px-3 py-1 text-sm disabled:opacity-50'
    >
      {isPending ? 'Syncing...' : 'Sync now'}
    </button>
  )
}
