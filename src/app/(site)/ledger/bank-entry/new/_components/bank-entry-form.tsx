// src/app/(site)/ledger/bank-entry/new/_components/bank-entry-form.tsx

'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'

import { createBankEntryAction, quickCreateSupplierAction } from '../actions'
import { InvoiceUpload } from './invoice-upload'

type BankEntryType = 'PAYMENT' | 'RECEIPT'

type VatTreatment = 'RECOVERABLE' | 'IRRECOVERABLE' | 'OUTPUT' | 'OUTSIDE_SCOPE'

type BankAccountOption = {
  connectionId: string
  accountName: string
  accountLast4: string | null
  nominalCodeId: string
  nominalCode: string
  nominalName: string
}

type NominalCodeOption = {
  id: string
  code: string
  name: string
  type: string
  category: string | null
  isVatRecoverable?: boolean
  isVatPayable?: boolean
}

type SupplierOption = {
  id: string
  name: string
  vatNumber: string | null
  defaultGoodsSupplied: string | null
  defaultNominalCodeId: string | null
  defaultReserveId: string | null
  defaultProjectId: string | null
}

type ReserveOption = {
  id: string
  code: string
  name: string
  isDefault: boolean
}

type ProjectOption = {
  id: string
  reserveId: string
  code: string
  name: string
}

type VatRateOption = {
  id: string
  code: string
  name: string
  ratePercent: string
}

type BankEntryLine = {
  id: string
  nominalCodeId: string
  supplierId: string
  reserveId: string
  projectId: string
  invoiceReference: string
  goodsSupplied: string
  supplierVatNumberSnapshot: string
  description: string
  amount: string
  vatRateId: string
  vatTreatment: VatTreatment
  vatAmount: string
  vatManuallyEdited: boolean
  showDetails: boolean
}

const bankEntrySchema = z.object({
  date: z.string().min(1, 'Date is required.'),
  bankConnectionId: z.string().min(1, 'Cash/bank account is required.'),
  entryType: z.enum(['PAYMENT', 'RECEIPT']),
  lines: z
    .array(
      z.object({
        nominalCodeId: z.string().min(1, 'Nominal code is required.'),
        reserveId: z.string().min(1, 'Reserve is required.'),
        vatRateId: z.string().min(1, 'VAT rate is required.'),
        amount: z.coerce.number().positive('Amount must be greater than zero.')
      })
    )
    .min(1, 'At least one line is required.')
})

function createEmptyLine(
  defaultReserveId = '',
  defaultVatRateId = ''
): BankEntryLine {
  return {
    id: crypto.randomUUID(),
    nominalCodeId: '',
    supplierId: '',
    reserveId: defaultReserveId,
    projectId: '',
    invoiceReference: '',
    goodsSupplied: '',
    supplierVatNumberSnapshot: '',
    description: '',
    amount: '',
    vatRateId: defaultVatRateId,
    vatTreatment: 'OUTSIDE_SCOPE',
    vatAmount: '',
    vatManuallyEdited: false,
    showDetails: false
  }
}

function parseAmount(value: string) {
  return Number(value.replace(/,/g, '') || 0)
}

function getVatRatePercent(vatRateId: string, vatRates: VatRateOption[]) {
  const rate = vatRates.find(item => item.id === vatRateId)
  return Number(rate?.ratePercent ?? 0)
}

function splitGrossAmount(
  gross: number,
  vatRateId: string,
  vatRates: VatRateOption[]
) {
  const rate = getVatRatePercent(vatRateId, vatRates)

  if (!Number.isFinite(gross) || gross <= 0 || rate === 0) {
    return { gross, net: gross, vat: 0 }
  }

  const net = gross / (1 + rate / 100)
  const vat = gross - net

  return { gross, net, vat }
}

