// src/app/(app)/settings/projects/page.tsx
import { asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { projects, reserves } from '@/db/schema'
import { requireParishCouncil } from '@/lib/auth/require-parish-council'
import { AddProjectForm } from './_components/add-project-form'
import { ProjectRowForm } from './_components/project-row-form'

export default async function ProjectsSettingsPage() {
  const { parishCouncilId } = await requireParishCouncil()

  const [projectRows, reserveRows] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(eq(projects.parishCouncilId, parishCouncilId))
      .orderBy(asc(projects.name)),

    db
      .select()
      .from(reserves)
      .where(eq(reserves.parishCouncilId, parishCouncilId))
      .orderBy(asc(reserves.name))
  ])

  const reserveOptions = reserveRows.map(reserve => ({
    id: reserve.id,
    label: reserve.name
  }))

  return (
    <div className='mx-auto w-full max-w-6xl px-4 py-6'>
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-semibold'>Projects</h1>
          <p className='text-muted-foreground text-sm'>
            Manage optional projects that payments can be allocated to.
          </p>
        </div>

        <AddProjectForm reserveOptions={reserveOptions} />

        <div className='overflow-hidden rounded-lg border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50'>
              <tr className='grid grid-cols-[140px_1fr_220px_120px_160px] items-center gap-3 px-4 py-3'>
                <th className='text-left font-medium'>Code</th>
                <th className='text-left font-medium'>Name</th>
                <th className='text-left font-medium'>Reserve</th>
                <th className='text-left font-medium'>Status</th>
                <th className='text-right font-medium'>Actions</th>
              </tr>
            </thead>

            <tbody>
              {projectRows.map(project => (
                <tr key={project.id} className='block border-t'>
                  <td className='block p-0'>
                    <ProjectRowForm
                      project={project}
                      reserveOptions={reserveOptions}
                    />
                  </td>
                </tr>
              ))}

              {projectRows.length === 0 && (
                <tr>
                  <td className='text-muted-foreground block px-4 py-6 text-center'>
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
