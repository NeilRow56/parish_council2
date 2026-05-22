'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { and, eq, inArray, isNull, lte } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankTransactions } from '@/db/schema'
import {
  bankReconciliations,
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'
import { getFinancialYearDateWarning } from '@/lib/financial-years/date-range'
import { utapi } from '@/server/uploadthing'

type ClearManualBankLinesResult =
  | { success: true; clearedCount: number }
  | { success: false; error: string }

type StatementEvidence = {
  id: string
  statementBalance: string
  statementAttachmentUrl: string | null
  statementAttachmentName: string | null
  statementAttachmentKey: string | null
}

type SaveStatementEvidenceResult =
  | { success: true; evidence: StatementEvidence }
  | { success: false; error: string }

type RemoveStatementEvidenceResult =
  | { success: true }
  | { success: false; error: string }

function expectedError(message: string) {
  return { success: false, error: message } as const
}

function uniqueLineIds(lineIds: string[]) {
  return Array.from(new Set(lineIds.map(id => id.trim()).filter(Boolean)))
}

function parseStatementBalance(input: string) {
  const value = input.replace(/,/g, '').trim()

  if (!/^-?\d+(\.\d{1,2})?$/.test(value)) {
    return null
  }

  return Number(value).toFixed(2)
}

async function getStatementContext(input: {
  financialYearId: string
  bankNominalCodeId: string
  statementDate: string
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return { error: 'Your session has expired. Please sign in again.' } as const
  }

  const parishCouncilId = session.user.parishCouncilId

  if (!input.statementDate) {
    return { error: 'Statement date is required.' } as const
  }

  const [financialYear] = await db
    .select({
      id: financialYears.id,
      label: financialYears.label,
      startDate: financialYears.startDate,
      endDate: financialYears.endDate,
      isClosed: financialYears.isClosed
    })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.id, input.financialYearId),
        eq(financialYears.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!financialYear || financialYear.isClosed) {
    return {
      error: 'Manual reconciliation is only available for an open financial year.'
    } as const
  }

  const dateWarning = getFinancialYearDateWarning(
    input.statementDate,
    financialYear
  )

  if (dateWarning) {
    return { error: dateWarning } as const
  }

  const [bankNominalCode] = await db
    .select({ id: nominalCodes.id })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.id, input.bankNominalCodeId),
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        eq(nominalCodes.isBank, true)
      )
    )
    .limit(1)

  if (!bankNominalCode) {
    return { error: 'Choose a bank account for this reconciliation.' } as const
  }

  return {
    bankNominalCode,
    financialYear,
    parishCouncilId,
    session
  } as const
}

async function upsertStatementEvidence(input: {
  parishCouncilId: string
  financialYearId: string
  bankNominalCodeId: string
  statementDate: string
  statementBalance: string
  createdByUserId: string
  attachment?: { url: string; name: string; key: string }
}) {
  const [evidence] = await db
    .insert(bankReconciliations)
    .values({
      parishCouncilId: input.parishCouncilId,
      financialYearId: input.financialYearId,
      bankNominalCodeId: input.bankNominalCodeId,
      statementDate: input.statementDate,
      statementBalance: input.statementBalance,
      statementAttachmentUrl: input.attachment?.url,
      statementAttachmentName: input.attachment?.name,
      statementAttachmentKey: input.attachment?.key,
      createdByUserId: input.createdByUserId
    })
    .onConflictDoUpdate({
      target: [
        bankReconciliations.parishCouncilId,
        bankReconciliations.financialYearId,
        bankReconciliations.bankNominalCodeId,
        bankReconciliations.statementDate
      ],
      set: {
        statementBalance: input.statementBalance,
        ...(input.attachment
          ? {
              statementAttachmentUrl: input.attachment.url,
              statementAttachmentName: input.attachment.name,
              statementAttachmentKey: input.attachment.key
            }
          : {}),
        updatedAt: new Date()
      }
    })
    .returning({
      id: bankReconciliations.id,
      statementBalance: bankReconciliations.statementBalance,
      statementAttachmentUrl: bankReconciliations.statementAttachmentUrl,
      statementAttachmentName: bankReconciliations.statementAttachmentName,
      statementAttachmentKey: bankReconciliations.statementAttachmentKey
    })

  return evidence
}

export async function saveStatementEvidenceAction(input: {
  financialYearId: string
  bankNominalCodeId: string
  statementDate: string
  statementBalance: string
  attachment?: { url: string; name: string; key: string }
}): Promise<SaveStatementEvidenceResult> {
  const context = await getStatementContext(input)

  if ('error' in context) {
    return expectedError(context.error ?? 'Could not load statement details.')
  }

  const statementBalance = parseStatementBalance(input.statementBalance)

  if (!statementBalance) {
    return expectedError('Enter a valid statement balance.')
  }

  if (
    input.attachment &&
    (!input.attachment.url || !input.attachment.name || !input.attachment.key)
  ) {
    return expectedError('The uploaded statement details are incomplete.')
  }

  const [previousEvidence] = input.attachment
    ? await db
        .select({ key: bankReconciliations.statementAttachmentKey })
        .from(bankReconciliations)
        .where(
          and(
            eq(bankReconciliations.parishCouncilId, context.parishCouncilId),
            eq(bankReconciliations.financialYearId, context.financialYear.id),
            eq(bankReconciliations.bankNominalCodeId, context.bankNominalCode.id),
            eq(bankReconciliations.statementDate, input.statementDate)
          )
        )
        .limit(1)
    : []

  const evidence = await upsertStatementEvidence({
    parishCouncilId: context.parishCouncilId,
    financialYearId: context.financialYear.id,
    bankNominalCodeId: context.bankNominalCode.id,
    statementDate: input.statementDate,
    statementBalance,
    createdByUserId: context.session.user.id,
    attachment: input.attachment
  })

  if (
    previousEvidence?.key &&
    input.attachment?.key &&
    previousEvidence.key !== input.attachment.key
  ) {
    await utapi.deleteFiles(previousEvidence.key)
  }

  revalidatePath('/banking/manual-reconciliation')
  revalidatePath('/reports/bank-reconciliation')

  return { success: true, evidence }
}

