// src/app/(app)/settings/projects/_components/add-project-form.tsx

'use client'

import { useActionState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'

import { createProjectAction, type ProjectActionState } from '../actions'

type Option = {
  id: string
  label: string
  isDefault?: boolean
}

type Props = {
  reserveOptions: Option[]
}

const initialState: ProjectActionState = {}

export function AddProjectForm({ reserveOptions }: Props) {
  const [state, formAction, isPending] = useActionState(
    createProjectAction,
    initialState
  )

  const defaultReserveId = useMemo(() => {
    return (
      reserveOptions.find(option => option.isDefault)?.id ??
      reserveOptions[0]?.id ??
      ''
    )
  }, [reserveOptions])

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
    }

    if (state.error) {
      toast.error(state.error)
    }
  }, [state.success, state.error])

  return (
    <form action={formAction} className='rounded-lg border p-4'>
      <h2 className='font-medium'>Add project</h2>

      {state.error && (
        <p className='mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          {state.error}
        </p>
      )}

      {reserveOptions.length === 0 && (
        <p className='mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700'>
          Add a reserve before creating projects.
        </p>
      )}

      <div className='mt-4 grid gap-3 md:grid-cols-[140px_1fr_220px_auto]'>
        <div className='flex flex-col gap-1'>
          <label className='pl-2 text-sm font-medium'>Project code</label>
          <input
            name='code'
            placeholder='PLAY'
            className='rounded-md border px-3 py-2 text-sm'
          />
        </div>

        <div className='flex flex-col gap-1'>
          <label className='pl-2 text-sm font-medium'>Project name</label>
          <input
            name='name'
            placeholder='Playground refurbishment'
            className='rounded-md border px-3 py-2 text-sm'
          />
        </div>

        <div className='flex flex-col gap-1'>
          <label className='pl-2 text-sm font-medium'>Reserve</label>
          <select
            name='reserveId'
            defaultValue={defaultReserveId}
            disabled={reserveOptions.length === 0}
            className='rounded-md border px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500'
          >
            {reserveOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type='submit'
          disabled={isPending || reserveOptions.length === 0}
          className='bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50'
        >
          {isPending ? 'Adding...' : 'Add project'}
        </button>

        <input
          name='description'
          placeholder='Description'
          className='rounded-md border px-3 py-2 text-sm md:col-span-4'
        />
      </div>
    </form>
  )
}
