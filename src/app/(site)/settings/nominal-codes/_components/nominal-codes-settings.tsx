'use client'

import { useMemo, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'

import { createNominalCodeAction, updateNominalCodeAction } from '../actions'

type NominalCodeType = 'INCOME' | 'EXPENDITURE' | 'BALANCE_SHEET'

type NominalCodeRow = {
  id: string
  code: string
  name: string
  type: NominalCodeType
  category: string | null
  isBank: boolean
  isActive: boolean
}

type Filter = 'ALL' | NominalCodeType | 'BANK' | 'INACTIVE'

function typeLabel(type: NominalCodeType) {
  if (type === 'BALANCE_SHEET') return 'Balance sheet'
  if (type === 'EXPENDITURE') return 'Expenditure'
  return 'Income'
}

export function NominalCodesSettings({
  financialYearId,
  codes
}: {
  financialYearId: string
  codes: NominalCodeRow[]
}) {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const filteredCodes = useMemo(() => {
    if (filter === 'ALL') return codes
    if (filter === 'BANK') return codes.filter(code => code.isBank)
    if (filter === 'INACTIVE') return codes.filter(code => !code.isActive)

    return codes.filter(code => code.type === filter)
  }, [codes, filter])

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between gap-4'>
        <div className='flex flex-wrap items-center gap-2'>
          {[
            ['ALL', 'All'],
            ['INCOME', 'Income'],
            ['EXPENDITURE', 'Expenditure'],
            ['BALANCE_SHEET', 'Balance sheet'],
            ['BANK', 'Bank/cash'],
            ['INACTIVE', 'Inactive']
          ].map(([value, label]) => (
            <button
              key={value}
              type='button'
              onClick={() => setFilter(value as Filter)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                filter === value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type='button'
          onClick={() => setShowCreate(current => !current)}
          className='inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white'
        >
          <Plus className='h-4 w-4' />
          Add nominal code
        </button>
      </div>

      {showCreate && (
        <CreateNominalCodeForm
          financialYearId={financialYearId}
          onDone={() => setShowCreate(false)}
        />
      )}

      <div className='overflow-hidden rounded-lg border bg-white shadow-sm'>
        <table className='w-full border-collapse text-sm'>
          <thead className='bg-zinc-50 text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Code</th>
              <th className='px-4 py-3 font-medium'>Name</th>
              <th className='px-4 py-3 font-medium'>Type</th>
              <th className='px-4 py-3 font-medium'>Category</th>
              <th className='px-4 py-3 font-medium'>Bank/cash</th>
              <th className='px-4 py-3 font-medium'>Status</th>
              <th className='px-4 py-3 text-right font-medium'>Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredCodes.map(code => (
              <tr key={code.id} className='border-t'>
                {editingId === code.id ? (
                  <EditNominalCodeRow
                    code={code}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <td className='px-4 py-3 font-medium'>{code.code}</td>
                    <td className='px-4 py-3'>{code.name}</td>
                    <td className='px-4 py-3'>{typeLabel(code.type)}</td>
                    <td className='px-4 py-3'>{code.category ?? '—'}</td>
                    <td className='px-4 py-3'>{code.isBank ? 'Yes' : 'No'}</td>
                    <td className='px-4 py-3'>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          code.isActive
                            ? 'bg-green-50 text-green-700'
                            : 'bg-zinc-100 text-zinc-500'
                        }`}
                      >
                        {code.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-right'>
                      <button
                        type='button'
                        onClick={() => setEditingId(code.id)}
                        className='rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50'
                      >
                        Edit
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CreateNominalCodeForm({
  financialYearId,
  onDone
}: {
  financialYearId: string
  onDone: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<NominalCodeType>('EXPENDITURE')
  const [category, setCategory] = useState('')
  const [isBank, setIsBank] = useState(false)

  function submit() {
    setError(null)

    startTransition(async () => {
      try {
        await createNominalCodeAction({
          financialYearId,
          code,
          name,
          type,
          category,
          isBank
        })

        setCode('')
        setName('')
        setType('EXPENDITURE')
        setCategory('')
        setIsBank(false)
        onDone()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not create nominal code.'
        )
      }
    })
  }

  return (
    <div className='rounded-lg border bg-white p-4 shadow-sm'>
      <h2 className='font-semibold'>Add nominal code</h2>

      {error && (
        <p className='mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
          {error}
        </p>
      )}

      <div className='mt-4 grid gap-4 md:grid-cols-[120px_1fr_180px_220px_120px]'>
        <input
          value={code}
          onChange={event => setCode(event.target.value)}
          placeholder='Code'
          className='rounded-md border px-3 py-2 text-sm'
        />

        <input
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder='Name'
          className='rounded-md border px-3 py-2 text-sm'
        />

        <select
          value={type}
          onChange={event => setType(event.target.value as NominalCodeType)}
          className='rounded-md border px-3 py-2 text-sm'
        >
          <option value='INCOME'>Income</option>
          <option value='EXPENDITURE'>Expenditure</option>
          <option value='BALANCE_SHEET'>Balance sheet</option>
        </select>

        <input
          value={category}
          onChange={event => setCategory(event.target.value)}
          placeholder='Category'
          className='rounded-md border px-3 py-2 text-sm'
        />

        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={isBank}
            onChange={event => setIsBank(event.target.checked)}
          />
          Bank/cash
        </label>
      </div>

      <div className='mt-4 flex justify-end gap-2'>
        <button
          type='button'
          onClick={onDone}
          className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
        >
          Cancel
        </button>

        <button
          type='button'
          onClick={submit}
          disabled={isPending}
          className='rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-50'
        >
          {isPending ? 'Saving...' : 'Save nominal code'}
        </button>
      </div>
    </div>
  )
}

function EditNominalCodeRow({
  code,
  onDone
}: {
  code: NominalCodeRow
  onDone: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(code.name)
  const [category, setCategory] = useState(code.category ?? '')
  const [isActive, setIsActive] = useState(code.isActive)

  function submit() {
    setError(null)

    startTransition(async () => {
      try {
        await updateNominalCodeAction({
          id: code.id,
          name,
          category,
          isActive
        })

        onDone()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not update nominal code.'
        )
      }
    })
  }

  return (
    <>
      <td className='px-4 py-3 align-top font-medium'>{code.code}</td>

      <td className='px-4 py-3 align-top'>
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          className='w-full rounded-md border px-3 py-2 text-sm'
        />
        {error && <p className='mt-2 text-xs text-red-600'>{error}</p>}
      </td>

      <td className='px-4 py-3 align-top'>{typeLabel(code.type)}</td>

      <td className='px-4 py-3 align-top'>
        <input
          value={category}
          onChange={event => setCategory(event.target.value)}
          className='w-full rounded-md border px-3 py-2 text-sm'
        />
      </td>

      <td className='px-4 py-3 align-top'>{code.isBank ? 'Yes' : 'No'}</td>

      <td className='px-4 py-3 align-top'>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            checked={isActive}
            onChange={event => setIsActive(event.target.checked)}
          />
          Active
        </label>
      </td>

      <td className='px-4 py-3 text-right align-top'>
        <div className='flex justify-end gap-2'>
          <button
            type='button'
            onClick={onDone}
            className='rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50'
          >
            Cancel
          </button>

          <button
            type='button'
            onClick={submit}
            disabled={isPending}
            className='rounded-md bg-slate-950 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50'
          >
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </td>
    </>
  )
}
