// app/(app)/vat/returns/actions.ts
'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, desc, eq, gt, gte, lte, ne, sql } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  reserves,
  suppliers,
  vatReturns
} from '@/db/schema'

type VatTotals = {
  inputVat: number
  outputVat: number
  netVat: number
  box6OutputsNet: number
  box7InputsNet: number
}

export type Vat126InvoiceLine = {
  journalLineId: string
  journalEntryId: string
  invoiceDate: string
  reference: string
  supplierName: string | null
  supplierVatNumberSnapshot: string | null
  goodsSupplied: string | null
  invoiceReference: string | null
  nominalCode: string
  nominalName: string
  description: string
  vatPaid: number
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
           and ${journalLines.debit} > 0
          then ${journalLines.debit}
          else 0
        end
      ), 0)
    `,

      outputVat: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.isVatPayable} = true
           and ${journalLines.credit} > 0
          then ${journalLines.credit}
          else 0
        end
      ), 0)
    `,

      box6OutputsNet: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.type} = 'INCOME'
            and ${journalLines.credit} > 0
          then ${journalLines.credit}
          else 0
        end
      ), 0)
    `,

      box7InputsNet: sql<string>`
      coalesce(sum(
        case
          when ${nominalCodes.type} = 'EXPENDITURE'
            and ${journalLines.debit} > 0
          then ${journalLines.debit}
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
        ne(journalEntries.source, 'VAT_RETURN'),
        gte(journalEntries.date, periodStart),
        lte(journalEntries.date, periodEnd)
      )
    )

  const inputVat = toMoneyNumber(row?.inputVat)
  const outputVat = toMoneyNumber(row?.outputVat)

  return {
    inputVat,
    outputVat,
    netVat: outputVat - inputVat,
    box6OutputsNet: toMoneyNumber(row?.box6OutputsNet),
    box7InputsNet: toMoneyNumber(row?.box7InputsNet)
  }
}

