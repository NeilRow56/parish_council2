// src/app/(site)/ledger/bank-entry/new/actions.ts

'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { and, eq, inArray } from 'drizzle-orm'

import { db } from '@/db'
import { auth } from '@/lib/auth'
import { bankConnections } from '@/db/schema/bankConnection'
import {
  journalEntries,
  journalLines,
  nominalCodes
} from '@/db/schema/nominalLedger'

type BankEntryType = 'PAYMENT' | 'RECEIPT'
type VatRate = 'NO_VAT' | 'STANDARD_20' | 'REDUCED_5'

type VatTreatment = 'RECOVERABLE' | 'IRRECOVERABLE' | 'OUTPUT' | 'OUTSIDE_SCOPE'

type BankEntryLineInput = {
  nominalCodeId: string
  description: string
  amount: string
  vatRate?: VatRate
  vatTreatment?: VatTreatment
  vatAmount?: string
}

function parseAmountToPence(value: string) {
  const cleaned = value.replace(/,/g, '').trim()
  const parsed = Number(cleaned)

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Amounts must be valid numbers.')
  }

  return Math.round(parsed * 100)
}

function parsePositiveAmountToPence(value: string) {
  const pence = parseAmountToPence(value)

  if (pence <= 0) {
    throw new Error('Amounts must be greater than zero.')
  }

  return pence
}

function formatPence(value: number) {
  return (value / 100).toFixed(2)
}

function getVatRatePercent(vatRate: VatRate) {
  if (vatRate === 'STANDARD_20') return 20
  if (vatRate === 'REDUCED_5') return 5
  return 0
}

function splitGrossAmount(grossPence: number, vatRate: VatRate) {
  const rate = getVatRatePercent(vatRate)

  if (rate === 0) {
    return {
      gross: grossPence,
      net: grossPence,
      vat: 0
    }
  }

  const net = Math.round((grossPence * 100) / (100 + rate))
  const vat = grossPence - net

  return {
    gross: grossPence,
    net,
    vat
  }
}

function normaliseVatRate(value: string | undefined): VatRate {
  if (value === 'STANDARD_20') return 'STANDARD_20'
  if (value === 'REDUCED_5') return 'REDUCED_5'
  return 'NO_VAT'
}

function normaliseVatTreatment(
  value: string | undefined,
  entryType: BankEntryType
): VatTreatment {
  if (value === 'RECOVERABLE') return 'RECOVERABLE'
  if (value === 'IRRECOVERABLE') return 'IRRECOVERABLE'
  if (value === 'OUTPUT') return 'OUTPUT'
  if (value === 'OUTSIDE_SCOPE') return 'OUTSIDE_SCOPE'

  return entryType === 'PAYMENT' ? 'RECOVERABLE' : 'OUTSIDE_SCOPE'
}

