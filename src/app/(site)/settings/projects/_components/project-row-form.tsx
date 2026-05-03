// src/app/(app)/settings/projects/_components/project-row-form.tsx
'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'

import { projects } from '@/db/schema'
import {
  deleteProjectAction,
  updateProjectAction,
  type ProjectActionState
} from '../actions'

type ProjectRow = typeof projects.$inferSelect

type Option = {
  id: string
  label: string
}

type Props = {
  project: ProjectRow
  reserveOptions: Option[]
}

const initialState: ProjectActionState = {}

export function ProjectRowForm({ project, reserveOptions }: Props) {
  const [state, formAction, isPending] = useActionState(
    updateProjectAction,
    initialState
  )

  useEffect(() => {
    if (state.success) {
      toast.success(state.success)
    }
  }, [state.success])

  return (
    <form action={formAction} className='px-4 py-3'>
      <input type='hidden' name='id' value={project.id} />

      {state.error && (
        <p className='mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          {state.error}
        </p>
      )}

      <div className='grid grid-cols-[140px_1fr_220px_120px_160px] items-center gap-3'>
        <input
          name='code'
          defaultValue={project.code}
          className='rounded-md border px-3 py-2 text-sm'
        />

        <input
          name='name'
          defaultValue={project.name}
          className='rounded-md border px-3 py-2 text-sm'
        />

        <select
          name='reserveId'
          defaultValue={project.reserveId ?? ''}
          className='rounded-md border px-3 py-2 text-sm'
        >
          <option value=''>No reserve</option>
          {reserveOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            name='isActive'
            defaultChecked={project.isActive}
          />
          Active
        </label>

        <div className='flex justify-end gap-2'>
          <button
            type='submit'
            disabled={isPending}
            className='rounded-md border px-3 py-2 text-sm disabled:opacity-50'
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </button>

          <button
            type='submit'
            formAction={deleteProjectAction}
            className='text-destructive rounded border border-solid border-red-600 px-2 py-1 text-sm'
          >
            Delete
          </button>
        </div>

        <input
          name='description'
          defaultValue={project.description ?? ''}
          placeholder='Description'
          className='rounded-md border px-3 py-2 text-sm md:col-span-4'
        />
      </div>
    </form>
  )
}
