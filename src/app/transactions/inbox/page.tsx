"use client";

import { useState, useEffect, useCallback, useTransition } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NominalCode {
  id:       string;
  code:     string;
  name:     string;
  type:     "INCOME" | "EXPENDITURE" | "BALANCE_SHEET";
  category: string | null;
}

interface StagedTransaction {
  id:              string;
  date:            string;
  description:     string;
  amount:          string;
  currency:        string;
  merchantName:    string | null;
  transactionType: "CREDIT" | "DEBIT";
  status:          "PENDING" | "CODED" | "EXCLUDED";
  matchingRule:    string | null;
  notes:           string | null;
  accountName:     string;
  nominalCodeId:   string | null;
  nominalCode:     string | null;
  nominalName:     string | null;
}

interface Pagination {
  page:       number;
  pageSize:   number;
  total:      number;
  totalPages: number;
}

interface Summary {
  status: string;
  count:  number;
  total:  string;
}

type FilterStatus = "all" | "PENDING" | "CODED";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: string, type: "CREDIT" | "DEBIT") {
  const n = Math.abs(parseFloat(amount));
  const formatted = new Intl.NumberFormat("en-GB", {
    style:    "currency",
    currency: "GBP",
  }).format(n);
  return { formatted, isCredit: type === "CREDIT" };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day:   "2-digit",
    month: "short",
    year:  "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:  "bg-amber-50 text-amber-700 border-amber-200",
    CODED:    "bg-blue-50 text-blue-700 border-blue-200",
    EXCLUDED: "bg-gray-100 text-gray-500 border-gray-200",
    POSTED:   "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  );
}

