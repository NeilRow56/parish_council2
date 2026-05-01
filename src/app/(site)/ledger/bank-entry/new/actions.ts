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

type BankEntryLineInput = {
  nominalCodeId: string
  description: string
  amount: string
}

function parseAmount(value: string) {
  const cleaned = value.replace(/,/g, '').trim()
  const parsed = Number(cleaned)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Amounts must be greater than zero.')
  }

  return parsed.toFixed(2)
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

    return {
      nominalCodeId: line.nominalCodeId,
      description: line.description.trim(),
      amount: parseAmount(line.amount)
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

  await db.transaction(async trx => {
    for (const [index, line] of cleanedLines.entries()) {
      const sequence = String(index + 1).padStart(2, '0')
      const referencePrefix = input.entryType === 'PAYMENT' ? 'PAY' : 'REC'
      const reference =
        input.reference.trim() || `${referencePrefix}-${input.date}-${sequence}`

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
          reference:
            cleanedLines.length === 1 ? reference : `${reference}-${sequence}`,
          date: input.date,
          description,
          source: 'MANUAL',
          postedById: userId
        })
        .returning()

      if (input.entryType === 'PAYMENT') {
        await trx.insert(journalLines).values([
          {
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: line.nominalCodeId,
            debit: line.amount,
            credit: '0.00',
            description
          },
          {
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: bankNominalCodeId,
            debit: '0.00',
            credit: line.amount,
            description
          }
        ])
      } else {
        await trx.insert(journalLines).values([
          {
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: bankNominalCodeId,
            debit: line.amount,
            credit: '0.00',
            description
          },
          {
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: line.nominalCodeId,
            debit: '0.00',
            credit: line.amount,
            description
          }
        ])
      }
    }
  })

  redirect('/ledger')
}
