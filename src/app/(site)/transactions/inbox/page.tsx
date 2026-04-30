'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition
} from 'react'

interface NominalCode {
  id: string
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE' | 'BALANCE_SHEET'
  category: string | null
}

interface StagedTransaction {
  id: string
  connectionId: string
  date: string
  description: string
  amount: string
  currency: string
  merchantName: string | null
  transactionType: 'CREDIT' | 'DEBIT'
  status: 'PENDING' | 'CODED' | 'POSTED' | 'EXCLUDED'
  matchingRule: string | null
  notes: string | null
  accountName: string
  nominalCodeId: string | null
  nominalCode: string | null
  nominalName: string | null
}

interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface Summary {
  status: string
  count: number
  total: string
}

type FilterStatus = 'all' | 'PENDING' | 'CODED'

function formatBankAmount(amount: string, type: 'CREDIT' | 'DEBIT') {
  const value = Math.abs(Number(amount))

  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(value)

  return {
    formatted,
    prefix: type === 'CREDIT' ? '+' : '',
    isCredit: type === 'CREDIT'
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    CODED: 'bg-blue-50 text-blue-700 border-blue-200',
    POSTED: 'bg-green-50 text-green-700 border-green-200',
    EXCLUDED: 'bg-gray-100 text-gray-500 border-gray-200'
  }

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {status}
    </span>
  )
}

function NominalPicker({
  codes,
  value,
  onChange,
  disabled
}: {
  codes: NominalCode[]
  value: string | null
  onChange: (id: string) => void
  disabled: boolean
}) {
  const income = codes.filter(code => code.type === 'INCOME')
  const expenditure = codes.filter(code => code.type === 'EXPENDITURE')

  const renderGroup = (label: string, items: NominalCode[]) => {
    if (!items.length) return null

    const byCategory = items.reduce<Record<string, NominalCode[]>>(
      (acc, code) => {
        const category = code.category ?? 'General'
        acc[category] = acc[category] ?? []
        acc[category].push(code)
        return acc
      },
      {}
    )

    return (
      <optgroup label={label} key={label}>
        {Object.entries(byCategory).map(([category, categoryCodes]) => (
          <Fragment key={`${label}-${category}`}>
            <option disabled value='' className='text-slate-400 italic'>
              — {category} —
            </option>

            {categoryCodes.map(code => (
              <option key={code.id} value={code.id}>
                {code.code} · {code.name}
              </option>
            ))}
          </Fragment>
        ))}
      </optgroup>
    )
  }

  return (
    <select
      value={value ?? ''}
      onChange={event => {
        if (event.target.value) {
          onChange(event.target.value)
        }
      }}
      disabled={disabled}
      className='w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400'
    >
      <option value=''>Select nominal code…</option>
      {renderGroup('INCOME', income)}
      {renderGroup('EXPENDITURE', expenditure)}
    </select>
  )
}

