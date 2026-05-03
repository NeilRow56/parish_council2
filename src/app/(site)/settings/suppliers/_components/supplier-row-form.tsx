// src/app/(app)/settings/suppliers/_components/supplier-row-form.tsx
'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'

import {
  deleteSupplierAction,
  updateSupplierAction,
  type SupplierActionState
} from '../actions'
import { suppliers } from '@/db/schema'

type Option = {
  id: string
  label: string
}

type SupplierRow = typeof suppliers.$inferSelect

type Props = {
  supplier: SupplierRow
  nominalOptions: Option[]
  reserveOptions: Option[]
  projectOptions: Option[]
}

const initialState: SupplierActionState = {}

export function SupplierRowForm({
  supplier,
  nominalOptions,
  reserveOptions,
  projectOptions
}: Props) {
  const [state, formAction, isPending] = useActionState(
    updateSupplierAction,
    initialState
  )

  useEffect(() => {
    if (state.success) toast.success(state.success)
  }, [state.success])

  return (
    <form action={formAction} className='px-4 py-4'>
      <input type='hidden' name='id' value={supplier.id} />

      {state.error && (
        <p className='mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          {state.error}
        </p>
      )}

      <div className='grid grid-cols-[1fr_180px_1fr_120px_160px] items-center gap-3'>
        <input
          name='name'
          defaultValue={supplier.name}
          className='rounded-md border px-3 py-2 text-sm'
        />

        <input
          name='vatNumber'
          defaultValue={supplier.vatNumber ?? ''}
          className='rounded-md border px-3 py-2 text-sm'
        />

        <input
          name='defaultGoodsSupplied'
          defaultValue={supplier.defaultGoodsSupplied ?? ''}
          className='rounded-md border px-3 py-2 text-sm'
        />

        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            name='isActive'
            defaultChecked={supplier.isActive}
          />
          Active
        </label>

        <div className='flex justify-end gap-2'>
          <button
            type='submit'
            disabled={isPending}
            className='rounded-md border px-3 py-2 text-sm disabled:opacity-50'
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>

          <button
            type='submit'
            formAction={deleteSupplierAction}
            className='text-destructive rounded border border-red-600 px-2 py-1 text-sm'
          >
            Delete
          </button>
        </div>
      </div>

      <div className='mt-4 border-t pt-4'>
        <p className='text-muted-foreground mb-2 text-xs font-medium'>
          Default allocations
        </p>

        <div className='grid grid-cols-3 gap-3'>
          <select
            name='defaultNominalCodeId'
            defaultValue={supplier.defaultNominalCodeId ?? ''}
            className='rounded-md border px-3 py-2 text-sm'
          >
            <option value=''>Default nominal code</option>
            {nominalOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            name='defaultReserveId'
            defaultValue={supplier.defaultReserveId ?? ''}
            className='rounded-md border px-3 py-2 text-sm'
          >
            <option value=''>Default reserve</option>
            {reserveOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            name='defaultProjectId'
            defaultValue={supplier.defaultProjectId ?? ''}
            className='rounded-md border px-3 py-2 text-sm'
          >
            <option value=''>Default project</option>
            {projectOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  )
}