export async function createBankEntryAction(input: {
  financialYearId: string
  date: string
  bankConnectionId: string
  entryType: BankEntryType
  reference: string
  lines: BankEntryLineInput[]
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    throw new Error('Unauthorised')
  }

  const parishCouncilId = session.user.parishCouncilId
  const userId = session.user.id

  if (!input.date) {
    throw new Error('Date is required.')
  }

  if (!['PAYMENT', 'RECEIPT'].includes(input.entryType)) {
    throw new Error('Invalid entry type.')
  }

  const [bankAccount] = await db
    .select({
      connectionId: bankConnections.id,
      nominalCodeId: bankConnections.nominalCodeId,
      accountName: bankConnections.accountName
    })
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.id, input.bankConnectionId),
        eq(bankConnections.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1)

  if (!bankAccount?.nominalCodeId) {
    throw new Error(
      'Selected bank account is not linked to a bank nominal code.'
    )
  }

  const bankNominalCodeId = bankAccount.nominalCodeId

  const enteredLines = input.lines.filter(
    line => line.nominalCodeId || line.description.trim() || line.amount.trim()
  )

  const cleanedLines = enteredLines.map(line => {
    if (!line.nominalCodeId) {
      throw new Error('Each entered line must have a nominal code.')
    }

    const grossPence = parsePositiveAmountToPence(line.amount)
    const vatRate = normaliseVatRate(line.vatRate)
    const vatTreatment = normaliseVatTreatment(
      line.vatTreatment,
      input.entryType
    )

    if (input.entryType === 'PAYMENT' && vatTreatment === 'OUTPUT') {
      throw new Error('Output VAT cannot be used on a payment.')
    }

    if (
      input.entryType === 'RECEIPT' &&
      ['RECOVERABLE', 'IRRECOVERABLE'].includes(vatTreatment)
    ) {
      throw new Error('Input VAT treatment cannot be used on a receipt.')
    }

    const calculatedSplit = splitGrossAmount(grossPence, vatRate)

    const shouldUseVat =
      (input.entryType === 'PAYMENT' && vatTreatment === 'RECOVERABLE') ||
      (input.entryType === 'RECEIPT' && vatTreatment === 'OUTPUT')

    const manualVatPence =
      shouldUseVat && line.vatAmount?.trim()
        ? parseAmountToPence(line.vatAmount)
        : calculatedSplit.vat

    if (manualVatPence > grossPence) {
      throw new Error('VAT amount cannot exceed the gross amount.')
    }

    const vatPence = shouldUseVat ? manualVatPence : 0
    const netPence = grossPence - vatPence

    return {
      nominalCodeId: line.nominalCodeId,
      description: line.description.trim(),
      grossPence,
      netPence,
      vatPence,
      vatRate,
      vatTreatment
    }
  })

  if (cleanedLines.length === 0) {
    throw new Error('At least one line is required.')
  }

  const validCodes = await db
    .select({ id: nominalCodes.id })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, input.financialYearId),
        eq(nominalCodes.isActive, true),
        inArray(
          nominalCodes.id,
          cleanedLines.map(line => line.nominalCodeId)
        )
      )
    )

  const validCodeIds = new Set(validCodes.map(code => code.id))

  for (const line of cleanedLines) {
    if (!validCodeIds.has(line.nominalCodeId)) {
      throw new Error('Invalid nominal code selected.')
    }
  }

  const needsInputVatCode = cleanedLines.some(
    line =>
      input.entryType === 'PAYMENT' &&
      line.vatTreatment === 'RECOVERABLE' &&
      line.vatPence > 0
  )

  const needsOutputVatCode = cleanedLines.some(
    line =>
      input.entryType === 'RECEIPT' &&
      line.vatTreatment === 'OUTPUT' &&
      line.vatPence > 0
  )

  let inputVatNominalCodeId: string | null = null
  let outputVatNominalCodeId: string | null = null

  if (needsInputVatCode) {
    const [inputVatCode] = await db
      .select({ id: nominalCodes.id })
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, parishCouncilId),
          eq(nominalCodes.financialYearId, input.financialYearId),
          eq(nominalCodes.isActive, true),
          eq(nominalCodes.isVatRecoverable, true)
        )
      )
      .limit(1)

    if (!inputVatCode) {
      throw new Error(
        'No active Input VAT recoverable nominal code has been configured.'
      )
    }

    inputVatNominalCodeId = inputVatCode.id
  }

  if (needsOutputVatCode) {
    const [outputVatCode] = await db
      .select({ id: nominalCodes.id })
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.parishCouncilId, parishCouncilId),
          eq(nominalCodes.financialYearId, input.financialYearId),
          eq(nominalCodes.isActive, true),
          eq(nominalCodes.isVatPayable, true)
        )
      )
      .limit(1)

    if (!outputVatCode) {
      throw new Error(
        'No active Output VAT payable nominal code has been configured.'
      )
    }

    outputVatNominalCodeId = outputVatCode.id
  }

  await db.transaction(async trx => {
    for (const [index, line] of cleanedLines.entries()) {
      const sequence = String(index + 1).padStart(2, '0')
      const referencePrefix = input.entryType === 'PAYMENT' ? 'PAY' : 'REC'

      const baseReference =
        input.reference.trim() || `${referencePrefix}-${input.date}-${sequence}`

      const reference =
        cleanedLines.length === 1
          ? baseReference
          : `${baseReference}-${sequence}`

      const description =
        line.description ||
        `${input.entryType === 'PAYMENT' ? 'Payment' : 'Receipt'} - ${
          bankAccount.accountName
        }`

      const [entry] = await trx
        .insert(journalEntries)
        .values({
          parishCouncilId,
          financialYearId: input.financialYearId,
          reference,
          date: input.date,
          description,
          source: 'MANUAL',
          postedById: userId
        })
        .returning()

      if (input.entryType === 'PAYMENT') {
        const shouldPostRecoverableVat =
          line.vatTreatment === 'RECOVERABLE' && line.vatPence > 0

        const lineValues: (typeof journalLines.$inferInsert)[] = [
          {
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: line.nominalCodeId,
            debit: formatPence(
              shouldPostRecoverableVat ? line.netPence : line.grossPence
            ),
            credit: '0.00',
            description
          }
        ]

        if (shouldPostRecoverableVat) {
          if (!inputVatNominalCodeId) {
            throw new Error(
              'No active Input VAT recoverable nominal code has been configured.'
            )
          }

          lineValues.push({
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: inputVatNominalCodeId,
            debit: formatPence(line.vatPence),
            credit: '0.00',
            description: `Recoverable VAT - ${description}`
          })
        }

        lineValues.push({
          parishCouncilId,
          journalEntryId: entry.id,
          nominalCodeId: bankNominalCodeId,
          debit: '0.00',
          credit: formatPence(line.grossPence),
          description
        })

        await trx.insert(journalLines).values(lineValues)
      } else {
        const shouldPostOutputVat =
          line.vatTreatment === 'OUTPUT' && line.vatPence > 0

        const lineValues: (typeof journalLines.$inferInsert)[] = [
          {
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: bankNominalCodeId,
            debit: formatPence(line.grossPence),
            credit: '0.00',
            description
          },
          {
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: line.nominalCodeId,
            debit: '0.00',
            credit: formatPence(
              shouldPostOutputVat ? line.netPence : line.grossPence
            ),
            description
          }
        ]

        if (shouldPostOutputVat) {
          if (!outputVatNominalCodeId) {
            throw new Error(
              'No active Output VAT payable nominal code has been configured.'
            )
          }

          lineValues.push({
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: outputVatNominalCodeId,
            debit: '0.00',
            credit: formatPence(line.vatPence),
            description: `Output VAT - ${description}`
          })
        }

        await trx.insert(journalLines).values(lineValues)
      }
    }
  })

  redirect('/ledger')
}
