// src/app/(app)/settings/reserves/_components/add-reserve-form.tsx
'use client'

import { useActionState, useState } from 'react'

import { createReserveAction, type ReserveActionState } from '../actions'
import { toast } from 'sonner'

const initialState: ReserveActionState = {}

export function AddReserveForm() {
  const [isOpen, setIsOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(
    async (prevState: ReserveActionState, formData: FormData) => {
      const nextState = await createReserveAction(prevState, formData)

      if (nextState.success) {
        toast.success(nextState.success)
        setIsOpen(false)
      }

      if (nextState.error) {
        setIsOpen(true)
      }

      return nextState
    },
    initialState
  )

  if (!isOpen) {
    return (
      <div>
        <button
          type='button'
          onClick={() => setIsOpen(true)}
          className='bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium'
        >
          Add reserve
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className='rounded-lg border p-4'>
      <h2 className='font-medium'>Add reserve</h2>
      <p className='text-muted-foreground mt-1 text-sm'>
        Create earmarked reserves for specific projects or purposes.
      </p>

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
            placeholder='CAPITAL'
            className='rounded-md border px-3 py-2 text-sm'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <label className='pl-2 text-sm font-medium'>Reserve name</label>
          <input
            name='name'
            placeholder='Capital projects reserve'
            className='rounded-md border px-3 py-2 text-sm'
          />
        </div>
        <div className='flex items-end gap-2'>
          <button
            type='submit'
            disabled={isPending}
            className='bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50'
          >
            {isPending ? 'Adding...' : 'Add reserve'}
          </button>

          <button
            type='button'
            onClick={() => setIsOpen(false)}
            className='rounded-md border px-4 py-2 text-sm font-medium'
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
