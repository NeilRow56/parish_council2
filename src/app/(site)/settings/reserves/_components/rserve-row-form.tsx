// src/app/(app)/settings/reserves/_components/reserve-row-form.tsx
'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'

import { reserves } from '@/db/schema'
import {
  deleteReserveAction,
  updateReserveAction,
  type ReserveActionState
} from '../actions'

type ReserveRow = typeof reserves.$inferSelect

type Props = {
  reserve: ReserveRow
}

const initialState: ReserveActionState = {}

export function ReserveRowForm({ reserve }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateReserveAction,
    initialState
  )

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
    }

    if (state.error) {
      toast.error(state.error)
    }
  }, [state.success, state.error])

  return (
    <form action={formAction} className='px-4 py-3'>
      <input type='hidden' name='id' value={reserve.id} />

      {state.error && (
        <p className='mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          {state.error}
        </p>
      )}

      <div className='grid grid-cols-[160px_1fr_140px_180px] items-center gap-3'>
        <input
          name='code'
          defaultValue={reserve.code}
          disabled={reserve.isDefault}
          className='disabled:bg-muted rounded-md border px-3 py-2 text-sm'
        />

        <input
          name='name'
          defaultValue={reserve.name}
          disabled={reserve.isDefault}
          className='disabled:bg-muted rounded-md border px-3 py-2 text-sm'
        />

        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            name='isActive'
            defaultChecked={reserve.isActive}
            disabled={reserve.isDefault}
          />
          Active
        </label>

        <div className='flex justify-end gap-2'>
          <button
            type='submit'
            disabled={reserve.isDefault || isPending}
            className='rounded-md border px-3 py-2 text-sm disabled:opacity-50'
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </button>

          {!reserve.isDefault && (
            <button
              type='submit'
              formAction={deleteReserveAction}
              disabled={isPending}
              className='text-destructive rounded border border-solid border-red-600 px-2 py-1 text-sm'
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
