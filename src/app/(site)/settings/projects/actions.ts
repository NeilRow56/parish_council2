// src/app/(app)/settings/projects/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { projects } from '@/db/schema'
import { requireParishCouncil } from '@/lib/auth/require-parish-council'
import {
  createProjectSchema,
  updateProjectSchema
} from '@/lib/validation/reserves-projects-suppliers'

export type ProjectActionState = {
  error?: string
  success?: string
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? '').trim()
}

export async function createProjectAction(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const { parishCouncilId } = await requireParishCouncil()

  const parsed = createProjectSchema.safeParse({
    code: formData.get('code'),
    name: formData.get('name'),
    reserveId: formData.get('reserveId'),
    description: formData.get('description')
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid project.'
    }
  }

  const data = parsed.data

  try {
    await db.insert(projects).values({
      parishCouncilId,
      reserveId: data.reserveId,
      code: data.code,
      name: data.name,
      description: data.description,
      isActive: true
    })
  } catch {
    return {
      error: 'A project with this code or name already exists.'
    }
  }

  revalidatePath('/settings/projects')

  return {
    success: 'Project added.'
  }
}

export async function updateProjectAction(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const { parishCouncilId } = await requireParishCouncil()

  const parsed = updateProjectSchema.safeParse({
    id: formData.get('id'),
    code: formData.get('code'),
    name: formData.get('name'),
    reserveId: formData.get('reserveId'),
    description: formData.get('description'),
    isActive: formData.get('isActive')
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid project.'
    }
  }

  const data = parsed.data

  try {
    await db
      .update(projects)
      .set({
        code: data.code,
        name: data.name,
        reserveId: data.reserveId,
        description: data.description,
        isActive: data.isActive,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(projects.id, data.id),
          eq(projects.parishCouncilId, parishCouncilId)
        )
      )
  } catch {
    return {
      error:
        'Could not update project. A project with this code or name may already exist.'
    }
  }

  revalidatePath('/settings/projects')

  return {
    success: 'Project saved.'
  }
}

export async function deleteProjectAction(formData: FormData) {
  const { parishCouncilId } = await requireParishCouncil()

  const id = clean(formData.get('id'))

  if (!id) {
    throw new Error('Project id is required.')
  }

  await db
    .delete(projects)
    .where(
      and(eq(projects.id, id), eq(projects.parishCouncilId, parishCouncilId))
    )

  revalidatePath('/settings/projects')
}
