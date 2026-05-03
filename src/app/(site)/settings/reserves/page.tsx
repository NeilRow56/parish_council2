// src/app/(app)/settings/reserves/page.tsx
import { asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { reserves } from '@/db/schema'
import { requireParishCouncil } from '@/lib/auth/require-parish-council'
import { AddReserveForm } from './_components/add-reserve-form'
import { ReserveRowForm } from './_components/rserve-row-form'

export default async function ReservesSettingsPage() {
  const { parishCouncilId } = await requireParishCouncil()

  const rows = await db
    .select()
    .from(reserves)
    .where(eq(reserves.parishCouncilId, parishCouncilId))
    .orderBy(asc(reserves.name))

  return (
    <div className='mx-auto w-full max-w-5xl px-4 py-6'>
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-semibold'>Reserves</h1>
          <p className='text-muted-foreground text-sm'>
            Manage general and earmarked reserves used for payment allocation
            and VAT126 reporting.
          </p>
        </div>

        <AddReserveForm />

        <div className='overflow-hidden rounded-lg border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50'>
              <tr className='grid grid-cols-[160px_1fr_140px_180px] items-center gap-3 px-4 py-3'>
                <th className='text-left font-medium'>Code</th>
                <th className='text-left font-medium'>Name</th>
                <th className='text-left font-medium'>Status</th>
                <th className='text-right font-medium'>Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(row => (
                <tr key={row.id} className='block border-t'>
                  <td className='block p-0'>
                    <ReserveRowForm reserve={row} />
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td className='text-muted-foreground block px-4 py-6 text-center'>
                    No reserves found.
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
