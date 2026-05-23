'use client'

import { useMemo, useState, useTransition } from 'react'
import { CircleHelp, Plus } from 'lucide-react'
import { toast } from 'sonner'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { createNominalCodeAction, updateNominalCodeAction } from '../actions'

type NominalCodeType = 'INCOME' | 'EXPENDITURE' | 'BALANCE_SHEET'

type NominalCodeRow = {
  id: string
  code: string
  name: string
  type: NominalCodeType
  category: string | null
  agarBox: AgarBox | null
  isBank: boolean
  isActive: boolean
}

type Filter = 'ALL' | NominalCodeType | 'BANK' | 'INACTIVE'

type AgarBox =
  | 'BOX_2_PRECEPT'
  | 'BOX_3_OTHER_RECEIPTS'
  | 'BOX_4_STAFF_COSTS'
  | 'BOX_5_LOAN_REPAYMENTS'
  | 'BOX_6_OTHER_PAYMENTS'
  | 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS'
  | 'BOX_9_FIXED_ASSETS'
  | 'BOX_10_BORROWINGS'

const agarBoxOptions: Array<{ value: AgarBox; label: string }> = [
  { value: 'BOX_2_PRECEPT', label: 'Box 2 — Precept / rates and levies' },
  { value: 'BOX_3_OTHER_RECEIPTS', label: 'Box 3 — Other receipts' },
  { value: 'BOX_4_STAFF_COSTS', label: 'Box 4 — Staff costs' },
  { value: 'BOX_5_LOAN_REPAYMENTS', label: 'Box 5 — Loan repayments' },
  { value: 'BOX_6_OTHER_PAYMENTS', label: 'Box 6 — Other payments' },
  {
    value: 'BOX_8_CASH_AND_SHORT_TERM_INVESTMENTS',
    label: 'Box 8 — Cash and short-term investments'
  },
  { value: 'BOX_9_FIXED_ASSETS', label: 'Box 9 — Fixed assets' },
  { value: 'BOX_10_BORROWINGS', label: 'Box 10 — Borrowings' }
]

function agarBoxLabel(value: AgarBox | null) {
  return agarBoxOptions.find(option => option.value === value)?.label ?? '—'
}

function typeLabel(type: NominalCodeType) {
  if (type === 'BALANCE_SHEET') return 'Balance sheet'
  if (type === 'EXPENDITURE') return 'Expenditure'
  return 'Income'
}

