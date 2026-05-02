// app/(app)/vat/returns/actions.ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq, gte, lte, sql, desc } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  vatReturns
} from '@/db/schema'

type VatTotals = {
  inputVat: number
  outputVat: number
  netVat: number
}

async function requireParishCouncil() {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    redirect('/auth/login?next=/vat/returns')
  }

  return {
    userId: session.user.id,
    parishCouncilId: session.user.parishCouncilId
  }
}

function toMoneyNumber(value: unknown): number {
  return Number(value ?? 0)
}

function money(value: number): string {
  return value.toFixed(2)
}

function dateToInputDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function getVatReturnTotals(params: {
  financialYearId: string
  periodStart: Date
  periodEnd: Date
}): Promise<VatTotals> {
  const { parishCouncilId } = await requireParishCouncil()

  const periodStart = dateToInputDate(params.periodStart)
  const periodEnd = dateToInputDate(params.periodEnd)

  const [row] = await db
    .select({
      inputVat: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.isVatRecoverable} = true
            then ${journalLines.debit}
            else 0
          end
        ), 0)
      `,

      outputVat: sql<string>`
        coalesce(sum(
          case
            when ${nominalCodes.isVatPayable} = true
            then ${journalLines.credit}
            else 0
          end
        ), 0)
      `
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .innerJoin(nominalCodes, eq(journalLines.nominalCodeId, nominalCodes.id))
    .where(
      and(
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, params.financialYearId),
        gte(journalEntries.date, periodStart),
        lte(journalEntries.date, periodEnd)
      )
    )

  const inputVat = toMoneyNumber(row?.inputVat)
  const outputVat = toMoneyNumber(row?.outputVat)

  return {
    inputVat,
    outputVat,
    netVat: outputVat - inputVat
  }
}

export async function submitVatReturn(params: {
  financialYearId: string
  periodStart: Date
  periodEnd: Date
}) {
  const { parishCouncilId, userId } = await requireParishCouncil()

  return db.transaction(async tx => {
    const existing = await tx.query.vatReturns.findFirst({
      where: and(
        eq(vatReturns.parishCouncilId, parishCouncilId),
        eq(vatReturns.financialYearId, params.financialYearId),
        eq(vatReturns.periodStart, params.periodStart),
        eq(vatReturns.periodEnd, params.periodEnd)
      )
    })

    if (existing?.status === 'SUBMITTED') {
      throw new Error('This VAT return has already been submitted.')
    }

    const periodStart = dateToInputDate(params.periodStart)
    const periodEnd = dateToInputDate(params.periodEnd)

    const [totalsRow] = await tx
      .select({
        inputVat: sql<string>`
          coalesce(sum(
            case
              when ${nominalCodes.isVatRecoverable} = true
              then ${journalLines.debit}
              else 0
            end
          ), 0)
        `,

        outputVat: sql<string>`
          coalesce(sum(
            case
              when ${nominalCodes.isVatPayable} = true
              then ${journalLines.credit}
              else 0
            end
          ), 0)
        `
      })
      .from(journalLines)
      .innerJoin(
        journalEntries,
        eq(journalLines.journalEntryId, journalEntries.id)
      )
      .innerJoin(nominalCodes, eq(journalLines.nominalCodeId, nominalCodes.id))
      .where(
        and(
          eq(journalEntries.parishCouncilId, parishCouncilId),
          eq(journalEntries.financialYearId, params.financialYearId),
          gte(journalEntries.date, periodStart),
          lte(journalEntries.date, periodEnd)
        )
      )

    const inputVat = toMoneyNumber(totalsRow?.inputVat)
    const outputVat = toMoneyNumber(totalsRow?.outputVat)

    const totals: VatTotals = {
      inputVat,
      outputVat,
      netVat: outputVat - inputVat
    }

    const [vatControl] = await tx
      .select()
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, parishCouncilId),
          eq(nominalCodes.financialYearId, params.financialYearId),
          eq(nominalCodes.code, '2100')
        )
      )

    const [inputVatCode] = await tx
      .select()
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, parishCouncilId),
          eq(nominalCodes.financialYearId, params.financialYearId),
          eq(nominalCodes.code, '2110')
        )
      )

    const [outputVatCode] = await tx
      .select()
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, parishCouncilId),
          eq(nominalCodes.financialYearId, params.financialYearId),
          eq(nominalCodes.code, '2120')
        )
      )

    if (!vatControl || !inputVatCode || !outputVatCode) {
      throw new Error('VAT nominal codes 2100, 2110 and 2120 are required.')
    }

    const [returnRow] = await tx
      .insert(vatReturns)
      .values({
        parishCouncilId,
        financialYearId: params.financialYearId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        inputVat: money(totals.inputVat),
        outputVat: money(totals.outputVat),
        netVat: money(totals.netVat),
        status: 'SUBMITTED',
        submittedAt: new Date()
      })
      .onConflictDoNothing()
      .returning()

    if (!returnRow) {
      throw new Error('A VAT return already exists for this period.')
    }

    const reference = `VAT-${periodEnd}`

    const [clearingJournal] = await tx
      .insert(journalEntries)
      .values({
        parishCouncilId,
        financialYearId: params.financialYearId,
        reference,
        date: periodEnd,
        description: `VAT return submitted for period ending ${params.periodEnd.toLocaleDateString(
          'en-GB'
        )}`,
        source: 'VAT_RETURN',
        sourceId: returnRow.id,
        postedById: userId
      })
      .returning()

    const clearingLines: (typeof journalLines.$inferInsert)[] = []

    if (totals.outputVat > 0) {
      clearingLines.push({
        parishCouncilId,
        journalEntryId: clearingJournal.id,
        nominalCodeId: outputVatCode.id,
        debit: money(totals.outputVat),
        credit: '0.00',
        description: 'Clear output VAT'
      })
    }

    if (totals.inputVat > 0) {
      clearingLines.push({
        parishCouncilId,
        journalEntryId: clearingJournal.id,
        nominalCodeId: inputVatCode.id,
        debit: '0.00',
        credit: money(totals.inputVat),
        description: 'Clear input VAT'
      })
    }

    if (totals.netVat > 0) {
      clearingLines.push({
        parishCouncilId,
        journalEntryId: clearingJournal.id,
        nominalCodeId: vatControl.id,
        debit: '0.00',
        credit: money(totals.netVat),
        description: 'VAT payable transferred to VAT control'
      })
    }

    if (totals.netVat < 0) {
      clearingLines.push({
        parishCouncilId,
        journalEntryId: clearingJournal.id,
        nominalCodeId: vatControl.id,
        debit: money(Math.abs(totals.netVat)),
        credit: '0.00',
        description: 'VAT reclaimable transferred to VAT control'
      })
    }

    if (clearingLines.length > 0) {
      await tx.insert(journalLines).values(clearingLines)
    }

    revalidatePath('/vat/returns')

    return {
      success: true,
      vatReturnId: returnRow.id
    }
  })
}

export async function getCurrentFinancialYearForVatReturns() {
  const { parishCouncilId } = await requireParishCouncil()

  const today = dateToInputDate(new Date())

  const [year] = await db
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        lte(financialYears.startDate, today),
        gte(financialYears.endDate, today)
      )
    )
    .limit(1)

  return year ?? null
}

export type Vat126InvoiceLine = {
  invoiceDate: string
  supplierVatNumber: string
  description: string
  addressedTo: string
  vatPaid: number
}

export async function getVat126InvoiceLines(params: {
  financialYearId: string
  periodStart: Date
  periodEnd: Date
}): Promise<Vat126InvoiceLine[]> {
  const { parishCouncilId } = await requireParishCouncil()

  const periodStart = dateToInputDate(params.periodStart)
  const periodEnd = dateToInputDate(params.periodEnd)

  const rows = await db
    .select({
      invoiceDate: journalEntries.date,
      journalDescription: journalEntries.description,
      lineDescription: journalLines.description,
      vatPaid: journalLines.debit
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .innerJoin(nominalCodes, eq(journalLines.nominalCodeId, nominalCodes.id))
    .where(
      and(
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, params.financialYearId),
        eq(nominalCodes.isVatRecoverable, true),
        gte(journalEntries.date, periodStart),
        lte(journalEntries.date, periodEnd)
      )
    )
    .orderBy(desc(journalEntries.date))

  return rows.map(row => ({
    invoiceDate: row.invoiceDate,
    supplierVatNumber: '',
    description: row.lineDescription ?? row.journalDescription,
    addressedTo: '',
    vatPaid: Number(row.vatPaid ?? 0)
  }))
}
