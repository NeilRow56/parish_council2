// src/app/(site)/reports/asset-register/_components/fixed-asset-register-client.tsx

'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
  isDisposed: boolean
  disposalDate: string | null
  notes: string | null
}

type AccountingBasis = 'RECEIPTS_AND_PAYMENTS' | 'INCOME_AND_EXPENDITURE'

type ActionResult = { success: true } | { success: false; error: string }

function formatMoney(value: string | null) {
  const amount = Number(value ?? 0)

  if (amount === 0) return '—'

  return amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatTotalMoney(value: number) {
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  )
}

function isActiveAtYearEnd(asset: FixedAssetRow, yearEndDate: string) {
  return (
    !asset.isDisposed ||
    !asset.disposalDate ||
    asset.disposalDate > yearEndDate
  )
}

function formatDisplayDate(value: string | null) {
  if (!value) return 'Not known'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
}

export function FixedAssetRegisterClient({
  financialYearId,
  assets,
  insuranceCategoryOptions,
  accountingBasis,
  financialYearStartDate,
  financialYearEndDate,
  readOnly
}: {
  financialYearId: string
  assets: FixedAssetRow[]
  insuranceCategoryOptions: string[]
  accountingBasis: AccountingBasis
  financialYearStartDate: string
  financialYearEndDate: string
  readOnly: boolean
}) {
  const router = useRouter()
  const [editingAsset, setEditingAsset] = useState<FixedAssetRow | null>(null)
  const [disposingAsset, setDisposingAsset] = useState<FixedAssetRow | null>(
    null
  )
  const [showForm, setShowForm] = useState(false)
  const [insuranceCategory, setInsuranceCategory] = useState('')
  const [disposalDate, setDisposalDate] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    return today >= financialYearStartDate && today <= financialYearEndDate
      ? today
      : financialYearEndDate
  })
  const [disposalProceeds, setDisposalProceeds] = useState('0.00')
  const [isPending, startTransition] = useTransition()

  const totalPurchaseCost = assets.reduce(
    (sum, asset) =>
      isActiveAtYearEnd(asset, financialYearEndDate)
        ? sum + Number(asset.purchaseCost ?? 0)
        : sum,
    0
  )
  const totalRegisterValue = assets.reduce(
    (sum, asset) =>
      isActiveAtYearEnd(asset, financialYearEndDate)
        ? sum + Number(asset.assetRegisterValue ?? 0)
        : sum,
    0
  )
  const insuranceCategorySelectOptions = uniqueSorted([
    ...insuranceCategoryOptions,
    ...assets
      .map(asset => asset.insuranceCategory ?? asset.category)
      .filter((value): value is string => Boolean(value)),
    editingAsset?.insuranceCategory ?? editingAsset?.category ?? ''
  ])
  const disposalAssetValue = Number(disposingAsset?.assetRegisterValue ?? 0)
  const disposalProceedsAmount = Number(disposalProceeds || 0)
  const disposalProfitOrLoss = disposalProceedsAmount - disposalAssetValue
  const accountingBasisLabel =
    accountingBasis === 'RECEIPTS_AND_PAYMENTS'
      ? 'Receipts & Payments basis'
      : 'Income & Expenditure basis'

  function openNewAssetForm() {
    setEditingAsset(null)
    setInsuranceCategory('')
    setShowForm(true)
  }

  function openDisposePanel(asset: FixedAssetRow) {
    setDisposingAsset(asset)
    setDisposalProceeds('0.00')
  }

  function openEditAssetForm(asset: FixedAssetRow) {
    setEditingAsset(asset)
    setInsuranceCategory(asset.insuranceCategory ?? asset.category)
    setShowForm(true)
  }

  function closeForm() {
    setEditingAsset(null)
    setShowForm(false)
    setInsuranceCategory('')
  }

  function onSubmit(formData: FormData) {
    const insuranceCategory = String(
      formData.get('insuranceCategory') ?? ''
    ).trim()
    const description = String(formData.get('description') ?? '').trim()
    const purchaseCost = String(formData.get('purchaseCost') ?? '').trim()
    const assetRegisterValue = String(
      formData.get('assetRegisterValue') ?? ''
    ).trim()

    if (!insuranceCategory || !description || !assetRegisterValue) {
      toast.error(
        'Insurance category, description and asset value are required.'
      )
      return
    }

    formData.set('category', insuranceCategory)

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
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function closeDisposePanel() {
    setDisposingAsset(null)
    setDisposalProceeds('0.00')
  }

  function onDispose() {
    if (!disposingAsset) return

    const proceeds = Number(disposalProceeds || 0)

    if (!Number.isFinite(proceeds) || proceeds < 0) {
      toast.error('Disposal proceeds must be a valid non-negative number.')
      return
    }

    if (
      !disposalDate ||
      disposalDate < financialYearStartDate ||
      disposalDate > financialYearEndDate
    ) {
      toast.error('Disposal date must fall in the selected financial year.')
      return
    }

    startTransition(async () => {
      const result: ActionResult = await disposeFixedAsset(disposingAsset.id, {
        disposalDate,
        proceeds: disposalProceeds
      })

      if (result.success) {
        toast.success('Asset disposed')
        closeDisposePanel()
        router.refresh()
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
            onClick={openNewAssetForm}
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
              <label className='text-sm font-medium'>Insurance category</label>
              <select
                name='insuranceCategory'
                required
                value={insuranceCategory}
                onChange={event => setInsuranceCategory(event.target.value)}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              >
                <option value=''>Select insurance category</option>
                {insuranceCategorySelectOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <input type='hidden' name='category' value={insuranceCategory} />
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

      {disposingAsset ? (
        <section className='rounded-lg border bg-white p-5 shadow-sm'>
          <div className='mb-4 flex items-start justify-between gap-4'>
            <div>
              <h2 className='text-lg font-semibold'>Dispose asset</h2>
              <p className='mt-1 text-sm text-zinc-600'>
                {accountingBasisLabel}
              </p>
            </div>

            <button
              type='button'
              onClick={closeDisposePanel}
              className='text-sm text-zinc-500 hover:text-zinc-900'
            >
              Cancel
            </button>
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <div>
              <label className='text-sm font-medium'>Disposal date</label>
              <input
                type='date'
                min={financialYearStartDate}
                max={financialYearEndDate}
                value={disposalDate}
                onChange={event => setDisposalDate(event.target.value)}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              />
            </div>

            <div>
              <label className='text-sm font-medium'>Disposal proceeds</label>
              <input
                type='number'
                min='0'
                step='0.01'
                value={disposalProceeds}
                onChange={event => setDisposalProceeds(event.target.value)}
                className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
              />
            </div>
          </div>

          {accountingBasis === 'INCOME_AND_EXPENDITURE' ? (
            <dl className='mt-4 grid gap-4 rounded-md border bg-zinc-50 p-4 text-sm md:grid-cols-3'>
              <div>
                <dt className='text-zinc-500'>Asset value removed</dt>
                <dd className='mt-1 font-semibold'>
                  {formatCurrency(disposalAssetValue)}
                </dd>
              </div>

              <div>
                <dt className='text-zinc-500'>Disposal proceeds</dt>
                <dd className='mt-1 font-semibold'>
                  {formatCurrency(Number.isFinite(disposalProceedsAmount) ? disposalProceedsAmount : 0)}
                </dd>
              </div>

              <div>
                <dt className='text-zinc-500'>Resulting profit/loss</dt>
                <dd
                  className={`mt-1 font-semibold ${
                    disposalProfitOrLoss < 0 ? 'text-red-700' : 'text-zinc-900'
                  }`}
                >
                  {disposalProfitOrLoss < 0 ? 'Loss ' : 'Profit '}
                  {formatCurrency(Math.abs(disposalProfitOrLoss))}
                </dd>
              </div>
            </dl>
          ) : (
            <p className='mt-4 rounded-md border bg-zinc-50 p-4 text-sm text-zinc-700'>
              The asset register value removed will be{' '}
              <span className='font-semibold'>
                {formatCurrency(disposalAssetValue)}
              </span>
              .
            </p>
          )}

          <div className='mt-4 flex justify-end gap-3'>
            <button
              type='button'
              onClick={closeDisposePanel}
              className='rounded-md border px-4 py-2 text-sm font-medium hover:bg-zinc-50'
            >
              Cancel
            </button>
            <button
              type='button'
              disabled={isPending}
              onClick={onDispose}
              className='rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50'
            >
              {isPending ? 'Posting...' : 'Confirm disposal'}
            </button>
          </div>
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
                <col className='w-56' />
                <col className='w-80' />
                <col className='w-72' />
                <col className='w-32' />
                <col className='w-40' />
                <col className='w-36' />
                <col className='w-32' />
                {!readOnly ? <col className='w-24' /> : null}
              </colgroup>

              <thead className='bg-emerald-50/30 text-left text-zinc-600'>
                <tr>
                  <th className='px-4 py-3 font-medium'>Ref</th>
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
                  <th className='px-4 py-3 font-medium'>Status</th>
                  {!readOnly ? (
                    <th className='px-4 py-3 text-right font-medium'>
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>

              <tbody>
                {assets.map(asset => {
                  const isActive = isActiveAtYearEnd(
                    asset,
                    financialYearEndDate
                  )

                  return (
                    <tr
                      key={asset.id}
                      className={`border-t ${
                        isActive
                          ? ''
                          : 'bg-rose-50/60 text-zinc-700 [&_td]:border-rose-100'
                      }`}
                    >
                      <td className='px-4 py-3 align-top'>
                        {asset.refNo || '—'}
                      </td>

                      <td className='px-4 py-3 align-top'>
                        {asset.insuranceCategory || asset.category}
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

                      <td className='px-4 py-3 align-top'>
                        {isActive ? (
                          <span className='inline-flex h-5 items-center rounded-4xl border border-emerald-200 px-2 text-xs font-medium text-emerald-950'>
                            Active
                          </span>
                        ) : (
                          <div>
                            <span className='inline-flex h-5 items-center rounded-4xl border border-rose-200 bg-rose-100 px-2 text-xs font-medium text-rose-800'>
                              Disposed
                            </span>
                            <div className='mt-1 text-xs text-zinc-600'>
                              {formatDisplayDate(asset.disposalDate)}
                            </div>
                          </div>
                        )}
                      </td>

                      {!readOnly ? (
                        <td className='px-4 py-3 text-right align-top'>
                          {isActive ? (
                            <>
                              <button
                                type='button'
                                onClick={() => openEditAssetForm(asset)}
                                className='text-sm font-medium text-blue-700 hover:underline'
                              >
                                Edit
                              </button>

                              <button
                                type='button'
                                onClick={() => openDisposePanel(asset)}
                                className='ml-4 text-sm font-medium text-red-700 hover:underline'
                              >
                                Dispose
                              </button>
                            </>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className='border-t bg-zinc-50 font-semibold'>
                  <td className='px-4 py-3' />
                  <td className='px-4 py-3' />
                  <td className='px-4 py-3'>Totals</td>
                  <td className='px-4 py-3' />
                  <td className='px-4 py-3' />
                  <td className='px-4 py-3 text-right'>
                    {formatTotalMoney(totalPurchaseCost)}
                  </td>
                  <td className='px-4 py-3 text-right'>
                    {formatTotalMoney(totalRegisterValue)}
                  </td>
                  <td className='px-4 py-3' />
                  {!readOnly ? <td className='px-4 py-3' /> : null}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