function NominalPicker({
  codes,
  value,
  onChange,
  disabled,
}: {
  codes:    NominalCode[];
  value:    string | null;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  // Group codes by type then category
  const income      = codes.filter((c) => c.type === "INCOME");
  const expenditure = codes.filter((c) => c.type === "EXPENDITURE");

  const renderGroup = (label: string, items: NominalCode[]) => {
    if (!items.length) return null;
    // Sub-group by category
    const byCategory = items.reduce<Record<string, NominalCode[]>>((acc, c) => {
      const cat = c.category ?? "General";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(c);
      return acc;
    }, {});

    return (
      <optgroup label={label} key={label}>
        {Object.entries(byCategory).map(([cat, catCodes]) => (
          <>
            <option key={`cat-${cat}`} disabled value="" style={{ fontStyle: "italic", color: "#999" }}>
              — {cat} —
            </option>
            {catCodes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.name}
              </option>
            ))}
          </>
        ))}
      </optgroup>
    );
  };

  return (
    <select
      value={value ?? ""}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      disabled={disabled}
      className="w-full text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
    >
      <option value="">Select nominal code…</option>
      {renderGroup("INCOME", income)}
      {renderGroup("EXPENDITURE", expenditure)}
    </select>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TransactionInbox() {
  const [transactions, setTransactions]   = useState<StagedTransaction[]>([]);
  const [pagination, setPagination]       = useState<Pagination | null>(null);
  const [summary, setSummary]             = useState<Summary[]>([]);
  const [nominalCodes, setNominalCodes]   = useState<NominalCode[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filterStatus, setFilterStatus]   = useState<FilterStatus>("all");
  const [search, setSearch]               = useState("");
  const [page, setPage]                   = useState(1);
  const [selected, setSelected]           = useState<Set<string>>(new Set());
  const [posting, startPosting]           = useTransition();
  const [updatingId, setUpdatingId]       = useState<string | null>(null);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [postResult, setPostResult]       = useState<{ posted: number; errors: number } | null>(null);

  // Fetch nominal codes once
  useEffect(() => {
    fetch("/api/nominal-codes")
      .then((r) => r.json())
      .then((d) => setNominalCodes(d.codes ?? []));
  }, []);

  // Fetch transactions when filters change
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      ...(filterStatus !== "all" && { status: filterStatus }),
      ...(search && { search }),
    });
    const res  = await fetch(`/api/transactions/staged?${params}`);
    const data = await res.json();
    setTransactions(data.transactions ?? []);
    setPagination(data.pagination ?? null);
    setSummary(data.summary ?? []);
    setLoading(false);
    setSelected(new Set()); // clear selection on filter change
  }, [page, filterStatus, search]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Debounce search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function assignNominal(txId: string, nominalCodeId: string) {
    setUpdatingId(txId);
    await fetch(`/api/transactions/staged/${txId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "assign_nominal", nominalCodeId }),
    });
    setUpdatingId(null);
    fetchTransactions();
  }

  async function excludeTransaction(txId: string) {
    setUpdatingId(txId);
    await fetch(`/api/transactions/staged/${txId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "exclude" }),
    });
    setUpdatingId(null);
    fetchTransactions();
  }

  function postSelected() {
    startPosting(async () => {
      const ids = selected.size > 0 ? [...selected] : undefined;
      const res  = await fetch("/api/transactions/post", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ transactionIds: ids }),
      });
      const data = await res.json();
      setPostResult({ posted: data.posted, errors: data.errors?.length ?? 0 });
      fetchTransactions();
    });
  }

  // ── Selection helpers ──────────────────────────────────────────────────────

  const codedTransactions = transactions.filter((t) => t.status === "CODED");
  const allCodedSelected  = codedTransactions.length > 0 &&
    codedTransactions.every((t) => selected.has(t.id));

  function toggleSelectAll() {
    if (allCodedSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(codedTransactions.map((t) => t.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Summary counts ─────────────────────────────────────────────────────────

  const pendingCount = summary.find((s) => s.status === "PENDING")?.count ?? 0;
  const codedCount   = summary.find((s) => s.status === "CODED")?.count ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Transaction Inbox</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Review bank transactions and assign nominal codes before posting to the ledger
            </p>
          </div>

          <div className="flex items-center gap-3">
            {postResult && (
              <span className={`text-sm ${postResult.errors > 0 ? "text-amber-600" : "text-green-600"}`}>
                {postResult.posted} posted
                {postResult.errors > 0 && `, ${postResult.errors} errors`}
              </span>
            )}
            <button
              onClick={postSelected}
              disabled={posting || codedCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {posting ? (
                <>
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                  Posting…
                </>
              ) : (
                <>
                  Post to ledger
                  {selected.size > 0
                    ? ` (${selected.size} selected)`
                    : codedCount > 0
                    ? ` (${codedCount} coded)`
                    : ""}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* ── Summary pills ── */}
        <div className="flex items-center gap-3">
          {[
            { label: "All",     value: "all"    as FilterStatus, count: pendingCount + codedCount },
            { label: "Pending", value: "PENDING" as FilterStatus, count: pendingCount },
            { label: "Coded",   value: "CODED"   as FilterStatus, count: codedCount },
          ].map(({ label, value, count }) => (
            <button
              key={value}
              onClick={() => { setFilterStatus(value); setPage(1); }}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                filterStatus === value
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                filterStatus === value ? "bg-white/20" : "bg-slate-100"
              }`}>
                {count}
              </span>
            </button>
          ))}

          <div className="ml-auto">
            <input
              type="search"
              placeholder="Search transactions…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
              Loading transactions…
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm font-medium">No transactions found</p>
              <p className="text-xs mt-1">All transactions may already be posted or excluded</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allCodedSelected}
                      onChange={toggleSelectAll}
                      title="Select all coded"
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Account</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Nominal code</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const { formatted, isCredit } = formatAmount(tx.amount, tx.transactionType);
                  const isExpanded = expandedId === tx.id;
                  const isUpdating = updatingId === tx.id;
                  const isExcluded = tx.status === "EXCLUDED";

                  return (
                    <>
                      <tr
                        key={tx.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                          isExcluded ? "opacity-50" : ""
                        } ${selected.has(tx.id) ? "bg-blue-50 hover:bg-blue-50" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(tx.id)}
                            onChange={() => toggleSelect(tx.id)}
                            disabled={tx.status !== "CODED"}
                            className="rounded border-slate-300 disabled:opacity-30"
                          />
                        </td>

                        {/* Date */}
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                          {formatDate(tx.date)}
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-medium text-slate-800 truncate">
                            {tx.merchantName ?? tx.description}
                          </div>
                          {tx.merchantName && (
                            <div className="text-xs text-slate-400 truncate">{tx.description}</div>
                          )}
                          {tx.matchingRule && (
                            <div className="text-xs text-blue-500 mt-0.5">
                              Auto-matched: {tx.matchingRule}
                            </div>
                          )}
                        </td>

                        {/* Account */}
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                          {tx.accountName}
                        </td>

                        {/* Amount */}
                        <td className={`px-4 py-3 text-right font-mono font-medium whitespace-nowrap ${
                          isCredit ? "text-green-600" : "text-slate-800"
                        }`}>
                          {isCredit ? "+" : "−"}{formatted}
                        </td>

                        {/* Nominal picker */}
                        <td className="px-4 py-3 min-w-55">
                          {isExcluded ? (
                            <span className="text-xs text-slate-400 italic">Excluded</span>
                          ) : (
                            <NominalPicker
                              codes={nominalCodes}
                              value={tx.nominalCodeId}
                              onChange={(id) => assignNominal(tx.id, id)}
                              disabled={isUpdating || posting}
                            />
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          {isUpdating ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <span className="animate-spin h-3 w-3 border border-slate-400 border-t-transparent rounded-full" />
                              Saving…
                            </span>
                          ) : (
                            <StatusBadge status={tx.status} />
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                              title="Notes"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                            </button>
                            {!isExcluded ? (
                              <button
                                onClick={() => excludeTransaction(tx.id)}
                                title="Exclude (transfers, contra entries, etc.)"
                                className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={async () => {
                                  setUpdatingId(tx.id);
                                  await fetch(`/api/transactions/staged/${tx.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "unexclude" }),
                                  });
                                  setUpdatingId(null);
                                  fetchTransactions();
                                }}
                                title="Restore"
                                className="p-1.5 rounded hover:bg-green-50 text-slate-400 hover:text-green-500 transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded notes row */}
                      {isExpanded && (
                        <tr key={`${tx.id}-notes`} className="bg-slate-50 border-b border-slate-100">
                          <td colSpan={8} className="px-4 py-3">
                            <NotesEditor
                              txId={tx.id}
                              initialNotes={tx.notes ?? ""}
                              onSave={(notes) => {
                                setTransactions((prev) =>
                                  prev.map((t) => t.id === tx.id ? { ...t, notes } : t)
                                );
                              }}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              Showing {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
              {pagination.total} transactions
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notes editor ─────────────────────────────────────────────────────────────

function NotesEditor({
  txId,
  initialNotes,
  onSave,
}: {
  txId:         string;
  initialNotes: string;
  onSave:       (notes: string) => void;
}) {
  const [notes, setNotes]   = useState(initialNotes);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/transactions/staged/${txId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "update_notes", notes }),
    });
    setSaving(false);
    setSaved(true);
    onSave(notes);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex-1">
        <label className="text-xs font-medium text-slate-500 mb-1 block">Notes / memo</label>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
          rows={2}
          placeholder="Add a note for the internal audit trail…"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-5 px-3 py-2 bg-slate-800 text-white text-xs font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : saved ? "✓ Saved" : "Save"}
      </button>
    </div>
  );
}