export default function TransactionInbox() {
  const [transactions, setTransactions] = useState<StagedTransaction[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [summary, setSummary] = useState<Summary[]>([])
  const [nominalCodes, setNominalCodes] = useState<NominalCode[]>([])
  const [loading, setLoading] = useState(true)

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [accountFilter, setAccountFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [posting, startPosting] = useTransition()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [bulkNominalCodeId, setBulkNominalCodeId] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState(false)
  const [postResult, setPostResult] = useState<{
    posted: number
    errors: number
  } | null>(null)

  useEffect(() => {
    fetch('/api/nominal-codes')
      .then(response => response.json())
      .then(data => setNominalCodes(data.codes ?? []))
  }, [])

  const fetchTransactions = useCallback(async () => {
    setLoading(true)

    const params = new URLSearchParams({
      page: String(page),
      ...(filterStatus !== 'all' && { status: filterStatus }),
      ...(search && { search }),
      ...(accountFilter !== 'all' && { connectionId: accountFilter })
    })

    const response = await fetch(`/api/transactions/staged?${params}`)
    const data = await response.json()

    setTransactions(data.transactions ?? [])
    setPagination(data.pagination ?? null)
    setSummary(data.summary ?? [])
    setSelected(new Set())
    setLoading(false)
  }, [page, filterStatus, search, accountFilter])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchTransactions()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchTransactions])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [searchInput])

  const accountOptions = useMemo(
    () =>
      Array.from(
        new Map(
          transactions.map(transaction => [
            transaction.connectionId,
            {
              id: transaction.connectionId,
              name: transaction.accountName
            }
          ])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [transactions]
  )

  async function assignNominal(txId: string, nominalCodeId: string) {
    setPostResult(null)
    setUpdatingId(txId)

    const response = await fetch(`/api/transactions/staged/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign_nominal', nominalCodeId })
    })

    if (!response.ok) {
      setUpdatingId(null)
      return
    }

    const data = await response.json()

    setTransactions(previous =>
      previous.map(transaction =>
        transaction.id === txId
          ? {
              ...transaction,
              status: 'CODED',
              nominalCodeId,
              nominalCode: data.nominalCode?.code ?? transaction.nominalCode,
              nominalName: data.nominalCode?.name ?? transaction.nominalName
            }
          : transaction
      )
    )

    setSummary(previous =>
      previous.map(item => {
        if (item.status === 'PENDING') {
          return { ...item, count: Math.max(0, item.count - 1) }
        }

        if (item.status === 'CODED') {
          return { ...item, count: item.count + 1 }
        }

        return item
      })
    )

    setUpdatingId(null)
  }

  async function bulkAssignNominal() {
    if (selected.size === 0 || !bulkNominalCodeId) return

    setPostResult(null)
    setBulkUpdating(true)

    const response = await fetch('/api/transactions/bulk-assign-nominal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transactionIds: [...selected],
        nominalCodeId: bulkNominalCodeId
      })
    })

    setBulkUpdating(false)

    if (!response.ok) {
      return
    }

    await fetchTransactions()
    setBulkNominalCodeId('')
  }

  async function excludeTransaction(txId: string) {
    setPostResult(null)
    setUpdatingId(txId)

    await fetch(`/api/transactions/staged/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'exclude' })
    })

    setUpdatingId(null)
    await fetchTransactions()
  }

  async function restoreTransaction(txId: string) {
    setPostResult(null)
    setUpdatingId(txId)

    await fetch(`/api/transactions/staged/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unexclude' })
    })

    setUpdatingId(null)
    await fetchTransactions()
  }

  function postSelected() {
    startPosting(async () => {
      const selectedCodedIds = transactions
        .filter(
          transaction =>
            selected.has(transaction.id) && transaction.status === 'CODED'
        )
        .map(transaction => transaction.id)

      const ids = selectedCodedIds.length > 0 ? selectedCodedIds : undefined

      const response = await fetch('/api/transactions/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids })
      })

      const data = await response.json()

      setPostResult({
        posted: data.posted,
        errors: data.errors?.length ?? 0
      })

      await fetchTransactions()
    })
  }

  const selectableTransactions = transactions.filter(transaction =>
    ['PENDING', 'CODED'].includes(transaction.status)
  )

  const codedTransactions = transactions.filter(
    transaction => transaction.status === 'CODED'
  )

  const selectedCodedCount = transactions.filter(
    transaction =>
      selected.has(transaction.id) && transaction.status === 'CODED'
  ).length

  const allSelectableSelected =
    selectableTransactions.length > 0 &&
    selectableTransactions.every(transaction => selected.has(transaction.id))

  function toggleSelectAll() {
    if (allSelectableSelected) {
      setSelected(new Set())
      return
    }

    setSelected(
      new Set(selectableTransactions.map(transaction => transaction.id))
    )
  }

  function toggleSelect(id: string) {
    setSelected(previous => {
      const next = new Set(previous)

      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }

      return next
    })
  }

  const pendingCount =
    summary.find(item => item.status === 'PENDING')?.count ??
    transactions.filter(transaction => transaction.status === 'PENDING').length

  const codedCount = Math.max(
    summary.find(item => item.status === 'CODED')?.count ?? 0,
    codedTransactions.length
  )

  return (
    <div className='min-h-screen bg-slate-50 font-sans'>
      <div className='border-b border-slate-200 bg-white px-6 py-4'>
        <div className='mx-auto flex max-w-6xl items-center justify-between'>
          <div>
            <h1 className='text-xl font-semibold text-slate-900'>
              Transaction Inbox
            </h1>
            <p className='mt-0.5 text-sm text-slate-500'>
              Review bank transactions and assign nominal codes before posting
              to the ledger
            </p>
          </div>

          <div className='flex items-center gap-3'>
            {postResult && (
              <span
                className={`text-sm ${
                  postResult.errors > 0 ? 'text-amber-600' : 'text-green-600'
                }`}
              >
                Last posting run: {postResult.posted} transaction
                {postResult.posted === 1 ? '' : 's'} posted
                {postResult.errors > 0 && `, ${postResult.errors} error(s)`}
              </span>
            )}

            <button
              onClick={postSelected}
              disabled={posting || codedCount === 0}
              className='inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40'
            >
              {posting ? (
                <>
                  <span className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent' />
                  Posting…
                </>
              ) : (
                <>
                  Post to ledger
                  {selectedCodedCount > 0
                    ? ` (${selectedCodedCount} selected coded)`
                    : codedCount > 0
                      ? ` (${codedCount} coded)`
                      : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className='mx-auto max-w-6xl space-y-5 px-6 py-6'>
        <div className='flex items-center gap-3'>
          {[
            {
              label: 'All',
              value: 'all' as FilterStatus,
              count: pendingCount + codedCount
            },
            {
              label: 'Pending',
              value: 'PENDING' as FilterStatus,
              count: pendingCount
            },
            {
              label: 'Coded',
              value: 'CODED' as FilterStatus,
              count: codedCount
            }
          ].map(({ label, value, count }) => (
            <button
              key={value}
              onClick={() => {
                setFilterStatus(value)
                setPage(1)
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                filterStatus === value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {label}

              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  filterStatus === value ? 'bg-white/20' : 'bg-slate-100'
                }`}
              >
                {count}
              </span>
            </button>
          ))}

          <div className='ml-auto flex items-center gap-2'>
            <select
              value={accountFilter}
              onChange={event => {
                setAccountFilter(event.target.value)
                setPage(1)
              }}
              className='w-56 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
            >
              <option value='all'>All accounts</option>
              {accountOptions.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>

            <input
              type='search'
              placeholder='Search transactions…'
              value={searchInput}
              onChange={event => setSearchInput(event.target.value)}
              className='w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
            />
          </div>
        </div>

        {selected.size > 0 && (
          <div className='flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3'>
            <div className='text-sm text-blue-900'>
              <span className='font-medium'>{selected.size}</span> transaction
              {selected.size === 1 ? '' : 's'} selected
            </div>

            <div className='flex items-center gap-2'>
              <div className='flex flex-col'>
                {!bulkNominalCodeId && selected.size > 0 && (
                  <span className='text-xs text-blue-600'>
                    Step 1: choose a nominal code → Step 2: apply to selected
                  </span>
                )}
                <select
                  value={bulkNominalCodeId}
                  onChange={event => setBulkNominalCodeId(event.target.value)}
                  className='w-80 rounded-md border border-blue-200 bg-white px-3 py-2 text-sm'
                >
                  <option value=''>Assign nominal code...</option>

                  {nominalCodes.map(code => (
                    <option key={code.id} value={code.id}>
                      {code.code} · {code.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type='button'
                onClick={bulkAssignNominal}
                disabled={!bulkNominalCodeId || bulkUpdating}
                className='rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50'
              >
                {bulkUpdating ? 'Assigning...' : 'Apply to selected'}
              </button>
            </div>
          </div>
        )}

        <div className='overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'>
          {loading ? (
            <div className='flex items-center justify-center py-20 text-sm text-slate-400'>
              Loading transactions…
            </div>
          ) : transactions.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-20 text-slate-400'>
              <p className='text-sm font-medium'>No transactions found</p>
              <p className='mt-1 text-xs'>
                All transactions may already be posted or excluded
              </p>
            </div>
          ) : (
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-slate-100 bg-slate-50'>
                  <th className='w-10 px-4 py-3 text-left'>
                    <input
                      type='checkbox'
                      checked={allSelectableSelected}
                      onChange={toggleSelectAll}
                      title='Select all'
                      className='rounded border-slate-300'
                    />
                  </th>

                  <th className='px-4 py-3 text-left font-medium whitespace-nowrap text-slate-500'>
                    Date
                  </th>

                  <th className='px-4 py-3 text-left font-medium text-slate-500'>
                    Description
                  </th>

                  <th className='px-4 py-3 text-left font-medium text-slate-500'>
                    Account
                  </th>

                  <th className='px-4 py-3 text-right font-medium whitespace-nowrap text-slate-500'>
                    Amount
                  </th>

                  <th className='px-4 py-3 text-left font-medium text-slate-500'>
                    Nominal code
                  </th>

                  <th className='px-4 py-3 text-left font-medium text-slate-500'>
                    Status
                  </th>

                  <th className='px-4 py-3 text-left font-medium text-slate-500' />
                </tr>
              </thead>

              <tbody>
                {transactions.map(transaction => {
                  const { formatted, prefix, isCredit } = formatBankAmount(
                    transaction.amount,
                    transaction.transactionType
                  )

                  const isExpanded = expandedId === transaction.id
                  const isUpdating = updatingId === transaction.id
                  const isExcluded = transaction.status === 'EXCLUDED'

                  return (
                    <Fragment key={transaction.id}>
                      <tr
                        className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                          isExcluded ? 'opacity-50' : ''
                        } ${
                          selected.has(transaction.id)
                            ? 'bg-blue-50 hover:bg-blue-50'
                            : ''
                        }`}
                      >
                        <td className='px-4 py-3'>
                          <input
                            type='checkbox'
                            checked={selected.has(transaction.id)}
                            onChange={() => toggleSelect(transaction.id)}
                            disabled={isExcluded}
                            className='rounded border-slate-300 disabled:opacity-30'
                          />
                        </td>

                        <td className='px-4 py-3 text-xs whitespace-nowrap text-slate-500'>
                          {formatDate(transaction.date)}
                        </td>

                        <td className='max-w-xs px-4 py-3'>
                          <div className='truncate font-medium text-slate-800'>
                            {transaction.merchantName ??
                              transaction.description}
                          </div>

                          {transaction.merchantName && (
                            <div className='truncate text-xs text-slate-400'>
                              {transaction.description}
                            </div>
                          )}

                          {transaction.matchingRule && (
                            <div className='mt-0.5 text-xs text-blue-500'>
                              Auto-matched: {transaction.matchingRule}
                            </div>
                          )}
                        </td>

                        <td className='px-4 py-3 whitespace-nowrap'>
                          <span className='inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600'>
                            {transaction.accountName}
                          </span>
                        </td>

                        <td
                          className={`px-4 py-3 text-right font-mono font-medium whitespace-nowrap ${
                            isCredit ? 'text-green-600' : 'text-slate-800'
                          }`}
                        >
                          {prefix}
                          {formatted}
                        </td>

                        <td className='min-w-55 px-4 py-3'>
                          {isExcluded ? (
                            <span className='text-xs text-slate-400 italic'>
                              Excluded
                            </span>
                          ) : (
                            <NominalPicker
                              codes={nominalCodes}
                              value={transaction.nominalCodeId}
                              onChange={id => assignNominal(transaction.id, id)}
                              disabled={isUpdating || posting || bulkUpdating}
                            />
                          )}
                        </td>

                        <td className='px-4 py-3'>
                          {isUpdating ? (
                            <span className='inline-flex items-center gap-1 text-xs text-slate-400'>
                              <span className='h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent' />
                              Saving…
                            </span>
                          ) : (
                            <StatusBadge status={transaction.status} />
                          )}
                        </td>

                        <td className='px-4 py-3'>
                          <div className='flex items-center gap-1'>
                            <button
                              onClick={() =>
                                setExpandedId(
                                  isExpanded ? null : transaction.id
                                )
                              }
                              title='Notes'
                              className='rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'
                            >
                              💬
                            </button>

                            {!isExcluded ? (
                              <button
                                onClick={() =>
                                  excludeTransaction(transaction.id)
                                }
                                title='Exclude'
                                className='rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500'
                              >
                                ⊘
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  restoreTransaction(transaction.id)
                                }
                                title='Restore'
                                className='rounded p-1.5 text-slate-400 transition-colors hover:bg-green-50 hover:text-green-500'
                              >
                                ↻
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className='border-b border-slate-100 bg-slate-50'>
                          <td colSpan={8} className='px-4 py-3'>
                            <NotesEditor
                              txId={transaction.id}
                              initialNotes={transaction.notes ?? ''}
                              onSave={notes => {
                                setTransactions(previous =>
                                  previous.map(item =>
                                    item.id === transaction.id
                                      ? { ...item, notes }
                                      : item
                                  )
                                )
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className='flex items-center justify-between text-sm text-slate-500'>
            <span>
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(
                pagination.page * pagination.pageSize,
                pagination.total
              )}{' '}
              of {pagination.total} transactions
            </span>

            <div className='flex items-center gap-2'>
              <button
                onClick={() => setPage(current => Math.max(1, current - 1))}
                disabled={pagination.page <= 1}
                className='rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
              >
                Previous
              </button>

              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                onClick={() =>
                  setPage(current =>
                    Math.min(pagination.totalPages, current + 1)
                  )
                }
                disabled={pagination.page >= pagination.totalPages}
                className='rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40'
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function NotesEditor({
  txId,
  initialNotes,
  onSave
}: {
  txId: string
  initialNotes: string
  onSave: (notes: string) => void
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)

    await fetch(`/api/transactions/staged/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_notes', notes })
    })

    setSaving(false)
    setSaved(true)
    onSave(notes)

    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className='flex items-start gap-3'>
      <div className='flex-1'>
        <label className='mb-1 block text-xs font-medium text-slate-500'>
          Notes / memo
        </label>

        <textarea
          value={notes}
          onChange={event => {
            setNotes(event.target.value)
            setSaved(false)
          }}
          rows={2}
          placeholder='Add a note for the internal audit trail…'
          className='w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
        />
      </div>

      <button
        onClick={save}
        disabled={saving}
        className='mt-5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50'
      >
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
      </button>
    </div>
  )
}
