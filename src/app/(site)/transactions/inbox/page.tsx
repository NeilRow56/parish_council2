'use client'

import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  Fragment
} from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NominalCode {
  id: string
  code: string
  name: string
  type: 'INCOME' | 'EXPENDITURE' | 'BALANCE_SHEET'
  category: string | null
}

interface StagedTransaction {
  id: string
  date: string
  description: string
  amount: string
  currency: string
  merchantName: string | null
  transactionType: 'CREDIT' | 'DEBIT'
  status: 'PENDING' | 'CODED' | 'EXCLUDED'
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: string, type: 'CREDIT' | 'DEBIT') {
  const n = Math.abs(parseFloat(amount))
  const formatted = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(n)
  return { formatted, isCredit: type === 'CREDIT' }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    CODED: 'bg-blue-50 text-blue-700 border-blue-200',
    EXCLUDED: 'bg-gray-100 text-gray-500 border-gray-200',
    POSTED: 'bg-green-50 text-green-700 border-green-200'
  }
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}
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
  // Group codes by type then category
  const income = codes.filter(c => c.type === 'INCOME')
  const expenditure = codes.filter(c => c.type === 'EXPENDITURE')

  const renderGroup = (label: string, items: NominalCode[]) => {
    if (!items.length) return null
    // Sub-group by category
    const byCategory = items.reduce<Record<string, NominalCode[]>>((acc, c) => {
      const cat = c.category ?? 'General'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(c)
      return acc
    }, {})

    return (
      <optgroup label={label} key={label}>
        {Object.entries(byCategory).map(([cat, catCodes]) => (
          <Fragment key={`${label}-${cat}`}>
            <option
              disabled
              value=''
              style={{ fontStyle: 'italic', color: '#999' }}
            >
              — {cat} —
            </option>
            {catCodes.map(c => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
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
      onChange={e => e.target.value && onChange(e.target.value)}
      disabled={disabled}
      className='w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400'
    >
      <option value=''>Select nominal code…</option>
      {renderGroup('INCOME', income)}
      {renderGroup('EXPENDITURE', expenditure)}
    </select>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TransactionInbox() {
  const [transactions, setTransactions] = useState<StagedTransaction[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [summary, setSummary] = useState<Summary[]>([])
  const [nominalCodes, setNominalCodes] = useState<NominalCode[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [posting, startPosting] = useTransition()
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [postResult, setPostResult] = useState<{
    posted: number
    errors: number
  } | null>(null)

  // Fetch nominal codes once
  useEffect(() => {
    fetch('/api/nominal-codes')
      .then(r => r.json())
      .then(d => setNominalCodes(d.codes ?? []))
  }, [])

  // Fetch transactions when filters change
  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      ...(filterStatus !== 'all' && { status: filterStatus }),
      ...(search && { search })
    })
    const res = await fetch(`/api/transactions/staged?${params}`)
    const data = await res.json()
    setTransactions(data.transactions ?? [])
    setPagination(data.pagination ?? null)
    setSummary(data.summary ?? [])
    setLoading(false)
    setSelected(new Set()) // clear selection on filter change
  }, [page, filterStatus, search])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  // Debounce search
  const [searchInput, setSearchInput] = useState('')
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function assignNominal(txId: string, nominalCodeId: string) {
    // Clear previous posting result (so UI doesn't show stale "1 posted")
    setPostResult(null)

    setUpdatingId(txId)

    const res = await fetch(`/api/transactions/staged/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign_nominal', nominalCodeId })
    })

    if (!res.ok) {
      setUpdatingId(null)
      return
    }

    const data = await res.json()

    setTransactions(prev =>
      prev.map(tx =>
        tx.id === txId
          ? {
              ...tx,
              status: 'CODED',
              nominalCodeId,
              nominalCode: data.nominalCode?.code ?? tx.nominalCode,
              nominalName: data.nominalCode?.name ?? tx.nominalName
            }
          : tx
      )
    )

    setSummary(prev =>
      prev.map(item => {
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

  async function excludeTransaction(txId: string) {
    setUpdatingId(txId)
    await fetch(`/api/transactions/staged/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'exclude' })
    })
    setUpdatingId(null)
    fetchTransactions()
  }

  function postSelected() {
    startPosting(async () => {
      const ids = selected.size > 0 ? [...selected] : undefined
      const res = await fetch('/api/transactions/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids })
      })
      const data = await res.json()
      setPostResult({ posted: data.posted, errors: data.errors?.length ?? 0 })
      fetchTransactions()
    })
  }

  // ── Selection helpers ──────────────────────────────────────────────────────

  const codedTransactions = transactions.filter(t => t.status === 'CODED')
  const allCodedSelected =
    codedTransactions.length > 0 &&
    codedTransactions.every(t => selected.has(t.id))

  function toggleSelectAll() {
    if (allCodedSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(codedTransactions.map(t => t.id)))
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Summary counts ─────────────────────────────────────────────────────────

  const pendingCount =
    summary.find(s => s.status === 'PENDING')?.count ??
    transactions.filter(t => t.status === 'PENDING').length

  const codedCount = Math.max(
    summary.find(s => s.status === 'CODED')?.count ?? 0,
    transactions.filter(t => t.status === 'CODED').length
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className='min-h-screen bg-slate-50 font-sans'>
      {/* ── Header ── */}
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
                  {selected.size > 0
                    ? ` (${selected.size} selected)`
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
        {/* ── Summary pills ── */}
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

          <div className='ml-auto'>
            <input
              type='search'
              placeholder='Search transactions…'
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className='w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
            />
          </div>
        </div>

        {/* ── Table ── */}
        <div className='overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm'>
          {loading ? (
            <div className='flex items-center justify-center py-20 text-sm text-slate-400'>
              Loading transactions…
            </div>
          ) : transactions.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-20 text-slate-400'>
              <svg
                className='mb-3 h-10 w-10 opacity-30'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={1.5}
                  d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                />
              </svg>
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
                      checked={allCodedSelected}
                      onChange={toggleSelectAll}
                      title='Select all coded'
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
                  <th className='px-4 py-3 text-left font-medium text-slate-500'></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => {
                  const { formatted, isCredit } = formatAmount(
                    tx.amount,
                    tx.transactionType
                  )
                  const isExpanded = expandedId === tx.id
                  const isUpdating = updatingId === tx.id
                  const isExcluded = tx.status === 'EXCLUDED'

                  return (
                    <Fragment key={tx.id}>
                      <tr
                        className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
                          isExcluded ? 'opacity-50' : ''
                        } ${selected.has(tx.id) ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className='px-4 py-3'>
                          <input
                            type='checkbox'
                            checked={selected.has(tx.id)}
                            onChange={() => toggleSelect(tx.id)}
                            disabled={tx.status !== 'CODED'}
                            className='rounded border-slate-300 disabled:opacity-30'
                          />
                        </td>

                        {/* Date */}
                        <td className='px-4 py-3 text-xs whitespace-nowrap text-slate-500'>
                          {formatDate(tx.date)}
                        </td>

                        {/* Description */}
                        <td className='max-w-xs px-4 py-3'>
                          <div className='truncate font-medium text-slate-800'>
                            {tx.merchantName ?? tx.description}
                          </div>
                          {tx.merchantName && (
                            <div className='truncate text-xs text-slate-400'>
                              {tx.description}
                            </div>
                          )}
                          {tx.matchingRule && (
                            <div className='mt-0.5 text-xs text-blue-500'>
                              Auto-matched: {tx.matchingRule}
                            </div>
                          )}
                        </td>

                        {/* Account */}
                        <td className='px-4 py-3 text-xs whitespace-nowrap text-slate-500'>
                          {tx.accountName}
                        </td>

                        {/* Amount */}
                        <td
                          className={`px-4 py-3 text-right font-mono font-medium whitespace-nowrap ${
                            isCredit ? 'text-green-600' : 'text-slate-800'
                          }`}
                        >
                          {isCredit ? '+' : '−'}
                          {formatted}
                        </td>

                        {/* Nominal picker */}
                        <td className='min-w-55 px-4 py-3'>
                          {isExcluded ? (
                            <span className='text-xs text-slate-400 italic'>
                              Excluded
                            </span>
                          ) : (
                            <NominalPicker
                              codes={nominalCodes}
                              value={tx.nominalCodeId}
                              onChange={id => assignNominal(tx.id, id)}
                              disabled={isUpdating || posting}
                            />
                          )}
                        </td>

                        {/* Status */}
                        <td className='px-4 py-3'>
                          {isUpdating ? (
                            <span className='inline-flex items-center gap-1 text-xs text-slate-400'>
                              <span className='h-3 w-3 animate-spin rounded-full border border-slate-400 border-t-transparent' />
                              Saving…
                            </span>
                          ) : (
                            <StatusBadge status={tx.status} />
                          )}
                        </td>

                        {/* Actions */}
                        <td className='px-4 py-3'>
                          <div className='flex items-center gap-1'>
                            <button
                              onClick={() =>
                                setExpandedId(isExpanded ? null : tx.id)
                              }
                              title='Notes'
                              className='rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600'
                            >
                              <svg
                                className='h-4 w-4'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                              >
                                <path
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                  strokeWidth={2}
                                  d='M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z'
                                />
                              </svg>
                            </button>
                            {!isExcluded ? (
                              <button
                                onClick={() => excludeTransaction(tx.id)}
                                title='Exclude (transfers, contra entries, etc.)'
                                className='rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500'
                              >
                                <svg
                                  className='h-4 w-4'
                                  fill='none'
                                  stroke='currentColor'
                                  viewBox='0 0 24 24'
                                >
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636'
                                  />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  setUpdatingId(tx.id)
                                  await fetch(
                                    `/api/transactions/staged/${tx.id}`,
                                    {
                                      method: 'PATCH',
                                      headers: {
                                        'Content-Type': 'application/json'
                                      },
                                      body: JSON.stringify({
                                        action: 'unexclude'
                                      })
                                    }
                                  )
                                  setUpdatingId(null)
                                  fetchTransactions()
                                }}
                                title='Restore'
                                className='rounded p-1.5 text-slate-400 transition-colors hover:bg-green-50 hover:text-green-500'
                              >
                                <svg
                                  className='h-4 w-4'
                                  fill='none'
                                  stroke='currentColor'
                                  viewBox='0 0 24 24'
                                >
                                  <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded notes row */}
                      {isExpanded && (
                        <tr
                          key={`${tx.id}-notes`}
                          className='border-b border-slate-100 bg-slate-50'
                        >
                          <td colSpan={8} className='px-4 py-3'>
                            <NotesEditor
                              txId={tx.id}
                              initialNotes={tx.notes ?? ''}
                              onSave={notes => {
                                setTransactions(prev =>
                                  prev.map(t =>
                                    t.id === tx.id ? { ...t, notes } : t
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

        {/* ── Pagination ── */}
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
                onClick={() => setPage(p => Math.max(1, p - 1))}
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
                  setPage(p => Math.min(pagination.totalPages, p + 1))
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

// ─── Notes editor ─────────────────────────────────────────────────────────────

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
          onChange={e => {
            setNotes(e.target.value)
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
