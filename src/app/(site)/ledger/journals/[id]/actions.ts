// src/app/ledger/journals/[id]/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { journalEntries, journalLines } from '@/db/schema/nominalLedger'
import { redirect } from 'next/navigation'

export async function updateJournalDescriptionsAction(input: {
  journalEntryId: string
  description: string
  lines: Array<{
    id: string
    description: string
  }>
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    throw new Error('Unauthorised')
  }

  const parishCouncilId = session.user.parishCouncilId
  const description = input.description.trim()

  if (!description) {
    throw new Error('Journal description is required.')
  }

  await db.transaction(async trx => {
    await trx
      .update(journalEntries)
      .set({
        description
      })
      .where(
        and(
          eq(journalEntries.id, input.journalEntryId),
          eq(journalEntries.parishCouncilId, parishCouncilId)
        )
      )

    for (const line of input.lines) {
      await trx
        .update(journalLines)
        .set({
          description: line.description.trim()
        })
        .where(
          and(
            eq(journalLines.id, line.id),
            eq(journalLines.journalEntryId, input.journalEntryId),
            eq(journalLines.parishCouncilId, parishCouncilId)
          )
        )
    }
  })

  revalidatePath(`/ledger/journals/${input.journalEntryId}`)
  revalidatePath('/ledger')
}

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
    .select()
    .from(journalEntries)
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
        postedById: userId
      })
      .returning()

    reversalEntryId = reversalEntry.id

    await trx.insert(journalLines).values(
      originalLines.map(line => ({
        parishCouncilId,
        journalEntryId: reversalEntry.id,
        nominalCodeId: line.nominalCodeId,
        debit: line.credit,
        credit: line.debit,
        description: `Reversal of ${originalJournal.reference}`
      }))
    )
  })

  revalidatePath('/ledger')
  revalidatePath(`/ledger/journals/${journalEntryId}`)
  revalidatePath(`/ledger/journals/${reversalEntryId}`)

  redirect(`/ledger/journals/${reversalEntryId}`)
}
