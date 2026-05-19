// src/app/(app)/settings/projects/_components/project-row-form.tsx

'use client'

import { useActionState, useEffect, useMemo } from 'react'
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
  isDefault?: boolean
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

  const selectedReserveId = useMemo(() => {
    const reserveExists = reserveOptions.some(
      option => option.id === project.reserveId
    )

    if (reserveExists && project.reserveId) {
      return project.reserveId
    }

    return (
      reserveOptions.find(option => option.isDefault)?.id ??
      reserveOptions[0]?.id ??
      ''
    )
  }, [project.reserveId, reserveOptions])

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
          defaultValue={selectedReserveId}
          disabled={reserveOptions.length === 0}
          className='rounded-md border px-3 py-2 text-sm disabled:bg-zinc-50 disabled:text-zinc-500'
        >
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
            disabled={isPending || reserveOptions.length === 0}
            className='rounded-md border px-3 py-2 text-sm disabled:opacity-50'
          >
            {isPending ? 'Saving...' : 'Save changes'}
          </button>

          <button
            type='submit'
            formAction={deleteProjectAction}
            disabled={isPending}
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
