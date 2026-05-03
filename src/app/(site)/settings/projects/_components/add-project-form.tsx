// src/app/(app)/settings/projects/_components/add-project-form.tsx
'use client'

import { useActionState, useEffect } from 'react'

import { createProjectAction, type ProjectActionState } from '../actions'
import { toast } from 'sonner'

type Option = {
  id: string
  label: string
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

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
    }
  }, [state.success])

  return (
    <form action={formAction} className='rounded-lg border p-4'>
      <h2 className='font-medium'>Add project</h2>

      {state.error && (
        <p className='mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          {state.error}
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

        <select
          name='reserveId'
          defaultValue=''
          className='rounded-md border px-3 py-2 text-sm'
        >
          <option value=''>No reserve</option>
          {reserveOptions.map(option => (
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
