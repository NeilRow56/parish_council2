'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq } from 'drizzle-orm'

import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'

type JournalLineInput = {
  nominalCodeId: string
  description: string
  debit: string
  credit: string
}

export async function createManualJournalAction(input: {
  financialYearId: string
  date: string
  description: string
  lines: JournalLineInput[]
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    throw new Error('Unauthorised')
  }

  const parishCouncilId = session.user.parishCouncilId
  const userId = session.user.id

  const description = input.description.trim()
  const date = input.date

  if (!date || !description) {
    throw new Error('Date and description are required.')
  }

  const cleanedLines = input.lines
    .map(line => ({
      nominalCodeId: line.nominalCodeId,
      description: line.description.trim(),
      debit: Number(line.debit.replace(/,/g, '') || 0),
      credit: Number(line.credit.replace(/,/g, '') || 0)
    }))
    .filter(line => line.nominalCodeId && (line.debit > 0 || line.credit > 0))

  if (cleanedLines.length < 2) {
    throw new Error('A journal must have at least two lines.')
  }

  for (const line of cleanedLines) {
    if (line.debit > 0 && line.credit > 0) {
      throw new Error('A line cannot have both a debit and a credit.')
    }

    if (line.debit < 0 || line.credit < 0) {
      throw new Error('Negative journal amounts are not allowed.')
    }
  }

  const totalDebit = cleanedLines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredit = cleanedLines.reduce((sum, line) => sum + line.credit, 0)

  if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
    throw new Error('Journal does not balance.')
  }

  const codeIds = cleanedLines.map(line => line.nominalCodeId)

  const validCodes = await db
    .select({ id: nominalCodes.id })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, input.financialYearId),
        eq(nominalCodes.isActive, true)
      )
    )

  const validCodeIds = new Set(validCodes.map(code => code.id))

  for (const codeId of codeIds) {
    if (!validCodeIds.has(codeId)) {
      throw new Error('Invalid nominal code selected.')
    }
  }

  await db.transaction(async trx => {
    const reference = `MAN-${Date.now()}`

    const [entry] = await trx
      .insert(journalEntries)
      .values({
        parishCouncilId,
        financialYearId: input.financialYearId,
        reference,
        date,
        description,
        source: 'MANUAL',
        postedById: userId
      })
      .returning()

    await trx.insert(journalLines).values(
      cleanedLines.map(line => ({
        parishCouncilId,
        journalEntryId: entry.id,
        nominalCodeId: line.nominalCodeId,
        debit: line.debit.toFixed(2),
        credit: line.credit.toFixed(2),
        description: line.description || description
      }))
    )
  })

  redirect('/ledger')
}
