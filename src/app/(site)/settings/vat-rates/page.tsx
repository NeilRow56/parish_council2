// src/app/(app)/settings/vat-rates/page.tsx

import { asc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { vatRates } from '@/db/schema'
import { requireParishCouncil } from '@/lib/auth/require-parish-council'
import { VatRateRowForm } from './_components/vat-rate-row-form'

export default async function VatRatesSettingsPage() {
  const { parishCouncilId } = await requireParishCouncil()

  const vatRateRows = await db
    .select()
    .from(vatRates)
    .where(eq(vatRates.parishCouncilId, parishCouncilId))
    .orderBy(asc(vatRates.sortOrder), asc(vatRates.name))

  return (
    <div className='mx-auto w-full max-w-6xl px-4 py-6'>
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-semibold'>VAT rates</h1>
          <p className='text-muted-foreground text-sm'>
            Manage council-specific VAT rates used when posting cash and bank
            entries.
          </p>
          <p className='text-muted-foreground mt-2 text-sm'>
            Changes affect future entries only. Existing posted transactions
            keep their original VAT amounts.
          </p>
        </div>

        <div className='overflow-hidden rounded-lg border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50'>
              <tr className='grid grid-cols-[160px_1fr_140px_120px_120px_170px] items-center gap-3 px-4 py-3'>
                <th className='text-left font-medium'>Code</th>
                <th className='text-left font-medium'>Name</th>
                <th className='text-right font-medium'>Rate</th>
                <th className='text-left font-medium'>Sort</th>
                <th className='text-left font-medium'>Status</th>
                <th className='text-right font-medium'>Actions</th>
              </tr>
            </thead>

            <tbody>
              {vatRateRows.map(vatRate => (
                <tr key={vatRate.id} className='block border-t'>
                  <td className='block p-0'>
                    <VatRateRowForm vatRate={vatRate} />
                  </td>
                </tr>
              ))}

              {vatRateRows.length === 0 && (
                <tr>
                  <td className='text-muted-foreground block px-4 py-6 text-center'>
                    No VAT rates found.
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
