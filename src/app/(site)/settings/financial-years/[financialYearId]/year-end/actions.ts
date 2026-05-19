'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import {
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  nominalOpeningBalances,
  yearEndRuns
} from '@/db/schema/nominalLedger'
import { bankConnections } from '@/db/schema/bankConnection'
import { borrowings } from '@/db/schema/borrowings'
import { auth } from '@/lib/auth'

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function addOneYear(dateValue: string | Date) {
  const date = new Date(dateValue)
  date.setFullYear(date.getFullYear() + 1)

  return date.toISOString().slice(0, 10)
}

function createFinancialYearLabel(startDate: string, endDate: string) {
  const startYear = new Date(startDate).getFullYear()
  const endYear = new Date(endDate).getFullYear().toString().slice(-2)

  return `${startYear}/${endYear}`
}

function isReserveCode(code: string) {
  const numericCode = Number.parseInt(code, 10)

  return (
    Number.isFinite(numericCode) && numericCode >= 3000 && numericCode < 4000
  )
}

export async function runYearEndRollforward(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    redirect('/auth/login')
  }

  const parishCouncilId = session.user.parishCouncilId

  if (!parishCouncilId) {
    redirect('/auth/register')
  }

  const financialYearId = String(formData.get('financialYearId') || '')

  if (!financialYearId) {
    redirect('/settings/financial-years?yearEndError=Financial+year+is+required')
  }

  let nextFinancialYearId: string

  try {
    nextFinancialYearId = await db.transaction(async tx => {
      const currentYear = await tx.query.financialYears.findFirst({
      where: and(
        eq(financialYears.id, financialYearId),
        eq(financialYears.parishCouncilId, parishCouncilId)
      )
    })

    if (!currentYear) {
      throw new Error('Financial year not found')
    }

    if (currentYear.isClosed) {
      throw new Error('This financial year is already closed')
    }

    const existingRun = await tx.query.yearEndRuns.findFirst({
      where: and(
        eq(yearEndRuns.parishCouncilId, parishCouncilId),
        eq(yearEndRuns.fromFinancialYearId, currentYear.id)
      )
    })

    if (existingRun) {
      throw new Error('A year-end run already exists for this financial year')
    }

    const nextStartDate = addOneYear(currentYear.startDate)
    const nextEndDate = addOneYear(currentYear.endDate)
    const nextLabel = createFinancialYearLabel(nextStartDate, nextEndDate)

    const existingNextYear = await tx.query.financialYears.findFirst({
      where: and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        eq(financialYears.label, nextLabel)
      )
    })

    if (existingNextYear) {
      throw new Error(`Financial year ${nextLabel} already exists`)
    }

    const [yearEndRun] = await tx
      .insert(yearEndRuns)
      .values({
        parishCouncilId,
        fromFinancialYearId: currentYear.id,
        status: 'DRAFT',
        createdByUserId: session.user.id,
        notes: `Year end rollforward started for ${currentYear.label}`
      })
      .returning({
        id: yearEndRuns.id
      })

    const [nextYear] = await tx
      .insert(financialYears)
      .values({
        parishCouncilId,
        label: nextLabel,
        startDate: nextStartDate,
        endDate: nextEndDate,
        isClosed: false
      })
      .returning({
        id: financialYears.id
      })

    const currentCodes = await tx
      .select()
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, parishCouncilId),
          eq(nominalCodes.financialYearId, currentYear.id),
          eq(nominalCodes.isActive, true)
        )
      )
      .orderBy(nominalCodes.code)

    if (currentCodes.length === 0) {
      throw new Error('No nominal codes found to roll forward')
    }

    const copiedCodes = await tx
      .insert(nominalCodes)
      .values(
        currentCodes.map(code => ({
          parishCouncilId,
          financialYearId: nextYear.id,
          code: code.code,
          name: code.name,
          type: code.type,
          category: code.category,
          agarBox: code.agarBox,
          isBank: code.isBank,
          isVatRecoverable: code.isVatRecoverable,
          isVatPayable: code.isVatPayable,
          isActive: code.isActive
        }))
      )
      .returning({
        id: nominalCodes.id,
        code: nominalCodes.code
      })

    const nextCodeIdByCode = new Map(
      copiedCodes.map(code => [code.code, code.id])
    )

    const bankCodes = currentCodes.filter(code => code.isBank)

    for (const code of bankCodes) {
      const nextNominalCodeId = nextCodeIdByCode.get(code.code)

      if (!nextNominalCodeId) {
        throw new Error(`Could not map bank nominal code ${code.code}`)
      }

      await tx
        .update(bankConnections)
        .set({
          nominalCodeId: nextNominalCodeId,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(bankConnections.parishCouncilId, parishCouncilId),
            eq(bankConnections.nominalCodeId, code.id)
          )
        )
    }

    const openingRows = await tx
      .select({
        nominalCodeId: nominalOpeningBalances.nominalCodeId,
        amount: nominalOpeningBalances.amount
      })
      .from(nominalOpeningBalances)
      .where(
        and(
          eq(nominalOpeningBalances.parishCouncilId, parishCouncilId),
          eq(nominalOpeningBalances.financialYearId, currentYear.id)
        )
      )

    const movementRows = await tx
      .select({
        nominalCodeId: journalLines.nominalCodeId,
        debit: sql<string>`coalesce(sum(${journalLines.debit}), 0)`,
        credit: sql<string>`coalesce(sum(${journalLines.credit}), 0)`
      })
      .from(journalLines)
      .innerJoin(
        journalEntries,
        eq(journalLines.journalEntryId, journalEntries.id)
      )
      .where(
        and(
          eq(journalLines.parishCouncilId, parishCouncilId),
          eq(journalEntries.financialYearId, currentYear.id)
        )
      )
      .groupBy(journalLines.nominalCodeId)

    const openingByNominalCode = new Map(
      openingRows.map(row => [row.nominalCodeId, toNumber(row.amount)])
    )

    const movementByNominalCode = new Map(
      movementRows.map(row => {
        const debit = toNumber(row.debit)
        const credit = toNumber(row.credit)

        return [row.nominalCodeId, debit - credit]
      })
    )

    const balanceSheetCodes = currentCodes.filter(
      code => code.type === 'BALANCE_SHEET'
    )

    const reserveCodes = balanceSheetCodes.filter(code =>
      isReserveCode(code.code)
    )

    const generalReserveCode =
      reserveCodes.find(code => code.code === '3000') ?? reserveCodes[0]

    const normalOpeningBalanceByCodeId = new Map(
      balanceSheetCodes.map(code => {
        const openingBalance = openingByNominalCode.get(code.id) ?? 0
        const movement = movementByNominalCode.get(code.id) ?? 0

        return [code.id, openingBalance + movement]
      })
    )

    const nonReserveOpeningTotal = balanceSheetCodes
      .filter(code => !isReserveCode(code.code))
      .reduce(
        (total, code) => total + (normalOpeningBalanceByCodeId.get(code.id) ?? 0),
        0
      )

    const otherReserveOpeningTotal = reserveCodes
      .filter(code => code.id !== generalReserveCode?.id)
      .reduce(
        (total, code) => total + (normalOpeningBalanceByCodeId.get(code.id) ?? 0),
        0
      )

    const generalReserveOpening = -(
      nonReserveOpeningTotal + otherReserveOpeningTotal
    )

    const nextOpeningBalances = balanceSheetCodes.map(code => {
      const openingBalance = openingByNominalCode.get(code.id) ?? 0
      const movement = movementByNominalCode.get(code.id) ?? 0
      const baseClosingBalance = openingBalance + movement
      const nextOpeningBalance =
        generalReserveCode?.id === code.id
          ? generalReserveOpening
          : baseClosingBalance

      const nextNominalCodeId = nextCodeIdByCode.get(code.code)

      if (!nextNominalCodeId) {
        throw new Error(`Could not map nominal code ${code.code}`)
      }

      return {
        parishCouncilId,
        financialYearId: nextYear.id,
        nominalCodeId: nextNominalCodeId,
        amount: nextOpeningBalance.toFixed(2)
      }
    })

    if (nextOpeningBalances.length > 0) {
      await tx.insert(nominalOpeningBalances).values(nextOpeningBalances)
    }

    const activeBorrowings = await tx
      .select()
      .from(borrowings)
      .where(
        and(
          eq(borrowings.parishCouncilId, parishCouncilId),
          eq(borrowings.financialYearId, currentYear.id),
          eq(borrowings.isActive, true)
        )
      )

    if (activeBorrowings.length > 0) {
      await tx.insert(borrowings).values(
        activeBorrowings.map(loan => {
          const oldNominalCode = currentCodes.find(
            code => code.id === loan.nominalCodeId
          )

          const nextNominalCodeId = oldNominalCode
            ? (nextCodeIdByCode.get(oldNominalCode.code) ?? null)
            : null

          return {
            parishCouncilId,
            financialYearId: nextYear.id,
            lender: loan.lender,
            reference: loan.reference,
            purpose: loan.purpose,
            startDate: loan.startDate,
            originalAmount: loan.originalAmount,
            openingBalance: '0',
            interestRate: loan.interestRate,
            repaymentFrequency: loan.repaymentFrequency,
            nominalCodeId: nextNominalCodeId,
            notes: loan.notes,
            isActive: loan.isActive,
            closedDate: loan.closedDate
          }
        })
      )
    }

    await tx
      .update(financialYears)
      .set({
        isClosed: true,
        closedAt: new Date()
      })
      .where(
        and(
          eq(financialYears.id, currentYear.id),
          eq(financialYears.parishCouncilId, parishCouncilId)
        )
      )

    await tx
      .update(yearEndRuns)
      .set({
        toFinancialYearId: nextYear.id,
        status: 'COMPLETED',
        completedAt: new Date(),
        notes: `Year end rollforward completed from ${currentYear.label} to ${nextLabel}`
      })
      .where(eq(yearEndRuns.id, yearEndRun.id))

      return nextYear.id
    })
  } catch (error) {
    const message = encodeURIComponent(
      error instanceof Error
        ? error.message
        : 'Could not run year end. Please check the year-end checks and try again.'
    )

    redirect(
      `/settings/financial-years/${financialYearId}/year-end?yearEndError=${message}`
    )
  }

  void nextFinancialYearId

  revalidatePath('/settings')
  revalidatePath('/settings/nominal-codes')
  revalidatePath('/reports/agar-summary')
  revalidatePath('/reports/borrowings')

  redirect('/settings/financial-years?rolledForward=1')
}
