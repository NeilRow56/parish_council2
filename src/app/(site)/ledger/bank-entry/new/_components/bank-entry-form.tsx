// src/app/(site)/ledger/bank-entry/new/_components/bank-entry-form.tsx

'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { createBankEntryAction } from '../actions'

type BankEntryType = 'PAYMENT' | 'RECEIPT'
type VatRate = 'NO_VAT' | 'STANDARD_20' | 'REDUCED_5'

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
  vatRate: VatRate
  vatTreatment: VatTreatment
  vatAmount: string
  vatManuallyEdited: boolean
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
        amount: z.coerce.number().positive('Amount must be greater than zero.')
      })
    )
    .min(1, 'At least one line is required.')
})

function createEmptyLine(
  entryType: BankEntryType = 'PAYMENT',
  defaultReserveId = ''
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
    vatRate: entryType === 'PAYMENT' ? 'STANDARD_20' : 'NO_VAT',
    vatTreatment: entryType === 'PAYMENT' ? 'RECOVERABLE' : 'OUTSIDE_SCOPE',
    vatAmount: '',
    vatManuallyEdited: false
  }
}

function parseAmount(value: string) {
  return Number(value.replace(/,/g, '') || 0)
}

function getVatRatePercent(vatRate: VatRate) {
  if (vatRate === 'STANDARD_20') return 20
  if (vatRate === 'REDUCED_5') return 5
  return 0
}