export async function removeStatementEvidenceAttachmentAction(input: {
  evidenceId: string
}): Promise<RemoveStatementEvidenceResult> {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    return expectedError('Your session has expired. Please sign in again.')
  }

  const [evidence] = await db
    .select({
      id: bankReconciliations.id,
      attachmentKey: bankReconciliations.statementAttachmentKey,
      isClosed: financialYears.isClosed
    })
    .from(bankReconciliations)
    .innerJoin(financialYears, eq(financialYears.id, bankReconciliations.financialYearId))
    .where(
      and(
        eq(bankReconciliations.id, input.evidenceId),
        eq(bankReconciliations.parishCouncilId, session.user.parishCouncilId),
        eq(financialYears.parishCouncilId, session.user.parishCouncilId)
      )
    )
    .limit(1)

  if (!evidence) {
    return expectedError('That statement evidence could not be found.')
  }

  if (evidence.isClosed) {
    return expectedError('Closed financial years are read-only.')
  }

  if (!evidence.attachmentKey) {
    return expectedError('There is no statement PDF to remove.')
  }

  await db
    .update(bankReconciliations)
    .set({
      statementAttachmentUrl: null,
      statementAttachmentName: null,
      statementAttachmentKey: null,
      updatedAt: new Date()
    })
    .where(eq(bankReconciliations.id, evidence.id))

  await utapi.deleteFiles(evidence.attachmentKey)

  revalidatePath('/banking/manual-reconciliation')
  revalidatePath('/reports/bank-reconciliation')

  return { success: true }
}

export async function clearManualBankLinesAction(input: {
  financialYearId: string
  bankNominalCodeId: string
  statementDate: string
  statementBalance: string
  reconciliationReference?: string
  lineIds: string[]
}): Promise<ClearManualBankLinesResult> {
  const lineIds = uniqueLineIds(input.lineIds)

  if (!lineIds.length) {
    return expectedError('Select at least one bank line to mark cleared.')
  }

  const context = await getStatementContext(input)

  if ('error' in context) {
    return expectedError(context.error ?? 'Could not load statement details.')
  }

  const statementBalance = parseStatementBalance(input.statementBalance)

  if (!statementBalance) {
    return expectedError('Enter a valid statement balance.')
  }

  const { bankNominalCode, financialYear, parishCouncilId, session } = context

  const candidateLines = await db
    .select({
      id: journalLines.id,
      journalEntryId: journalEntries.id,
      clearedAt: journalLines.clearedAt
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .innerJoin(nominalCodes, eq(nominalCodes.id, journalLines.nominalCodeId))
    .where(
      and(
        inArray(journalLines.id, lineIds),
        eq(journalLines.parishCouncilId, parishCouncilId),
        eq(journalLines.nominalCodeId, bankNominalCode.id),
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, financialYear.id),
        eq(journalEntries.source, 'MANUAL'),
        lte(journalEntries.date, input.statementDate),
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYear.id),
        eq(nominalCodes.isBank, true)
      )
    )

  if (candidateLines.length !== lineIds.length) {
    return expectedError(
      'One or more selected lines are not eligible for this reconciliation.'
    )
  }

  if (candidateLines.some(line => line.clearedAt)) {
    return expectedError('One or more selected lines have already been cleared.')
  }

  const matchedEntries = await db
    .select({ journalEntryId: bankTransactions.matchedJournalEntryId })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.parishCouncilId, parishCouncilId),
        inArray(
          bankTransactions.matchedJournalEntryId,
          candidateLines.map(line => line.journalEntryId)
        )
      )
    )
    .limit(1)

  if (matchedEntries.length) {
    return expectedError(
      'A selected bank line is already matched to a bank-feed transaction.'
    )
  }

  const clearedAt = new Date()
  const reconciliationReference =
    input.reconciliationReference?.trim().slice(0, 200) || null

  await upsertStatementEvidence({
    parishCouncilId,
    financialYearId: financialYear.id,
    bankNominalCodeId: bankNominalCode.id,
    statementDate: input.statementDate,
    statementBalance,
    createdByUserId: session.user.id
  })

  const updatedLines = await db
    .update(journalLines)
    .set({
      clearedAt,
      clearedByUserId: session.user.id,
      clearedStatementDate: input.statementDate,
      reconciliationReference
    })
    .where(and(inArray(journalLines.id, lineIds), isNull(journalLines.clearedAt)))
    .returning({ id: journalLines.id })

  if (updatedLines.length !== lineIds.length) {
    return expectedError(
      'Some lines changed while reconciling. Refresh and try again.'
    )
  }

  revalidatePath('/banking/manual-reconciliation')
  revalidatePath('/reports/bank-reconciliation')

  return { success: true, clearedCount: updatedLines.length }
}
