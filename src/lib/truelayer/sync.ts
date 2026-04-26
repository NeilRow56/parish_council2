import { fetchTransactions } from "./client";
import { applyMatchingRulesBatch } from "./matcher";
import { eq, and, lte, gte } from "drizzle-orm";
import { subDays } from "date-fns";
import type { BankConnection } from "./types";
import { db } from "@/db";
import { bankTransactions } from "@/db/schema/bankTransactions";
import { bankConnections } from "@/db/schema/bankConnection";
import { financialYears } from "@/db/schema/nominalLedger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  imported: number;
  skipped: number;
}

export interface SyncAllConnectionsInput {
  parishCouncilId: string;
}

export interface SyncConnectionInput {
  connection: BankConnection;
  parishCouncilId: string;
}

// ---------------------------------------------------------------------------
// Sync a single bank connection
// ---------------------------------------------------------------------------

export async function syncConnection({
  connection,
  parishCouncilId,
}: SyncConnectionInput): Promise<SyncResult> {
  // Fetch from 1 day before last sync to catch any late-arriving transactions.
  // Fall back to 90 days on the first-ever sync.
  const from = connection.lastSyncAt
    ? subDays(new Date(connection.lastSyncAt), 1)
    : subDays(new Date(), 90);

  const to = new Date();

  const transactions = await fetchTransactions(connection, from, to);

  if (transactions.length === 0) {
    await touchLastSync({
      connectionId: connection.id,
      parishCouncilId,
    });

    return { imported: 0, skipped: 0 };
  }

  // Resolve current financial year for this parish council only.
  const currentYearId = await getCurrentFinancialYearId(parishCouncilId);

  const matchMap = await applyMatchingRulesBatch(
  transactions,
  parishCouncilId,
  currentYearId ?? undefined
);

  let imported = 0;
  let skipped = 0;

  for (const tx of transactions) {
    const dedupeKey =
      tx.normalised_provider_transaction_id ?? tx.transaction_id;

    // Idempotent sync, scoped to this parish council.
    const existing = await db
      .select({ id: bankTransactions.id })
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.parishCouncilId, parishCouncilId),
          eq(bankTransactions.providerTxId, dedupeKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // TrueLayer returns positive amounts; sign by transaction type:
    // CREDIT = money in, DEBIT = money out.
    const signedAmount =
      tx.transaction_type === "CREDIT" ? tx.amount : -tx.amount;

    const matchResult = matchMap.get(dedupeKey) ?? null;

    await db.insert(bankTransactions).values({
      parishCouncilId,
      connectionId: connection.id,
      providerTxId: dedupeKey,
      date: new Date(tx.timestamp).toISOString().split("T")[0],
      description: tx.description,
      amount: signedAmount.toFixed(2),
      currency: tx.currency,
      merchantName: tx.merchant_name ?? null,
      category: tx.transaction_category ?? null,
      transactionType: tx.transaction_type,
      status: matchResult ? "CODED" : "PENDING",
      nominalCodeId: matchResult?.nominalCodeId ?? null,
      matchingRule: matchResult?.ruleName ?? null,
    });

    imported++;
  }

  await touchLastSync({
    connectionId: connection.id,
    parishCouncilId,
  });

  return { imported, skipped };
}

// ---------------------------------------------------------------------------
// Sync all active connections for one parish council
// ---------------------------------------------------------------------------

export async function syncAllConnections({
  parishCouncilId,
}: SyncAllConnectionsInput): Promise<
  Array<{
    connectionId: string;
    accountName: string;
    result: SyncResult | null;
    error: string | null;
  }>
> {
  const connections = await db
    .select()
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.parishCouncilId, parishCouncilId),
        eq(bankConnections.status, "ACTIVE")
      )
    );

  const results = await Promise.allSettled(
    connections.map((connection) =>
      syncConnection({
        connection,
        parishCouncilId,
      })
    )
  );

  return results.map((result, index) => ({
    connectionId: connections[index].id,
    accountName: connections[index].accountName,
    result: result.status === "fulfilled" ? result.value : null,
    error: result.status === "rejected" ? String(result.reason) : null,
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function touchLastSync({
  connectionId,
  parishCouncilId,
}: {
  connectionId: string;
  parishCouncilId: string;
}): Promise<void> {
  await db
    .update(bankConnections)
    .set({
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bankConnections.id, connectionId),
        eq(bankConnections.parishCouncilId, parishCouncilId)
      )
    );
}

async function getCurrentFinancialYearId(
  parishCouncilId: string
): Promise<string | null> {
  const today = new Date().toISOString().split("T")[0];

  const [year] = await db
    .select({ id: financialYears.id })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        lte(financialYears.startDate, today),
        gte(financialYears.endDate, today),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1);

  return year?.id ?? null;
}