function splitGrossAmount(gross: number, vatRate: VatRate) {
  const rate = getVatRatePercent(vatRate)

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

function getLineVatAmount(entryType: BankEntryType, line: BankEntryLine) {
  if (!shouldUseVat(entryType, line)) return 0

  if (line.vatManuallyEdited) {
    return parseAmount(line.vatAmount)
  }

  return splitGrossAmount(parseAmount(line.amount), line.vatRate).vat
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
  defaultReserveId
}: {
  financialYearId: string
  bankAccounts: BankAccountOption[]
  nominalCodes: NominalCodeOption[]
  suppliers: SupplierOption[]
  reserves: ReserveOption[]
  projects: ProjectOption[]
  defaultReserveId: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const fallbackReserveId =
    defaultReserveId || reserves.find(reserve => reserve.isDefault)?.id || ''

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [entryType, setEntryType] = useState<BankEntryType>('PAYMENT')
  const [bankConnectionId, setBankConnectionId] = useState(
    bankAccounts[0]?.connectionId ?? ''
  )
  const [reference, setReference] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentKey, setAttachmentKey] = useState('')

  const [lines, setLines] = useState<BankEntryLine[]>([
    createEmptyLine('PAYMENT', fallbackReserveId),
    createEmptyLine('PAYMENT', fallbackReserveId)
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
        const vat = getLineVatAmount(entryType, line)
        const useVat = shouldUseVat(entryType, line)

        return {
          gross: sum.gross + gross,
          net: sum.net + (useVat ? gross - vat : gross),
          vat: sum.vat + (useVat ? vat : 0)
        }
      },
      { gross: 0, net: 0, vat: 0 }
    )
  }, [entryType, lines])

  function updateLine(id: string, patch: Partial<BankEntryLine>) {
    setLines(current =>
      current.map(line => (line.id === id ? { ...line, ...patch } : line))
    )
  }

  function addLine() {
    setLines(current => [
      ...current,
      createEmptyLine(entryType, fallbackReserveId)
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
        vatRate: value === 'PAYMENT' ? 'STANDARD_20' : 'NO_VAT',
        vatTreatment: value === 'PAYMENT' ? 'RECOVERABLE' : 'OUTSIDE_SCOPE',
        vatAmount: '',
        vatManuallyEdited: false
      }))
    )
  }

  function handleSupplierChange(line: BankEntryLine, supplierId: string) {
    const supplier = suppliers.find(item => item.id === supplierId)

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
      description: line.description || supplier.name
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

  function handleVatRateChange(id: string, value: VatRate) {
    updateLine(id, {
      vatRate: value,
      vatAmount: '',
      vatManuallyEdited: false
    })
  }

  function handleVatTreatmentChange(id: string, value: VatTreatment) {
    updateLine(id, {
      vatTreatment: value,
      vatAmount: '',
      vatManuallyEdited: false
    })
  }

  function handleSubmit() {
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

    startTransition(async () => {
      try {
        await createBankEntryAction({
          financialYearId,
          date,
          bankConnectionId,
          entryType,
          reference,
          attachmentUrl: attachmentUrl || undefined,
          attachmentName: attachmentName || undefined,
          attachmentKey: attachmentKey || undefined,
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
            vatRate: line.vatRate,
            vatTreatment: line.vatTreatment,
            vatAmount: shouldUseVat(entryType, line)
              ? formatMoney(getLineVatAmount(entryType, line))
              : '0.00'
          }))
        })

        toast.success('Bank entry posted.')
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not post bank entry.'

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
        line.nominalCodeId && line.reserveId && parseAmount(line.amount) > 0
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
          <p className='mt-1 text-xs text-zinc-500'>
            PDF upload can be wired here using your UploadThing component. The
            form already supports attachment URL, name and key.
          </p>

          {attachmentName && (
            <p className='mt-2 text-sm text-zinc-700'>
              Attached: <span className='font-medium'>{attachmentName}</span>
            </p>
          )}

          <input type='hidden' value={attachmentUrl} readOnly />
          <input type='hidden' value={attachmentName} readOnly />
          <input type='hidden' value={attachmentKey} readOnly />
        </div>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full min-w-350 table-fixed border-collapse text-sm'>
          <colgroup>
            <col className='w-72' />
            <col className='w-64' />
            <col />
            <col className='w-36' />
            <col className='w-44' />
            <col className='w-36' />
            <col className='w-32' />
            <col className='w-12' />
          </colgroup>

          <thead className='bg-zinc-50 text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Nominal code</th>
              <th className='px-4 py-3 font-medium'>Supplier / payer</th>
              <th className='px-4 py-3 font-medium'>Description</th>
              <th className='px-4 py-3 font-medium'>VAT rate</th>
              <th className='px-4 py-3 font-medium'>VAT treatment</th>
              <th className='px-4 py-3 text-right font-medium'>Gross</th>
              <th className='px-4 py-3 text-right font-medium'>VAT</th>
              <th className='px-4 py-3' />
            </tr>
          </thead>

          <tbody>
            {lines.map(line => {
              const vat = getLineVatAmount(entryType, line)
              const useVat = shouldUseVat(entryType, line)
              const filteredProjects = projects.filter(
                project => project.reserveId === line.reserveId
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

                    <td className='px-4 py-3'>
                      <select
                        value={line.supplierId}
                        onChange={event =>
                          handleSupplierChange(line, event.target.value)
                        }
                        className='w-full rounded-md border px-3 py-2'
                      >
                        <option value=''>
                          {entryType === 'PAYMENT'
                            ? 'Select supplier'
                            : 'Select payer'}
                        </option>
                        {suppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </td>

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
                            ? 'e.g. Cheque 001 / supplier'
                            : 'e.g. Receipt reference / payer'
                        }
                        className='w-full rounded-md border px-3 py-2'
                      />
                    </td>

                    <td className='px-4 py-3'>
                      <select
                        value={line.vatRate}
                        onChange={event =>
                          handleVatRateChange(
                            line.id,
                            event.target.value as VatRate
                          )
                        }
                        className='w-full rounded-md border px-3 py-2'
                      >
                        <option value='NO_VAT'>No VAT</option>
                        <option value='STANDARD_20'>20%</option>
                        <option value='REDUCED_5'>5%</option>
                      </select>
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
                        className='w-full rounded-md border px-3 py-2'
                      >
                        {entryType === 'PAYMENT' ? (
                          <>
                            <option value='RECOVERABLE'>Recoverable</option>
                            <option value='IRRECOVERABLE'>Irrecoverable</option>
                            <option value='OUTSIDE_SCOPE'>Outside scope</option>
                          </>
                        ) : (
                          <>
                            <option value='OUTSIDE_SCOPE'>Outside scope</option>
                            <option value='OUTPUT'>Output VAT</option>
                          </>
                        )}
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

                    <td className='px-4 py-3 text-right'>
                      <button
                        type='button'
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length <= 1}
                        className='rounded-md p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-40'
                      >
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </td>
                  </tr>

                  <tr
                    key={`${line.id}-secondary`}
                    className='border-t bg-zinc-50/50'
                  >
                    <td className='px-4 py-3'>
                      <label className='mb-1 block text-xs font-medium text-zinc-500'>
                        Reserve
                      </label>
                      <select
                        value={line.reserveId}
                        onChange={event =>
                          handleReserveChange(line, event.target.value)
                        }
                        className='w-full rounded-md border bg-white px-3 py-2'
                      >
                        <option value=''>Select reserve</option>
                        {reserves.map(reserve => (
                          <option key={reserve.id} value={reserve.id}>
                            {reserve.code} — {reserve.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className='px-4 py-3'>
                      <label className='mb-1 block text-xs font-medium text-zinc-500'>
                        Project
                      </label>
                      <select
                        value={line.projectId}
                        onChange={event =>
                          updateLine(line.id, {
                            projectId: event.target.value
                          })
                        }
                        className='w-full rounded-md border bg-white px-3 py-2'
                      >
                        <option value=''>No project</option>
                        {filteredProjects.map(project => (
                          <option key={project.id} value={project.id}>
                            {project.code} — {project.name}
                          </option>
                        ))}
                      </select>
                    </td>

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
                        VAT number
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

                    <td
                      className='px-4 py-3 text-right text-xs text-zinc-500'
                      colSpan={3}
                    >
                      Net: £
                      {formatMoney(
                        parseAmount(line.amount) -
                          (shouldUseVat(entryType, line) ? vat : 0)
                      )}
                    </td>
                  </tr>
                </Fragment>
              )
            })}
          </tbody>

          <tfoot className='border-t bg-zinc-50 font-semibold'>
            <tr>
              <td className='px-4 py-3' colSpan={5}>
                Total {entryType === 'PAYMENT' ? 'payments' : 'receipts'}
              </td>
              <td className='px-4 py-3 text-right'>
                {formatMoney(totals.gross)}
              </td>
              <td className='px-4 py-3 text-right'>
                {formatMoney(totals.vat)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className='flex flex-col gap-4 border-t p-4 lg:flex-row lg:items-center lg:justify-between'>
        <p className='max-w-2xl text-sm leading-6 text-zinc-500'>
          Amounts are entered gross. Supplier VAT numbers are snapshotted for
          VAT126 reporting. Projects are filtered by the selected reserve.
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
            onClick={handleSubmit}
            disabled={!canSubmit}
            className='rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
          >
            {isPending ? 'Posting...' : 'Post cash/bank entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
