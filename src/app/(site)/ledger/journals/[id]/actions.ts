// src/app/ledger/journals/[id]/actions.ts

'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import {
  financialYears,
  journalEntries,
  journalLines
} from '@/db/schema/nominalLedger'

export async function reverseJournalAction(journalEntryId: string) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    throw new Error('Unauthorised')
  }

  const parishCouncilId = session.user.parishCouncilId
  const userId = session.user.id

  const [originalJournal] = await db
    .select({
      id: journalEntries.id,
      parishCouncilId: journalEntries.parishCouncilId,
      financialYearId: journalEntries.financialYearId,
      reference: journalEntries.reference,
      source: journalEntries.source,
      sourceId: journalEntries.sourceId,
      attachmentUrl: journalEntries.attachmentUrl,
      attachmentName: journalEntries.attachmentName,
      attachmentKey: journalEntries.attachmentKey,
      reversesJournalEntryId: journalEntries.reversesJournalEntryId,
      reversedByJournalEntryId: journalEntries.reversedByJournalEntryId,
      financialYearClosed: financialYears.isClosed
    })
    .from(journalEntries)
    .innerJoin(financialYears, eq(financialYears.id, journalEntries.financialYearId))
    .where(
      and(
        eq(journalEntries.id, journalEntryId),
        eq(journalEntries.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!originalJournal) {
    throw new Error('Journal not found.')
  }

  if (originalJournal.source !== 'MANUAL') {
    throw new Error('Only manual journals can be reversed here.')
  }

  if (originalJournal.financialYearClosed) {
    throw new Error('Closed-year journals cannot be reversed.')
  }

  if (originalJournal.reversedByJournalEntryId) {
    throw new Error('This journal has already been reversed.')
  }

  if (originalJournal.reversesJournalEntryId) {
    throw new Error('Reversal journals cannot be reversed.')
  }

  const originalLines = await db
    .select()
    .from(journalLines)
    .where(
      and(
        eq(journalLines.journalEntryId, journalEntryId),
        eq(journalLines.parishCouncilId, parishCouncilId)
      )
    )

  if (originalLines.length === 0) {
    throw new Error('Journal has no lines to reverse.')
  }

  let reversalEntryId = ''

  await db.transaction(async trx => {
    const reference = `REV-${originalJournal.reference}`

    const [reversalEntry] = await trx
      .insert(journalEntries)
      .values({
        parishCouncilId,
        financialYearId: originalJournal.financialYearId,
        reference,
        date: new Date().toISOString().split('T')[0],
        description: `Reversal of ${originalJournal.reference}`,
        source: 'MANUAL',
        sourceId: originalJournal.id,
        reversesJournalEntryId: originalJournal.id,
        postedById: userId,
        attachmentUrl: originalJournal.attachmentUrl,
        attachmentName: originalJournal.attachmentName,
        attachmentKey: originalJournal.attachmentKey
      })
      .returning()

    reversalEntryId = reversalEntry.id

    await trx
      .update(journalEntries)
      .set({
        reversedByJournalEntryId: reversalEntry.id
      })
      .where(
        and(
          eq(journalEntries.id, originalJournal.id),
          eq(journalEntries.parishCouncilId, parishCouncilId)
        )
      )

    await trx.insert(journalLines).values(
      originalLines.map(line => ({
        parishCouncilId,
        journalEntryId: reversalEntry.id,
        nominalCodeId: line.nominalCodeId,
        supplierId: line.supplierId,
        reserveId: line.reserveId,
        projectId: line.projectId,
        invoiceReference: line.invoiceReference,
        goodsSupplied: line.goodsSupplied,
        supplierVatNumberSnapshot: line.supplierVatNumberSnapshot,
        debit: line.credit,
        credit: line.debit,
        description: `Reversal of ${originalJournal.reference}`
      }))
    )
  })

  revalidatePath('/ledger')
  revalidatePath(`/ledger/journals/${journalEntryId}`)
  revalidatePath(`/ledger/journals/${reversalEntryId}`)

  return { success: true, journalEntryId: reversalEntryId }
}
