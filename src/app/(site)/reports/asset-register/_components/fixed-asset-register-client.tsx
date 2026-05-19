// src/app/(site)/reports/asset-register/_components/fixed-asset-register-client.tsx

'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  createFixedAsset,
  disposeFixedAsset,
  updateFixedAsset
} from '../actions'

type FixedAssetRow = {
  id: string
  refNo: string | null
  category: string
  insuranceCategory: string | null
  description: string
  location: string | null
  dateAcquired: string | null
  purchaseCost: string | null
  assetRegisterValue: string
  notes: string | null
  nominalCodeId: string | null
}

type NominalCodeOption = {
  id: string
  code: string
  name: string
}

type ActionResult = { success: true } | { success: false; error: string }

function formatMoney(value: string | null) {
  const amount = Number(value ?? 0)

  if (amount === 0) return '—'

  return amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export function FixedAssetRegisterClient({
  financialYearId,
  assets,
  nominalCodes,
  readOnly
}: {
  financialYearId: string
  assets: FixedAssetRow[]
  nominalCodes: NominalCodeOption[]
  readOnly: boolean
}) {
  const [editingAsset, setEditingAsset] = useState<FixedAssetRow | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  function closeForm() {
    setEditingAsset(null)
    setShowForm(false)
  }

  function onSubmit(formData: FormData) {
    const category = String(formData.get('category') ?? '').trim()
    const description = String(formData.get('description') ?? '').trim()
    const purchaseCost = String(formData.get('purchaseCost') ?? '').trim()
    const assetRegisterValue = String(
      formData.get('assetRegisterValue') ?? ''
    ).trim()

    if (!category || !description || !assetRegisterValue) {
      toast.error('Category, description and asset value are required.')
      return
    }

    if (!Number.isFinite(Number(assetRegisterValue))) {
      toast.error('Asset register value must be a valid number.')
      return
    }

    if (purchaseCost && !Number.isFinite(Number(purchaseCost))) {
      toast.error('Purchase cost must be a valid number.')
      return
    }

    startTransition(async () => {
      const result: ActionResult = editingAsset
        ? await updateFixedAsset(editingAsset.id, formData)
        : await createFixedAsset(financialYearId, formData)

      if (result.success) {
        toast.success(editingAsset ? 'Asset updated' : 'Asset added')
        closeForm()
      } else {
        toast.error(result.error)
      }
    })
  }

  function onDispose(assetId: string) {
    if (!confirm('Mark this asset as disposed?')) return

    startTransition(async () => {
      const result: ActionResult = await disposeFixedAsset(assetId)

      if (result.success) {
        toast.success('Asset disposed')
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className='space-y-6'>
      {!readOnly ? (
        <div className='flex justify-end'>
          <button
            type='button'
            onClick={() => {
              setEditingAsset(null)
              setShowForm(true)
            }}
            className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800'
          >
            Add asset
          </button>
        </div>
      ) : null}

      {showForm ? (
        <section className='rounded-lg border bg-white p-5 shadow-sm'>
          <div className='mb-4 flex items-center justify-between'>
            <h2 className='text-lg font-semibold'>
              {editingAsset ? 'Edit asset' : 'Add asset'}
            </h2>

            <button
              type='button'
              onClick={closeForm}
              className='text-sm text-zinc-500 hover:text-zinc-900'
            >
              Cancel
            </button>
          </div>

          <form action={onSubmit} className='grid gap-4 md:grid-cols-2'>
            <div>
              <label className='text-sm font-medium'>Ref no.</label>
              <input
                name='refNo'
                defaultValue={editingAsset?.refNo ?? ''}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              />
            </div>

            <div>
              <label className='text-sm font-medium'>Category</label>
              <input
                name='category'
                required
                defaultValue={editingAsset?.category ?? ''}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
                placeholder='Street Furniture'
              />
            </div>

            <div>
              <label className='text-sm font-medium'>Insurance category</label>
              <input
                name='insuranceCategory'
                defaultValue={editingAsset?.insuranceCategory ?? ''}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
                placeholder='General Contents'
              />
            </div>

            <div>
              <label className='text-sm font-medium'>Nominal code</label>
              <select
                name='nominalCodeId'
                defaultValue={editingAsset?.nominalCodeId ?? ''}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              >
                <option value=''>No nominal code</option>
                {nominalCodes.map(code => (
                  <option key={code.id} value={code.id}>
                    {code.code} — {code.name}
                  </option>
                ))}
              </select>
            </div>

            <div className='md:col-span-2'>
              <label className='text-sm font-medium'>Description</label>
              <input
                name='description'
                required
                defaultValue={editingAsset?.description ?? ''}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              />
            </div>

            <div className='md:col-span-2'>
              <label className='text-sm font-medium'>Location</label>
              <input
                name='location'
                defaultValue={editingAsset?.location ?? ''}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              />
            </div>

            <div>
              <label className='text-sm font-medium'>Date acquired</label>
              <input
                name='dateAcquired'
                type='date'
                defaultValue={editingAsset?.dateAcquired ?? ''}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              />
            </div>

            <div>
              <label className='text-sm font-medium'>Purchase cost</label>
              <input
                name='purchaseCost'
                type='number'
                step='0.01'
                min='0'
                defaultValue={editingAsset?.purchaseCost ?? ''}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              />
            </div>

            <div>
              <label className='text-sm font-medium'>
                Asset register value
              </label>
              <input
                name='assetRegisterValue'
                type='number'
                step='0.01'
                min='0'
                required
                defaultValue={editingAsset?.assetRegisterValue ?? ''}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              />
            </div>

            <div className='md:col-span-2'>
              <label className='text-sm font-medium'>Notes</label>
              <textarea
                name='notes'
                rows={3}
                defaultValue={editingAsset?.notes ?? ''}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              />
            </div>

            <div className='flex justify-end md:col-span-2'>
              <button
                type='submit'
                disabled={isPending}
                className='rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50'
              >
                {isPending
                  ? 'Saving...'
                  : editingAsset
                    ? 'Save changes'
                    : 'Add asset'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className='overflow-hidden rounded-lg border bg-white shadow-sm'>
        {assets.length === 0 ? (
          <div className='p-10 text-center text-sm text-zinc-500'>
            No fixed assets found.
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='min-w-375 table-fixed border-collapse text-sm'>
              <colgroup>
                <col className='w-20' />
                <col className='w-40' />
                <col className='w-44' />
                <col className='w-80' />
                <col className='w-72' />
                <col className='w-32' />
                <col className='w-40' />
                <col className='w-36' />
                {!readOnly ? <col className='w-24' /> : null}
              </colgroup>

              <thead className='bg-zinc-50 text-left text-zinc-600'>
                <tr>
                  <th className='px-4 py-3 font-medium'>Ref</th>
                  <th className='px-4 py-3 font-medium'>Category</th>
                  <th className='px-4 py-3 font-medium'>Insurance category</th>
                  <th className='px-4 py-3 font-medium'>Description</th>
                  <th className='px-4 py-3 font-medium'>Location</th>
                  <th className='px-4 py-3 font-medium'>Date</th>
                  <th className='px-4 py-3 text-right font-medium'>
                    <span className='block'>Purchase cost</span>
                    <span className='block text-xs font-normal'>
                      (if known)
                    </span>
                  </th>
                  <th className='px-4 py-3 text-right font-medium'>
                    Register value
                  </th>
                  {!readOnly ? (
                    <th className='px-4 py-3 text-right font-medium'>
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>

              <tbody>
                {assets.map(asset => (
                  <tr key={asset.id} className='border-t'>
                    <td className='px-4 py-3 align-top'>
                      {asset.refNo || '—'}
                    </td>

                    <td className='px-4 py-3 align-top'>{asset.category}</td>

                    <td className='px-4 py-3 align-top'>
                      {asset.insuranceCategory || '—'}
                    </td>

                    <td className='px-4 py-3 align-top'>
                      <div className='wrap-break-words max-w-xs font-medium'>
                        {asset.description}
                      </div>
                      {asset.notes ? (
                        <div className='wrap-break-words mt-1 max-w-xs text-xs text-zinc-500'>
                          {asset.notes}
                        </div>
                      ) : null}
                    </td>

                    <td className='px-4 py-3 align-top'>
                      <div className='wrap-break-words max-w-sm'>
                        {asset.location || '—'}
                      </div>
                    </td>

                    <td className='px-4 py-3 align-top'>
                      {asset.dateAcquired || 'Not known'}
                    </td>

                    <td className='px-4 py-3 text-right align-top'>
                      {formatMoney(asset.purchaseCost)}
                    </td>

                    <td className='px-4 py-3 text-right align-top'>
                      {formatMoney(asset.assetRegisterValue)}
                    </td>

                    {!readOnly ? (
                      <td className='px-4 py-3 text-right align-top'>
                        <button
                          type='button'
                          onClick={() => {
                            setEditingAsset(asset)
                            setShowForm(true)
                          }}
                          className='text-sm font-medium text-blue-700 hover:underline'
                        >
                          Edit
                        </button>

                        <button
                          type='button'
                          onClick={() => onDispose(asset.id)}
                          className='ml-4 text-sm font-medium text-red-700 hover:underline'
                        >
                          Dispose
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