export async function submitVatReturn(params: {
  financialYearId: string
  periodStart: Date
  periodEnd: Date
}) {
  const { parishCouncilId, userId } = await requireParishCouncil()

  return db.transaction(async tx => {
    const financialYear = await tx.query.financialYears.findFirst({
      where: and(
        eq(financialYears.id, params.financialYearId),
        eq(financialYears.parishCouncilId, parishCouncilId)
      )
    })

    if (!financialYear || financialYear.isClosed) {
      throw new Error('VAT returns cannot be submitted for a closed year.')
    }

    const [generalReserve] = await tx
      .select()
      .from(reserves)
      .where(
        and(
          eq(reserves.parishCouncilId, parishCouncilId),
          eq(reserves.name, 'General reserve')
        )
      )

    if (!generalReserve) {
      throw new Error(
        'General reserve is required before submitting a VAT return.'
      )
    }
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
               and ${journalLines.debit} > 0
              then ${journalLines.debit}
              else 0
            end
          ), 0)
        `,
        outputVat: sql<string>`
          coalesce(sum(
            case
              when ${nominalCodes.isVatPayable} = true
               and ${journalLines.credit} > 0
              then ${journalLines.credit}
              else 0
            end
          ), 0)
        `,
        box6OutputsNet: sql<string>`
  coalesce(sum(
    case
      when ${nominalCodes.type} = 'INCOME'
       and ${journalLines.credit} > 0
      then ${journalLines.credit}
      else 0
    end
  ), 0)
`,

        box7InputsNet: sql<string>`
  coalesce(sum(
    case
      when ${nominalCodes.type} = 'EXPENDITURE'
       and ${journalLines.debit} > 0
      then ${journalLines.debit}
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
          ne(journalEntries.source, 'VAT_RETURN'),
          gte(journalEntries.date, periodStart),
          lte(journalEntries.date, periodEnd)
        )
      )

    const inputVat = toMoneyNumber(totalsRow?.inputVat)
    const outputVat = toMoneyNumber(totalsRow?.outputVat)

    const totals: VatTotals = {
      inputVat,
      outputVat,
      netVat: outputVat - inputVat,
      box6OutputsNet: toMoneyNumber(totalsRow?.box6OutputsNet),
      box7InputsNet: toMoneyNumber(totalsRow?.box7InputsNet)
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
        reserveId: generalReserve.id,
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
        reserveId: generalReserve.id,
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
        reserveId: generalReserve.id,
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
        reserveId: generalReserve.id,
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

export async function getFinancialYearForVatReports(financialYearId?: string) {
  const { parishCouncilId } = await requireParishCouncil()

  const [year] = financialYearId
    ? await db
        .select()
        .from(financialYears)
        .where(
          and(
            eq(financialYears.parishCouncilId, parishCouncilId),
            eq(financialYears.id, financialYearId)
          )
        )
        .limit(1)
    : await db
        .select()
        .from(financialYears)
        .where(
          and(
            eq(financialYears.parishCouncilId, parishCouncilId),
            eq(financialYears.isClosed, false)
          )
        )
        .orderBy(desc(financialYears.startDate))
        .limit(1)

  return year ?? null
}

export async function getFinancialYearForVatReportPeriod(params: {
  periodStart: Date
  periodEnd: Date
}) {
  const { parishCouncilId } = await requireParishCouncil()
  const periodStart = dateToInputDate(params.periodStart)
  const periodEnd = dateToInputDate(params.periodEnd)

  const [year] = await db
    .select()
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        lte(financialYears.startDate, periodStart),
        gte(financialYears.endDate, periodEnd)
      )
    )
    .limit(1)

  return year ?? null
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
      journalLineId: journalLines.id,
      journalEntryId: journalEntries.id,
      invoiceDate: journalEntries.date,
      reference: journalEntries.reference,
      journalDescription: journalEntries.description,
      lineDescription: journalLines.description,
      supplierName: suppliers.name,
      supplierVatNumberSnapshot: journalLines.supplierVatNumberSnapshot,
      goodsSupplied: journalLines.goodsSupplied,
      invoiceReference: journalLines.invoiceReference,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,
      vatPaid: journalLines.debit
    })
    .from(journalLines)
    .innerJoin(
      journalEntries,
      eq(journalLines.journalEntryId, journalEntries.id)
    )
    .innerJoin(nominalCodes, eq(journalLines.nominalCodeId, nominalCodes.id))
    .leftJoin(suppliers, eq(journalLines.supplierId, suppliers.id))
    .where(
      and(
        eq(journalEntries.parishCouncilId, parishCouncilId),
        eq(journalEntries.financialYearId, params.financialYearId),
        eq(nominalCodes.isVatRecoverable, true),
        gt(journalLines.debit, '0'),
        gte(journalEntries.date, periodStart),
        lte(journalEntries.date, periodEnd)
      )
    )
    .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt))

  return rows.map(row => ({
    journalLineId: row.journalLineId,
    journalEntryId: row.journalEntryId,
    invoiceDate: row.invoiceDate,
    reference: row.reference,
    supplierName: row.supplierName,
    supplierVatNumberSnapshot: row.supplierVatNumberSnapshot,
    goodsSupplied: row.goodsSupplied,
    invoiceReference: row.invoiceReference,
    nominalCode: row.nominalCode,
    nominalName: row.nominalName,
    description: row.lineDescription ?? row.journalDescription,
    vatPaid: Number(row.vatPaid ?? 0)
  }))
}

export type VatReturnTransactionLine = {
  journalLineId: string
  journalEntryId: string
  date: string
  reference: string
  description: string | null
  nominalCode: string
  nominalName: string
  type: 'INPUT' | 'OUTPUT'
  vatAmount: number
}

export async function getVatReturnTransactionLines(params: {
  financialYearId: string
  periodStart: Date
  periodEnd: Date
}): Promise<VatReturnTransactionLine[]> {
  const { parishCouncilId } = await requireParishCouncil()

  const periodStart = dateToInputDate(params.periodStart)
  const periodEnd = dateToInputDate(params.periodEnd)

  const rows = await db
    .select({
      journalLineId: journalLines.id,
      journalEntryId: journalEntries.id,
      date: journalEntries.date,
      reference: journalEntries.reference,
      description: journalLines.description,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,
      isVatRecoverable: nominalCodes.isVatRecoverable,
      isVatPayable: nominalCodes.isVatPayable,
      debit: journalLines.debit,
      credit: journalLines.credit
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
    .orderBy(desc(journalEntries.date), desc(journalEntries.createdAt))

  return rows
    .filter(
      row =>
        (row.isVatRecoverable && Number(row.debit ?? 0) > 0) ||
        (row.isVatPayable && Number(row.credit ?? 0) > 0)
    )
    .map(row => {
      const isInput = row.isVatRecoverable

      return {
        journalLineId: row.journalLineId,
        journalEntryId: row.journalEntryId,
        date: row.date,
        reference: row.reference,
        description: row.description,
        nominalCode: row.nominalCode,
        nominalName: row.nominalName,
        type: isInput ? 'INPUT' : 'OUTPUT',
        vatAmount: isInput ? Number(row.debit ?? 0) : Number(row.credit ?? 0)
      }
    })
}
