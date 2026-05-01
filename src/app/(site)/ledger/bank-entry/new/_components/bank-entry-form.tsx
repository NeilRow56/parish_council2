'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'

import { createBankEntryAction } from '../actions'

type BankEntryType = 'PAYMENT' | 'RECEIPT'

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
}

type BankEntryLine = {
  id: string
  nominalCodeId: string
  description: string
  amount: string
}

function createEmptyLine(): BankEntryLine {
  return {
    id: crypto.randomUUID(),
    nominalCodeId: '',
    description: '',
    amount: ''
  }
}

function parseAmount(value: string) {
  return Number(value.replace(/,/g, '') || 0)
}

function formatMoney(value: number) {
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatMoneyInput(value: string) {
  const parsed = parseAmount(value)

  if (!Number.isFinite(parsed) || parsed <= 0) return value

  return formatMoney(parsed)
}

export function BankEntryForm({
  financialYearId,
  bankAccounts,
  nominalCodes
}: {
  financialYearId: string
  bankAccounts: BankAccountOption[]
  nominalCodes: NominalCodeOption[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [entryType, setEntryType] = useState<BankEntryType>('PAYMENT')
  const [bankConnectionId, setBankConnectionId] = useState(
    bankAccounts[0]?.connectionId ?? ''
  )
  const [reference, setReference] = useState('')
  const [lines, setLines] = useState<BankEntryLine[]>([
    createEmptyLine(),
    createEmptyLine()
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

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + parseAmount(line.amount), 0),
    [lines]
  )

  function updateLine(id: string, patch: Partial<BankEntryLine>) {
    setLines(current =>
      current.map(line => (line.id === id ? { ...line, ...patch } : line))
    )
  }

  function addLine() {
    setLines(current => [...current, createEmptyLine()])
  }

  function removeLine(id: string) {
    setLines(current => current.filter(line => line.id !== id))
  }

  function handleSubmit() {
    setError(null)

    startTransition(async () => {
      try {
        await createBankEntryAction({
          financialYearId,
          date,
          bankConnectionId,
          entryType,
          reference,
          lines
        })
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Could not post bank entry.'
        )
      }
    })
  }

  const canSubmit =
    !isPending &&
    Boolean(bankConnectionId) &&
    total > 0 &&
    lines.some(line => line.nominalCodeId && parseAmount(line.amount) > 0)

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
            No linked bank accounts found. Link a bank connection to a nominal
            bank code first.
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
                setEntryType(event.target.value as BankEntryType)
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
              <option value=''>Select bank account</option>
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
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full table-fixed border-collapse text-sm'>
          <colgroup>
            <col className='w-72' />
            <col />
            <col className='w-40' />
            <col className='w-12' />
          </colgroup>

          <thead className='bg-zinc-50 text-left text-zinc-600'>
            <tr>
              <th className='px-4 py-3 font-medium'>Nominal code</th>
              <th className='px-4 py-3 font-medium'>Description</th>
              <th className='px-4 py-3 text-right font-medium'>Amount</th>
              <th className='px-4 py-3' />
            </tr>
          </thead>

          <tbody>
            {lines.map(line => (
              <tr key={line.id} className='border-t'>
                <td className='px-4 py-3'>
                  <select
                    value={line.nominalCodeId}
                    onChange={event =>
                      updateLine(line.id, {
                        nominalCodeId: event.target.value
                      })
                    }
                    className='w-full rounded-md border px-3 py-2'
                  >
                    <option value=''>Select code</option>
                    {filteredCodes.map(code => (
                      <option key={code.id} value={code.id}>
                        {code.code} — {code.name}
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
                  <input
                    type='text'
                    inputMode='decimal'
                    value={line.amount}
                    onChange={event =>
                      updateLine(line.id, {
                        amount: event.target.value
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
            ))}
          </tbody>

          <tfoot className='border-t bg-zinc-50 font-semibold'>
            <tr>
              <td className='px-4 py-3' colSpan={2}>
                Total {entryType === 'PAYMENT' ? 'payments' : 'receipts'}
              </td>
              <td className='px-4 py-3 text-right'>{formatMoney(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className='flex items-center justify-between gap-4 border-t p-4'>
        <p className='text-sm text-zinc-500'>
          Each line will create a separate journal. Bank entries can be matched
          later to the bank feed.
        </p>

        <div className='flex items-center gap-2'>
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
