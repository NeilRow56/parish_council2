// src/app/(site)/settings/suppliers/page.tsx
import { asc, and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { nominalCodes, projects, reserves, suppliers } from '@/db/schema'
import { requireParishCouncil } from '@/lib/auth/require-parish-council'
import { AddSupplierForm } from './_components/add-supplier-form'
import { SupplierRowForm } from './_components/supplier-row-form'

export default async function SuppliersSettingsPage() {
  const { parishCouncilId } = await requireParishCouncil()

  const [supplierRows, nominalRows, reserveRows, projectRows] =
    await Promise.all([
      db
        .select()
        .from(suppliers)
        .where(eq(suppliers.parishCouncilId, parishCouncilId))
        .orderBy(asc(suppliers.name)),

      db
        .select()
        .from(nominalCodes)
        .where(
          and(
            eq(nominalCodes.parishCouncilId, parishCouncilId),
            eq(nominalCodes.isActive, true)
          )
        )
        .orderBy(asc(nominalCodes.code)),

      db
        .select()
        .from(reserves)
        .where(eq(reserves.parishCouncilId, parishCouncilId))
        .orderBy(asc(reserves.name)),

      db
        .select()
        .from(projects)
        .where(eq(projects.parishCouncilId, parishCouncilId))
        .orderBy(asc(projects.name))
    ])

  const nominalOptions = nominalRows.map(code => ({
    id: code.id,
    label: `${code.code} — ${code.name}`
  }))

  const reserveOptions = reserveRows.map(reserve => ({
    id: reserve.id,
    label: reserve.name
  }))

  const projectOptions = projectRows.map(project => ({
    id: project.id,
    label: project.name
  }))

  return (
    <div className='mx-auto w-full max-w-6xl px-4 py-6'>
      <div className='space-y-6'>
        <div>
          <h1 className='text-2xl font-semibold'>Suppliers</h1>
          <p className='text-muted-foreground text-sm'>
            Manage repeat suppliers and their default VAT126/reporting details.
          </p>
        </div>

        <AddSupplierForm
          nominalOptions={nominalOptions}
          reserveOptions={reserveOptions}
          projectOptions={projectOptions}
        />

        <div className='overflow-hidden rounded-lg border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50'>
              <tr className='grid grid-cols-[1fr_180px_1fr_120px_160px] items-center gap-3 px-4 py-3'>
                <th className='text-left font-medium'>Supplier</th>
                <th className='text-left font-medium'>VAT No.</th>
                <th className='text-left font-medium'>Default goods</th>
                <th className='text-left font-medium'>Status</th>
                <th className='text-right font-medium'>Actions</th>
              </tr>
            </thead>

            <tbody>
              {supplierRows.map(supplier => (
                <tr
                  key={[
                    supplier.id,
                    supplier.defaultNominalCodeId ?? '',
                    supplier.defaultReserveId ?? '',
                    supplier.defaultProjectId ?? ''
                  ].join(':')}
                  className='block border-t'
                >
                  <td className='block p-0'>
                    <SupplierRowForm
                      supplier={supplier}
                      nominalOptions={nominalOptions}
                      reserveOptions={reserveOptions}
                      projectOptions={projectOptions}
                    />
                  </td>
                </tr>
              ))}

              {supplierRows.length === 0 && (
                <tr>
                  <td className='text-muted-foreground block px-4 py-6 text-center'>
                    No suppliers found.
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