function formatMoney(value: number) {
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatMoneyInput(value: string) {
  const parsed = parseAmount(value)
  if (!Number.isFinite(parsed) || parsed < 0) return value
  return formatMoney(parsed)
}

function shouldUseVat(entryType: BankEntryType, line: BankEntryLine) {
  return (
    (entryType === 'PAYMENT' && line.vatTreatment === 'RECOVERABLE') ||
    (entryType === 'RECEIPT' && line.vatTreatment === 'OUTPUT')
  )
}

function getLineVatAmount(
  entryType: BankEntryType,
  line: BankEntryLine,
  vatRates: VatRateOption[]
) {
  if (!shouldUseVat(entryType, line)) return 0

  if (line.vatManuallyEdited) {
    return parseAmount(line.vatAmount)
  }

  return splitGrossAmount(parseAmount(line.amount), line.vatRateId, vatRates)
    .vat
}

function NominalCodeSelect({
  value,
  codes,
  onChange
}: {
  value: string
  codes: NominalCodeOption[]
  onChange: (value: string) => void
}) {
  const groupedCodes = useMemo(() => {
    const sorted = [...codes].sort((a, b) => {
      const categoryA = a.category ?? 'General'
      const categoryB = b.category ?? 'General'

      if (categoryA !== categoryB) return categoryA.localeCompare(categoryB)

      return a.code.localeCompare(b.code, undefined, { numeric: true })
    })

    return sorted.reduce<Record<string, NominalCodeOption[]>>((acc, code) => {
      const category = code.category ?? 'General'
      acc[category] = acc[category] ?? []
      acc[category].push(code)
      return acc
    }, {})
  }, [codes])

  const selectedCode = codes.find(code => code.id === value)

  return (
    <select
      value={value}
      title={selectedCode ? `${selectedCode.code} — ${selectedCode.name}` : ''}
      onChange={event => onChange(event.target.value)}
      className='w-full truncate rounded-md border px-3 py-2'
    >
      <option value=''>Select code</option>

      {Object.entries(groupedCodes).map(([category, categoryCodes]) => (
        <optgroup key={category} label={`— ${category} —`}>
          {categoryCodes.map(code => (
            <option key={code.id} value={code.id}>
              {code.code} — {code.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

export function BankEntryForm({
  financialYearId,
  bankAccounts,
  nominalCodes,
  suppliers,
  reserves,
  projects,
  defaultReserveId,
  vatRates
}: {
  financialYearId: string
  bankAccounts: BankAccountOption[]
  nominalCodes: NominalCodeOption[]
  suppliers: SupplierOption[]
  reserves: ReserveOption[]
  projects: ProjectOption[]
  defaultReserveId: string
  vatRates: VatRateOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uploadedInvoice, setUploadedInvoice] = useState<{
    url: string
    name: string
    key: string
  } | null>(null)

  const fallbackReserveId =
    defaultReserveId || reserves.find(reserve => reserve.isDefault)?.id || ''

  const defaultVatRateId =
    vatRates.find(rate => rate.code === 'NO_VAT')?.id ?? vatRates[0]?.id ?? ''

  function getValidVatRateId(vatRateId: string) {
    return vatRates.some(rate => rate.id === vatRateId)
      ? vatRateId
      : defaultVatRateId
  }

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [entryType, setEntryType] = useState<BankEntryType>('PAYMENT')
  const [bankConnectionId, setBankConnectionId] = useState(
    bankAccounts[0]?.connectionId ?? ''
  )
  const [reference, setReference] = useState('')

  const [showVat126Warning, setShowVat126Warning] = useState(false)

  const [supplierOptions, setSupplierOptions] =
    useState<SupplierOption[]>(suppliers)

  const [quickSupplierLineId, setQuickSupplierLineId] = useState<string | null>(
    null
  )
  const [quickSupplierName, setQuickSupplierName] = useState('')
  const [quickSupplierVatNumber, setQuickSupplierVatNumber] = useState('')
  const [quickSupplierGoodsSupplied, setQuickSupplierGoodsSupplied] =
    useState('')
  const [isQuickSupplierPending, startQuickSupplierTransition] = useTransition()

  const [lines, setLines] = useState<BankEntryLine[]>([
    createEmptyLine(fallbackReserveId, defaultVatRateId),
    createEmptyLine(fallbackReserveId, defaultVatRateId)
  ])

  const filteredCodes = useMemo(() => {
    if (entryType === 'PAYMENT') {
      return nominalCodes.filter(code =>
        ['EXPENDITURE', 'BALANCE_SHEET'].includes(code.type)
      )
    }

    return nominalCodes.filter(code =>
      ['INCOME', 'BALANCE_SHEET'].includes(code.type)
    )
  }, [entryType, nominalCodes])

  const totals = useMemo(() => {
    return lines.reduce(
      (sum, line) => {
        const gross = parseAmount(line.amount)
        const vat = getLineVatAmount(entryType, line, vatRates)
        const useVat = shouldUseVat(entryType, line)

        return {
          gross: sum.gross + gross,
          net: sum.net + (useVat ? gross - vat : gross),
          vat: sum.vat + (useVat ? vat : 0)
        }
      },
      { gross: 0, net: 0, vat: 0 }
    )
  }, [entryType, lines, vatRates])

  function updateLine(id: string, patch: Partial<BankEntryLine>) {
    setLines(current =>
      current.map(line => (line.id === id ? { ...line, ...patch } : line))
    )
  }

  function addLine() {
    setLines(current => [
      ...current,
      createEmptyLine(fallbackReserveId, defaultVatRateId)
    ])
  }

  function removeLine(id: string) {
    setLines(current => current.filter(line => line.id !== id))
  }

  function handleEntryTypeChange(value: BankEntryType) {
    setEntryType(value)

    setLines(current =>
      current.map(line => ({
        ...line,
        vatRateId: defaultVatRateId,
        vatTreatment: 'OUTSIDE_SCOPE',
        vatAmount: '',
        vatManuallyEdited: false,
        showDetails: false
      }))
    )
  }

  function handleSupplierChange(line: BankEntryLine, supplierId: string) {
    const supplier = supplierOptions.find(item => item.id === supplierId)

    if (!supplier) {
      updateLine(line.id, {
        supplierId: '',
        supplierVatNumberSnapshot: ''
      })
      return
    }

    const nextReserveId =
      supplier.defaultReserveId || line.reserveId || fallbackReserveId

    const supplierDefaultProjectIsValid =
      supplier.defaultProjectId &&
      projects.some(
        project =>
          project.id === supplier.defaultProjectId &&
          project.reserveId === nextReserveId
      )

    updateLine(line.id, {
      supplierId: supplier.id,
      nominalCodeId: supplier.defaultNominalCodeId || line.nominalCodeId,
      reserveId: nextReserveId,
      projectId: supplierDefaultProjectIsValid
        ? (supplier.defaultProjectId ?? '')
        : '',
      goodsSupplied: supplier.defaultGoodsSupplied || line.goodsSupplied,
      supplierVatNumberSnapshot: supplier.vatNumber || '',
      showDetails:
        line.showDetails ||
        Boolean(supplier.vatNumber || supplier.defaultGoodsSupplied)
    })
  }

  function openQuickSupplierModal(lineId: string) {
    setQuickSupplierLineId(lineId)
    setQuickSupplierName('')
    setQuickSupplierVatNumber('')
    setQuickSupplierGoodsSupplied('')
  }

  function closeQuickSupplierModal() {
    setQuickSupplierLineId(null)
    setQuickSupplierName('')
    setQuickSupplierVatNumber('')
    setQuickSupplierGoodsSupplied('')
  }

  function handleQuickSupplierSubmit() {
    const name = quickSupplierName.trim()

    if (!name) {
      toast.error('Supplier name is required.')
      return
    }

    if (!quickSupplierLineId) {
      toast.error('No bank entry line selected.')
      return
    }

    startQuickSupplierTransition(async () => {
      try {
        const supplier = await quickCreateSupplierAction({
          name,
          vatNumber: quickSupplierVatNumber,
          defaultGoodsSupplied: quickSupplierGoodsSupplied
        })

        setSupplierOptions(current => [...current, supplier])

        updateLine(quickSupplierLineId, {
          supplierId: supplier.id,
          supplierVatNumberSnapshot: supplier.vatNumber ?? '',
          goodsSupplied: supplier.defaultGoodsSupplied ?? '',
          showDetails: Boolean(
            supplier.vatNumber || supplier.defaultGoodsSupplied
          )
        })

        toast.success('Supplier added.')
        closeQuickSupplierModal()
      } catch {
        toast.error('Could not add supplier.')
      }
    })
  }

  function handleReserveChange(line: BankEntryLine, reserveId: string) {
    const projectStillValid = projects.some(
      project =>
        project.id === line.projectId && project.reserveId === reserveId
    )

    updateLine(line.id, {
      reserveId,
      projectId: projectStillValid ? line.projectId : ''
    })
  }

  function handleVatRateChange(id: string, value: string) {
    updateLine(id, {
      vatRateId: value,
      vatAmount: '',
      vatManuallyEdited: false
    })
  }

  function handleVatTreatmentChange(id: string, value: VatTreatment) {
    updateLine(id, {
      vatTreatment: value,
      vatAmount: '',
      vatManuallyEdited: false,
      showDetails:
        value === 'RECOVERABLE' || value === 'OUTPUT'
          ? true
          : (lines.find(line => line.id === id)?.showDetails ?? false)
    })
  }

  function handleSubmit(options?: { skipVat126Warning?: boolean }) {
    setError(null)

    const activeLines = lines.filter(
      line =>
        line.nominalCodeId || line.description.trim() || line.amount.trim()
    )

    const validation = bankEntrySchema.safeParse({
      date,
      bankConnectionId,
      entryType,
      lines: activeLines.map(line => ({
        nominalCodeId: line.nominalCodeId,
        reserveId: line.reserveId,
        vatRateId: getValidVatRateId(line.vatRateId),
        amount: parseAmount(line.amount)
      }))
    })

    if (!validation.success) {
      const message =
        validation.error.issues[0]?.message || 'Please check the bank entry.'

      setError(message)
      toast.error(message)
      return
    }

    const recoverableLinesMissingVat126 = activeLines.filter(line => {
      const vatAmount = shouldUseVat(entryType, line)
        ? getLineVatAmount(entryType, line, vatRates)
        : 0

      return (
        entryType === 'PAYMENT' &&
        line.vatTreatment === 'RECOVERABLE' &&
        vatAmount > 0 &&
        (!line.goodsSupplied.trim() ||
          !line.supplierVatNumberSnapshot.trim() ||
          !line.invoiceReference.trim())
      )
    })

    if (
      recoverableLinesMissingVat126.length > 0 &&
      !options?.skipVat126Warning
    ) {
      setShowVat126Warning(true)
      return
    }

    startTransition(async () => {
      try {
        await createBankEntryAction({
          financialYearId,
          date,
          bankConnectionId,
          entryType,
          reference,
          attachmentUrl: uploadedInvoice?.url,
          attachmentName: uploadedInvoice?.name,
          attachmentKey: uploadedInvoice?.key,
          lines: activeLines.map(line => ({
            nominalCodeId: line.nominalCodeId,
            supplierId: line.supplierId || undefined,
            reserveId: line.reserveId,
            projectId: line.projectId || undefined,
            invoiceReference: line.invoiceReference || undefined,
            goodsSupplied: line.goodsSupplied || undefined,
            supplierVatNumberSnapshot:
              line.supplierVatNumberSnapshot || undefined,
            description: line.description,
            amount: line.amount,
            vatRateId: getValidVatRateId(line.vatRateId),
            vatTreatment: line.vatTreatment,
            vatAmount: shouldUseVat(entryType, line)
              ? formatMoney(getLineVatAmount(entryType, line, vatRates))
              : '0.00'
          }))
        })

        toast.success('Entry posted to ledger.')
        router.push('/ledger')
      } catch (err) {
        if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
          toast.error('Your session has expired. Please sign in again.')
          router.push('/auth/login?next=/ledger/bank-entry/new')
          return
        }

        const message =
          'Could not post bank entry. Please check the details and try again.'

        setError(message)
        toast.error(message)
      }
    })
  }

  const canSubmit =
    !isPending &&
    Boolean(bankConnectionId) &&
    totals.gross > 0 &&
    lines.some(
      line =>
        line.nominalCodeId &&
        line.reserveId &&
        line.vatRateId &&
        parseAmount(line.amount) > 0
    )

  return (
    <div className='rounded-lg border bg-white shadow-sm'>
      <div className='space-y-4 border-b p-4'>
        {error && (
          <p className='rounded-md bg-red-50 px-3 py-2 text-sm text-red-700'>
            {error}
          </p>
        )}

        {bankAccounts.length === 0 && (
          <p className='rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700'>
            No linked cash/bank accounts found. Link a cash/bank nominal code
            first.
          </p>
        )}

        {vatRates.length === 0 && (
          <p className='rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700'>
            No active VAT rates found. Add VAT rates before posting bank
            entries.
          </p>
        )}

        <div className='grid gap-4 md:grid-cols-[1fr_1fr_2fr_1fr]'>
          <div>
            <label className='text-sm font-medium'>Date</label>
            <input
              type='date'
              value={date}
              onChange={event => setDate(event.target.value)}
              className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
            />
          </div>

          <div>
            <label className='text-sm font-medium'>Type</label>
            <select
              value={entryType}
              onChange={event =>
                handleEntryTypeChange(event.target.value as BankEntryType)
              }
              className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
            >
              <option value='PAYMENT'>Payment</option>
              <option value='RECEIPT'>Receipt</option>
            </select>
          </div>

          <div>
            <label className='text-sm font-medium'>Cash/bank account</label>
            <select
              value={bankConnectionId}
              onChange={event => setBankConnectionId(event.target.value)}
              className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
            >
              <option value=''>Select cash/bank account</option>
              {bankAccounts.map(account => (
                <option key={account.connectionId} value={account.connectionId}>
                  {account.accountName}
                  {account.accountLast4
                    ? ` ****${account.accountLast4}`
                    : ''} — {account.nominalCode}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className='text-sm font-medium'>Reference</label>
            <input
              value={reference}
              onChange={event => setReference(event.target.value)}
              placeholder='Optional'
              className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
            />
          </div>
        </div>

        <div className='rounded-md border bg-zinc-50 p-3'>
          <label className='text-sm font-medium'>Supporting document</label>
          <InvoiceUpload
            value={uploadedInvoice}
            onChange={setUploadedInvoice}
          />
        </div>
      </div>

      <div className='overflow-x-auto'>
        <div className='flex flex-wrap items-center justify-between gap-3 border-b bg-zinc-50 px-4 py-3 text-sm'>
          <p className='text-zinc-600'>
            Code each line to a nominal code, reserve and optional project.
          </p>

          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => router.push('/settings/nominal-codes')}
              className='rounded-md border border-blue-600 bg-white px-3 py-1.5 font-medium hover:bg-zinc-50'
            >
              Manage nominal codes
            </button>

            <button
              type='button'
              onClick={() => router.push('/settings/suppliers')}
              className='rounded-md border border-blue-600 bg-white px-3 py-1.5 font-medium hover:bg-zinc-50'
            >
              Manage suppliers
            </button>
          </div>
        </div>

        <table className='w-full min-w-400 table-fixed border-collapse text-sm'>
          <colgroup>
            <col className='w-40' />
            {entryType === 'PAYMENT' && <col className='w-48' />}
            <col className='w-52' />
            <col className='w-48' />
            <col className='w-48' />
            <col className='w-32' />
            <col className='w-32' />
            <col className='w-32' />
            <col className='w-24' />
          </colgroup>

          <thead className='bg-zinc-50 text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Nominal code</th>
              {entryType === 'PAYMENT' && (
                <th className='px-4 py-3 font-medium'>Supplier</th>
              )}
              <th className='px-4 py-3 font-medium'>
                {entryType === 'PAYMENT'
                  ? 'Description'
                  : 'Description / payer'}
              </th>
              <th className='px-4 py-3 font-medium'>Reserve</th>
              <th className='px-4 py-3 font-medium'>Project</th>
              <th className='px-4 py-3 text-right font-medium'>Gross</th>
              <th className='px-4 py-3 text-right font-medium'>VAT</th>
              <th className='px-4 py-3 font-medium'>VAT treatment</th>
              <th className='px-4 py-3 text-right font-medium'>Actions</th>
            </tr>
          </thead>

          <tbody>
            {lines.map((line: BankEntryLine) => {
              const vat = getLineVatAmount(entryType, line, vatRates)
              const useVat = shouldUseVat(entryType, line)
              const filteredProjects = projects.filter(
                project => project.reserveId === line.reserveId
              )

              const selectedSupplier = supplierOptions.find(
                supplier => supplier.id === line.supplierId
              )

              const selectedReserve = reserves.find(
                reserve => reserve.id === line.reserveId
              )

              const selectedProject = projects.find(
                project => project.id === line.projectId
              )

              return (
                <Fragment key={line.id}>
                  <tr className='border-t'>
                    <td className='px-4 py-3'>
                      <NominalCodeSelect
                        value={line.nominalCodeId}
                        codes={filteredCodes}
                        onChange={value =>
                          updateLine(line.id, { nominalCodeId: value })
                        }
                      />
                    </td>

                    {entryType === 'PAYMENT' && (
                      <td className='px-4 py-3'>
                        <div className='flex gap-2'>
                          <select
                            value={line.supplierId}
                            title={selectedSupplier?.name ?? ''}
                            onChange={event =>
                              handleSupplierChange(line, event.target.value)
                            }
                            className='min-w-0 flex-1 truncate rounded-md border px-3 py-2'
                          >
                            <option value=''>Select supplier</option>
                            {supplierOptions.map(supplier => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </option>
                            ))}
                          </select>

                          <button
                            type='button'
                            onClick={() => openQuickSupplierModal(line.id)}
                            className='shrink-0 rounded-md border px-2.5 py-2 text-sm font-medium hover:bg-zinc-50'
                            title='Add supplier'
                          >
                            +
                          </button>
                        </div>
                      </td>
                    )}

                    <td className='px-4 py-3'>
                      <input
                        value={line.description}
                        onChange={event =>
                          updateLine(line.id, {
                            description: event.target.value
                          })
                        }
                        placeholder={
                          entryType === 'PAYMENT'
                            ? 'e.g. Goods/service'
                            : 'e.g. Hall hire, cemetery fee, allotment rent'
                        }
                        className='w-full rounded-md border px-3 py-2'
                      />
                    </td>

                    <td className='px-4 py-3'>
                      <select
                        value={line.reserveId}
                        title={
                          selectedReserve
                            ? `${selectedReserve.code} — ${selectedReserve.name}`
                            : ''
                        }
                        onChange={event =>
                          handleReserveChange(line, event.target.value)
                        }
                        className='w-full truncate rounded-md border px-3 py-2'
                      >
                        {reserves.map(reserve => (
                          <option key={reserve.id} value={reserve.id}>
                            {reserve.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className='px-4 py-3'>
                      <select
                        value={line.projectId}
                        title={
                          selectedProject
                            ? `${selectedProject.code} — ${selectedProject.name}`
                            : ''
                        }
                        onChange={event =>
                          updateLine(line.id, {
                            projectId: event.target.value
                          })
                        }
                        className='w-full truncate rounded-md border px-3 py-2'
                      >
                        <option value=''>No project</option>
                        {filteredProjects.map(project => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className='px-4 py-3'>
                      <input
                        type='text'
                        inputMode='decimal'
                        value={line.amount}
                        onChange={event =>
                          updateLine(line.id, {
                            amount: event.target.value,
                            vatAmount: '',
                            vatManuallyEdited: false
                          })
                        }
                        onBlur={() =>
                          updateLine(line.id, {
                            amount: formatMoneyInput(line.amount)
                          })
                        }
                        className='w-full rounded-md border px-3 py-2 text-right'
                      />
                    </td>

                    <td className='px-4 py-3'>
                      <input
                        type='text'
                        inputMode='decimal'
                        disabled={!useVat}
                        value={
                          useVat
                            ? line.vatManuallyEdited
                              ? line.vatAmount
                              : formatMoney(vat)
                            : '0.00'
                        }
                        onChange={event =>
                          updateLine(line.id, {
                            vatAmount: event.target.value,
                            vatManuallyEdited: true
                          })
                        }
                        onBlur={() =>
                          updateLine(line.id, {
                            vatAmount: formatMoneyInput(
                              line.vatManuallyEdited
                                ? line.vatAmount
                                : formatMoney(vat)
                            )
                          })
                        }
                        className='w-full rounded-md border px-3 py-2 text-right disabled:bg-zinc-50 disabled:text-zinc-500'
                      />
                    </td>

                    <td className='px-4 py-3'>
                      <select
                        value={line.vatTreatment}
                        onChange={event =>
                          handleVatTreatmentChange(
                            line.id,
                            event.target.value as VatTreatment
                          )
                        }
                        className='w-full min-w-32 rounded-md border px-3 py-2'
                      >
                        {entryType === 'PAYMENT' ? (
                          <>
                            <option value='OUTSIDE_SCOPE'>Outside scope</option>
                            <option value='RECOVERABLE'>Recoverable</option>
                            <option value='IRRECOVERABLE'>Irrecoverable</option>
                          </>
                        ) : (
                          <>
                            <option value='OUTSIDE_SCOPE'>Outside scope</option>
                            <option value='OUTPUT'>Output VAT</option>
                          </>
                        )}
                      </select>
                    </td>

                    <td className='px-4 py-3 text-right'>
                      <div className='flex justify-end gap-1'>
                        <button
                          type='button'
                          onClick={() =>
                            updateLine(line.id, {
                              showDetails: !line.showDetails
                            })
                          }
                          className='rounded-md p-2 text-zinc-500 hover:bg-zinc-100'
                          title={
                            line.showDetails
                              ? entryType === 'PAYMENT'
                                ? 'Hide VAT126 details'
                                : 'Hide VAT details'
                              : entryType === 'PAYMENT'
                                ? 'Show VAT126 details'
                                : 'Show VAT details'
                          }
                        >
                          {line.showDetails ? (
                            <ChevronDown className='h-4 w-4' />
                          ) : (
                            <ChevronRight className='h-4 w-4' />
                          )}
                        </button>

                        <button
                          type='button'
                          onClick={() => removeLine(line.id)}
                          disabled={lines.length <= 1}
                          className='rounded-md p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-40'
                          title='Remove line'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {line.showDetails && (
                    <tr className='border-t bg-zinc-50/50'>
                      <td className='px-4 py-3'>
                        <label className='mb-1 block text-xs font-medium text-zinc-500'>
                          VAT rate
                        </label>
                        <select
                          value={getValidVatRateId(line.vatRateId)}
                          onChange={event =>
                            handleVatRateChange(line.id, event.target.value)
                          }
                          className='w-full rounded-md border bg-white px-3 py-2'
                        >
                          {vatRates.map(rate => (
                            <option key={rate.id} value={rate.id}>
                              {rate.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {entryType === 'PAYMENT' && (
                        <>
                          <td className='px-4 py-3'>
                            <label className='mb-1 block text-xs font-medium text-zinc-500'>
                              Goods supplied
                            </label>
                            <input
                              value={line.goodsSupplied}
                              onChange={event =>
                                updateLine(line.id, {
                                  goodsSupplied: event.target.value
                                })
                              }
                              placeholder='For VAT126'
                              className='w-full rounded-md border bg-white px-3 py-2'
                            />
                          </td>

                          <td className='px-4 py-3'>
                            <label className='mb-1 block text-xs font-medium text-zinc-500'>
                              Supplier VAT number
                            </label>
                            <input
                              value={line.supplierVatNumberSnapshot}
                              onChange={event =>
                                updateLine(line.id, {
                                  supplierVatNumberSnapshot: event.target.value
                                })
                              }
                              placeholder='Snapshot'
                              className='w-full rounded-md border bg-white px-3 py-2'
                            />
                          </td>

                          <td className='px-4 py-3'>
                            <label className='mb-1 block text-xs font-medium text-zinc-500'>
                              Invoice ref
                            </label>
                            <input
                              value={line.invoiceReference}
                              onChange={event =>
                                updateLine(line.id, {
                                  invoiceReference: event.target.value
                                })
                              }
                              placeholder='Optional'
                              className='w-full rounded-md border bg-white px-3 py-2'
                            />
                          </td>
                        </>
                      )}

                      <td
                        className='px-4 py-3 text-right text-xs text-zinc-500'
                        colSpan={entryType === 'PAYMENT' ? 5 : 7}
                      >
                        Net: £
                        {formatMoney(
                          parseAmount(line.amount) -
                            (shouldUseVat(entryType, line) ? vat : 0)
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>

          <tfoot className='border-t bg-zinc-50 font-semibold'>
            <tr>
              <td
                className='px-4 py-3'
                colSpan={entryType === 'PAYMENT' ? 5 : 4}
              >
                Total {entryType === 'PAYMENT' ? 'payments' : 'receipts'}
              </td>
              <td className='px-4 py-3 text-right'>
                {formatMoney(totals.gross)}
              </td>
              <td className='px-4 py-3 text-right'>
                {formatMoney(totals.vat)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className='flex flex-col gap-4 border-t p-4 lg:flex-row lg:items-center lg:justify-between'>
        <p className='max-w-2xl text-sm leading-6 text-zinc-500'>
          Reserve and project are always captured for reporting. Use the details
          button to add VAT126 and invoice information where needed.
        </p>

        <div className='flex shrink-0 items-center gap-2'>
          <button
            type='button'
            onClick={addLine}
            className='inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
          >
            <Plus className='h-4 w-4' />
            Add line
          </button>

          <button
            type='button'
            onClick={() => router.push('/ledger')}
            className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50'
          >
            Cancel
          </button>

          <button
            type='button'
            onClick={() => handleSubmit()}
            disabled={!canSubmit || vatRates.length === 0}
            className='rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
          >
            {isPending ? 'Posting...' : 'Post cash/bank entry'}
          </button>
        </div>
      </div>

      {quickSupplierLineId && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
          <div className='w-full max-w-md rounded-lg bg-white p-5 shadow-xl'>
            <div>
              <h2 className='text-lg font-semibold'>Add supplier</h2>
              <p className='mt-1 text-sm text-zinc-500'>
                Add a supplier while keeping this bank entry in progress.
              </p>
            </div>

            <div className='mt-5 space-y-4'>
              <div>
                <label className='text-sm font-medium'>Supplier name</label>
                <input
                  value={quickSupplierName}
                  onChange={event => setQuickSupplierName(event.target.value)}
                  className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
                  autoFocus
                />
              </div>

              <div>
                <label className='text-sm font-medium'>VAT number</label>
                <input
                  value={quickSupplierVatNumber}
                  onChange={event =>
                    setQuickSupplierVatNumber(event.target.value)
                  }
                  placeholder='Optional'
                  className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
                />
              </div>

              <div>
                <label className='text-sm font-medium'>
                  Default goods supplied
                </label>
                <input
                  value={quickSupplierGoodsSupplied}
                  onChange={event =>
                    setQuickSupplierGoodsSupplied(event.target.value)
                  }
                  placeholder='Optional'
                  className='mt-1 w-full rounded-md border px-3 py-2 text-sm'
                />
              </div>
            </div>

            <div className='mt-6 flex justify-end gap-2'>
              <button
                type='button'
                onClick={closeQuickSupplierModal}
                disabled={isQuickSupplierPending}
                className='rounded-md border px-3 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50'
              >
                Cancel
              </button>

              <button
                type='button'
                onClick={handleQuickSupplierSubmit}
                disabled={isQuickSupplierPending}
                className='rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
              >
                {isQuickSupplierPending ? 'Adding...' : 'Add supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
      <AlertDialog open={showVat126Warning} onOpenChange={setShowVat126Warning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>VAT126 details are incomplete</AlertDialogTitle>
            <AlertDialogDescription>
              One or more recoverable VAT lines are missing VAT126 details. You
              can still post this entry, but the VAT126 report may be
              incomplete.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowVat126Warning(false)
                handleSubmit({ skipVat126Warning: true })
              }}
            >
              Post anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
