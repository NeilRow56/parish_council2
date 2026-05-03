// src/app/(app)/settings/reserves/_components/add-reserve-form.tsx
'use client'

import { useActionState, useEffect } from 'react'

import { createReserveAction, type ReserveActionState } from '../actions'
import { toast } from 'sonner'

const initialState: ReserveActionState = {}

export function AddReserveForm() {
  const [state, formAction, isPending] = useActionState(
    createReserveAction,
    initialState
  )

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
    }
  }, [state.success])

  return (
    <form action={formAction} className='rounded-lg border p-4'>
      <h2 className='font-medium'>Add reserve</h2>

      {state.error && (
        <p className='mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          {state.error}
        </p>
      )}

      <div className='mt-4 grid gap-3 md:grid-cols-[160px_1fr_auto]'>
        <div className='flex flex-col gap-1'>
          <label className='pl-2 text-sm font-medium'>Reserve code</label>
          <input
            name='code'
            placeholder='GENERAL'
            className='rounded-md border px-3 py-2 text-sm'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='pl-2 text-sm font-medium'>Reserve name</label>
          <input
            name='name'
            placeholder='General reserve'
            className='rounded-md border px-3 py-2 text-sm'
          />
        </div>
        <button
          type='submit'
          disabled={isPending}
          className='bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50'
        >
          {isPending ? 'Adding...' : 'Add reserve'}
        </button>
      </div>
    </form>
  )
}