export function NominalCodesSettings({
  financialYearId,
  codes,
  categoryOptions
}: {
  financialYearId: string
  codes: NominalCodeRow[]
  categoryOptions: string[]
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
                  : 'border-emerald-100 bg-white text-slate-600 hover:bg-emerald-50/40'
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
          categoryOptions={categoryOptions}
          onDone={() => setShowCreate(false)}
        />
      )}

      <div className='overflow-hidden rounded-lg border bg-white shadow-sm'>
        <table className='w-full border-collapse text-sm'>
          <thead className='bg-emerald-50/30 text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Code</th>
              <th className='px-4 py-3 font-medium'>Name</th>
              <th className='px-4 py-3 font-medium'>Type</th>
              <th className='px-4 py-3 font-medium'>Category</th>
              <th className='px-4 py-3 font-medium'>AGAR box</th>
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
                    categoryOptions={categoryOptions}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <td className='px-4 py-3 font-medium'>{code.code}</td>
                    <td className='px-4 py-3'>{code.name}</td>
                    <td className='px-4 py-3'>{typeLabel(code.type)}</td>
                    <td className='px-4 py-3'>{code.category ?? '—'}</td>
                    <td className='px-4 py-3'>{agarBoxLabel(code.agarBox)}</td>
                    <td className='px-4 py-3'>{code.isBank ? 'Yes' : 'No'}</td>
                    <td className='px-4 py-3'>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          code.isActive
                            ? 'bg-green-50 text-green-700'
                            : 'bg-emerald-100/30 text-zinc-500'
                        }`}
                      >
                        {code.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-right'>
                      <button
                        type='button'
                        onClick={() => setEditingId(code.id)}
                        className='rounded-md border px-3 py-1.5 text-sm hover:bg-emerald-50/40'
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

function HelpTooltip({
  label,
  children
}: {
  label: string
  children: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type='button'
            className='inline-flex rounded-full text-zinc-400 outline-none hover:text-zinc-700 focus-visible:ring-2 focus-visible:ring-slate-400'
            aria-label={label}
          >
            <CircleHelp className='h-3.5 w-3.5' />
          </button>
        }
      />
      <TooltipContent side='top'>{children}</TooltipContent>
    </Tooltip>
  )
}

function FieldLabel({
  children,
  tooltip
}: {
  children: string
  tooltip: string
}) {
  return (
    <span className='mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-600'>
      {children}
      <HelpTooltip label={`${children} help`}>{tooltip}</HelpTooltip>
    </span>
  )
}

function CategoryInput({
  value,
  onChange,
  options,
  className = 'w-full rounded-md border px-3 py-2 text-sm'
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      className={className}
    >
      <option value=''>No category</option>
      {options.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

function CreateNominalCodeForm({
  financialYearId,
  categoryOptions,
  onDone
}: {
  financialYearId: string
  categoryOptions: string[]
  onDone: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<NominalCodeType>('EXPENDITURE')
  const [category, setCategory] = useState('')
  const [agarBox, setAgarBox] = useState<AgarBox | ''>('')
  const [isBank, setIsBank] = useState(false)

  function submit() {
    setError(null)

    if (!code.trim()) {
      const message = 'Code is required.'
      setError(message)
      toast.error(message)
      return
    }

    if (!name.trim()) {
      const message = 'Name is required.'
      setError(message)
      toast.error(message)
      return
    }

    if (isBank && type !== 'BALANCE_SHEET') {
      const message = 'Bank/cash nominal codes must be balance sheet codes.'
      setError(message)
      toast.error(message)
      return
    }

    startTransition(async () => {
      try {
        await createNominalCodeAction({
          financialYearId,
          code,
          name,
          type,
          category,
          agarBox: agarBox || null,
          isBank
        })

        setCode('')
        setName('')
        setType('EXPENDITURE')
        setCategory('')
        setAgarBox('')
        setIsBank(false)
        toast.success('Nominal code added.')
        onDone()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not create nominal code.'
        setError(message)
        toast.error(message)
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

      <p className='mt-4 text-sm text-zinc-600'>
        Choose the AGAR box this code should feed into. Only tick Bank/cash for
        actual bank or cash control accounts.
      </p>

      <div className='mt-3 grid gap-4 md:grid-cols-[120px_1fr_180px_220px_260px_140px]'>
        <label>
          <span className='mb-1 block text-xs font-medium text-zinc-600'>
            Code
          </span>
          <input
            value={code}
            onChange={event => setCode(event.target.value)}
            placeholder='Code'
            className='w-full rounded-md border px-3 py-2 text-sm'
          />
        </label>

        <label>
          <span className='mb-1 block text-xs font-medium text-zinc-600'>
            Name
          </span>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder='Name'
            className='w-full rounded-md border px-3 py-2 text-sm'
          />
        </label>

        <label>
          <FieldLabel tooltip='Choose Income, Expenditure, or Balance sheet based on the accounting nature of the code.'>
            Type
          </FieldLabel>
          <select
            value={type}
            onChange={event => setType(event.target.value as NominalCodeType)}
            className='w-full rounded-md border px-3 py-2 text-sm'
          >
            <option value='INCOME'>Income</option>
            <option value='EXPENDITURE'>Expenditure</option>
            <option value='BALANCE_SHEET'>Balance sheet</option>
          </select>
        </label>

        <label>
          <FieldLabel tooltip='Used to group nominal codes in reports and dropdowns. Pick an existing category where possible for consistency.'>
            Category
          </FieldLabel>
          <CategoryInput
            value={category}
            onChange={setCategory}
            options={categoryOptions}
          />
        </label>

        <label>
          <FieldLabel tooltip="Controls where this nominal code appears in the AGAR summary. Leave as 'No AGAR box' only for internal/control accounts that should not feed the return.">
            AGAR box
          </FieldLabel>
          <select
            value={agarBox}
            onChange={event => setAgarBox(event.target.value as AgarBox | '')}
            className='w-full rounded-md border px-3 py-2 text-sm'
          >
            <option value=''>No AGAR box</option>
            {agarBoxOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <FieldLabel tooltip='Tick only for real bank or cash accounts. These appear in banking and reconciliation workflows and feed AGAR Box 8 where mapped.'>
            Bank/cash
          </FieldLabel>
          <label className='flex h-10 items-center gap-2 rounded-md border px-3 text-sm'>
            <input
              type='checkbox'
              checked={isBank}
              onChange={event => setIsBank(event.target.checked)}
            />
            Bank/cash
          </label>
        </div>
      </div>

      <div className='mt-4 flex justify-end gap-2'>
        <button
          type='button'
          onClick={onDone}
          className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-emerald-50/40'
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
  categoryOptions,
  onDone
}: {
  code: NominalCodeRow
  categoryOptions: string[]
  onDone: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(code.name)
  const [category, setCategory] = useState(code.category ?? '')
  const [agarBox, setAgarBox] = useState<AgarBox | ''>(code.agarBox ?? '')
  const [isActive, setIsActive] = useState(code.isActive)

  function submit() {
    setError(null)

    if (!name.trim()) {
      const message = 'Name is required.'
      setError(message)
      toast.error(message)
      return
    }

    startTransition(async () => {
      try {
        await updateNominalCodeAction({
          id: code.id,
          name,
          category,
          agarBox: agarBox || null,
          isActive
        })

        toast.success('Nominal code saved.')
        onDone()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not update nominal code.'
        setError(message)
        toast.error(message)
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

      <td className='px-4 py-3 align-top'>
        <div className='flex items-center gap-1.5'>
          {typeLabel(code.type)}
          <HelpTooltip label='Type help'>
            Choose Income, Expenditure, or Balance sheet based on the
            accounting nature of the code.
          </HelpTooltip>
        </div>
      </td>

      <td className='px-4 py-3 align-top'>
        <FieldLabel tooltip='Used to group nominal codes in reports and dropdowns. Pick an existing category where possible for consistency.'>
          Category
        </FieldLabel>
        <CategoryInput
          value={category}
          onChange={setCategory}
          options={categoryOptions}
        />
      </td>
      <td className='px-4 py-3 align-top'>
        <FieldLabel tooltip="Controls where this nominal code appears in the AGAR summary. Leave as 'No AGAR box' only for internal/control accounts that should not feed the return.">
          AGAR box
        </FieldLabel>
        <select
          value={agarBox}
          onChange={event => setAgarBox(event.target.value as AgarBox | '')}
          className='w-full rounded-md border px-3 py-2 text-sm'
        >
          <option value=''>No AGAR box</option>
          {agarBoxOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </td>
      <td className='px-4 py-3 align-top'>
        <div className='flex items-center gap-1.5'>
          {code.isBank ? 'Yes' : 'No'}
          <HelpTooltip label='Bank/cash help'>
            Tick only for real bank or cash accounts. These appear in banking
            and reconciliation workflows and feed AGAR Box 8 where mapped.
          </HelpTooltip>
        </div>
      </td>

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
            className='rounded-md border px-3 py-1.5 text-sm hover:bg-emerald-50/40'
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
