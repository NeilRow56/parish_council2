import { eq, and, inArray, lte, gte, isNotNull } from "drizzle-orm";
import { bankTransactions } from "@/db/schema/bankTransactions";
import { db } from "@/db";
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
} from "@/db/schema/nominalLedger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostResult {
  posted: number;
  skipped: number;
  errors: Array<{ transactionId: string; reason: string }>;
  journalEntryIds: string[];
}

interface PostOptions {
  parishCouncilId: string;
  transactionIds?: string[];
  postedById: string;
}

// ---------------------------------------------------------------------------
// Main poster
// ---------------------------------------------------------------------------

export async function postTransactionsToLedger(
  options: PostOptions
): Promise<PostResult> {
  const { parishCouncilId, postedById } = options;

  const result: PostResult = {
    posted: 0,
    skipped: 0,
    errors: [],
    journalEntryIds: [],
  };

  const conditions = [
    eq(bankTransactions.parishCouncilId, parishCouncilId),
    eq(bankTransactions.status, "CODED"),
    isNotNull(bankTransactions.nominalCodeId),
  ];

  if (options.transactionIds?.length) {
    conditions.push(inArray(bankTransactions.id, options.transactionIds));
  }

  const transactions = await db
    .select()
    .from(bankTransactions)
    .where(and(...conditions));

  if (transactions.length === 0) {
    return result;
  }

  const yearCache = new Map<string, typeof financialYears.$inferSelect>();

  let refCounter = await getNextReferenceNumber(parishCouncilId);

  for (const tx of transactions) {
    try {
      const year = await getFinancialYearForDate(
        parishCouncilId,
        tx.date as string,
        yearCache
      );

      if (!year) {
        result.errors.push({
          transactionId: tx.id,
          reason: `No open financial year found for date ${tx.date}`,
        });
        result.skipped++;
        continue;
      }

      if (!tx.nominalCodeId) {
        result.errors.push({
          transactionId: tx.id,
          reason: "No nominal code assigned",
        });
        result.skipped++;
        continue;
      }

      const [nominalCode] = await db
        .select()
        .from(nominalCodes)
        .where(
          and(
            eq(nominalCodes.parishCouncilId, parishCouncilId),
            eq(nominalCodes.id, tx.nominalCodeId)
          )
        )
        .limit(1);

      if (!nominalCode) {
        result.errors.push({
          transactionId: tx.id,
          reason: `Nominal code ${tx.nominalCodeId} not found`,
        });
        result.skipped++;
        continue;
      }

      const [bankCode] = await db
        .select()
        .from(nominalCodes)
        .where(
          and(
            eq(nominalCodes.parishCouncilId, parishCouncilId),
            eq(nominalCodes.financialYearId, year.id),
            eq(nominalCodes.isBank, true),
            eq(nominalCodes.isActive, true)
          )
        )
        .limit(1);

      if (!bankCode) {
        result.errors.push({
          transactionId: tx.id,
          reason: `No bank nominal code found for financial year ${year.label}`,
        });
        result.skipped++;
        continue;
      }

      const amount = Math.abs(parseFloat(tx.amount as string));
      const isCredit = parseFloat(tx.amount as string) > 0;
      const reference = `BNK-${year.label.replace("/", "-")}-${String(
        refCounter++
      ).padStart(4, "0")}`;

      await db.transaction(async (trx) => {
        const [entry] = await trx
          .insert(journalEntries)
          .values({
            parishCouncilId,
            financialYearId: year.id,
            reference,
            date: tx.date as string,
            description: tx.merchantName ?? tx.description,
            source: "BANK_FEED",
            postedById,
          })
          .returning();

        const lines = isCredit
  ? [
      {
        parishCouncilId,
        journalEntryId: entry.id,
        nominalCodeId: bankCode.id,
        debit: amount.toFixed(2),
        credit: "0.00",
        description: tx.description,
      },
      {
        parishCouncilId,
        journalEntryId: entry.id,
        nominalCodeId: nominalCode.id,
        debit: "0.00",
        credit: amount.toFixed(2),
        description: tx.description,
      },
    ]
  : [
      {
        parishCouncilId,
        journalEntryId: entry.id,
        nominalCodeId: nominalCode.id,
        debit: amount.toFixed(2),
        credit: "0.00",
        description: tx.description,
      },
      {
        parishCouncilId,
        journalEntryId: entry.id,
        nominalCodeId: bankCode.id,
        debit: "0.00",
        credit: amount.toFixed(2),
        description: tx.description,
      },
    ];

        await trx.insert(journalLines).values(lines);

        await trx
          .update(bankTransactions)
          .set({
            status: "POSTED",
            journalEntryId: entry.id,
            postedAt: new Date(),
          })
          .where(
            and(
              eq(bankTransactions.parishCouncilId, parishCouncilId),
              eq(bankTransactions.id, tx.id)
            )
          );

        result.journalEntryIds.push(entry.id);
      });

      result.posted++;
    } catch (err) {
      console.error(`[Poster] Failed to post transaction ${tx.id}:`, err);

      result.errors.push({
        transactionId: tx.id,
        reason: err instanceof Error ? err.message : "Unknown error",
      });

      result.skipped++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getFinancialYearForDate(
  parishCouncilId: string,
  dateStr: string,
  cache: Map<string, typeof financialYears.$inferSelect>
): Promise<typeof financialYears.$inferSelect | null> {
  const monthKey = dateStr.substring(0, 7);

  if (cache.has(dateStr)) return cache.get(dateStr)!;
  if (cache.has(monthKey)) return cache.get(monthKey)!;

  const [year] = await db
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        lte(financialYears.startDate, dateStr),
        gte(financialYears.endDate, dateStr),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1);

  if (year) {
    cache.set(monthKey, year);
    cache.set(dateStr, year);
  }

  return year ?? null;
}

async function getNextReferenceNumber(
  parishCouncilId: string
): Promise<number> {
  const [{ count }] = await db
    .select({ count: db.$count(journalEntries) })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.source, "BANK_FEED")
      )
    );

  return (count ?? 0) + 1;
}
