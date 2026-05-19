// src/app/(app)/settings/vat-rates/_components/vat-rate-row-form.tsx

'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'

import { vatRates } from '@/db/schema'
import {
  deleteVatRateAction,
  updateVatRateAction,
  type VatRateActionState
} from '../actions'

type VatRateRow = typeof vatRates.$inferSelect

type Props = {
  vatRate: VatRateRow
}

const initialState: VatRateActionState = {}

export function VatRateRowForm({ vatRate }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateVatRateAction,
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
      <input type='hidden' name='id' value={vatRate.id} />

      {state.error && (
        <p className='mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          {state.error}
        </p>
      )}

      <div className='grid grid-cols-[160px_1fr_140px_120px_120px_170px] items-center gap-3'>
        <div className='rounded-md border bg-zinc-50 px-3 py-2 text-sm text-zinc-600'>
          {vatRate.code}
        </div>

        <input
          name='name'
          defaultValue={vatRate.name}
          className='rounded-md border px-3 py-2 text-sm'
        />

        <div className='flex items-center gap-2'>
          <input
            name='ratePercent'
            type='text'
            inputMode='decimal'
            defaultValue={vatRate.ratePercent}
            className='w-full rounded-md border px-3 py-2 text-right text-sm'
          />
          <span className='text-sm text-zinc-500'>%</span>
        </div>

        <input
          name='sortOrder'
          type='number'
          defaultValue={vatRate.sortOrder}
          className='rounded-md border px-3 py-2 text-sm'
        />

        {vatRate.code === 'NO_VAT' ? (
          <span className='text-sm text-zinc-600'>Always active</span>
        ) : (
          <label className='flex items-center gap-2 text-sm'>
            <input
              type='checkbox'
              name='isActive'
              defaultChecked={vatRate.isActive}
            />
            Active
          </label>
        )}

        <div className='flex justify-end gap-2'>
          <button
            type='submit'
            disabled={isPending}
            className='rounded-md border px-3 py-2 text-sm disabled:opacity-50'
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </button>

          {!vatRate.isSystem && (
            <button
              type='submit'
              formAction={deleteVatRateAction}
              disabled={isPending}
              className='text-destructive rounded border border-solid border-red-600 px-2 py-1 text-sm'
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {vatRate.isSystem && (
        <p className='mt-2 text-xs text-zinc-500'>
          System VAT rate. The code is fixed, but the name, percentage, sort
          order and active status can be managed here.
        </p>
      )}
    </form>
  )
}
