// src/app/(app)/settings/suppliers/_components/add-supplier-form.tsx
'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'

import { createSupplierAction, type SupplierActionState } from '../actions'

type Option = {
  id: string
  label: string
}

type Props = {
  nominalOptions: Option[]
  reserveOptions: Option[]
  projectOptions: Option[]
}

const initialState: SupplierActionState = {}

export function AddSupplierForm({
  nominalOptions,
  reserveOptions,
  projectOptions
}: Props) {
  const [state, formAction, isPending] = useActionState(
    createSupplierAction,
    initialState
  )

  // ✅ NEW: Use toast for successful system feedback.
  // Validation errors stay inline because they are tied to the form.
  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
    }
  }, [state.success])

  return (
    <form action={formAction} className='rounded-lg border p-4'>
      <h2 className='font-medium'>Add supplier</h2>

      {/* ✅ Keep validation errors inline so the user knows where to fix input */}
      {state.error && (
        <p className='mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          {state.error}
        </p>
      )}

      {/* ✅ Removed inline success message; success now appears as a toast */}

      <div className='mt-4 grid gap-3 md:grid-cols-2'>
        <input
          name='name'
          placeholder='Supplier name'
          className='rounded-md border px-3 py-2 text-sm'
        />

        <input
          name='vatNumber'
          placeholder='VAT number'
          className='rounded-md border px-3 py-2 text-sm'
        />

        <input
          name='defaultGoodsSupplied'
          placeholder='Default goods supplied'
          className='rounded-md border px-3 py-2 text-sm md:col-span-2'
        />

        <select
          name='defaultNominalCodeId'
          defaultValue=''
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
          defaultValue=''
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
          defaultValue=''
          className='rounded-md border px-3 py-2 text-sm'
        >
          <option value=''>Default project</option>
          {projectOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type='submit'
          disabled={isPending}
          className='bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50'
        >
          {isPending ? 'Adding...' : 'Add supplier'}
        </button>
      </div>
    </form>
  )
}
