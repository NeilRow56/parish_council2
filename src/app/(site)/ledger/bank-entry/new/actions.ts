// src/app/(site)/ledger/bank-entry/new/actions.ts

'use server'

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
import { projects, reserves, suppliers } from '@/db/schema'
import { utapi } from '@/server/uploadthing'

type BankEntryType = 'PAYMENT' | 'RECEIPT'
type VatRate = 'NO_VAT' | 'STANDARD_20' | 'REDUCED_5'

type VatTreatment = 'RECOVERABLE' | 'IRRECOVERABLE' | 'OUTPUT' | 'OUTSIDE_SCOPE'

type BankEntryLineInput = {
  nominalCodeId: string
  supplierId?: string
  reserveId?: string
  projectId?: string
  invoiceReference?: string
  goodsSupplied?: string
  supplierVatNumberSnapshot?: string
  attachmentUrl?: string
  attachmentName?: string
  attachmentKey?: string
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

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values))
}

export async function createBankEntryAction(input: {
  financialYearId: string
  date: string
  bankConnectionId: string
  entryType: BankEntryType
  reference: string
  attachmentUrl?: string
  attachmentName?: string
  attachmentKey?: string
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

  const [defaultReserve] = await db
    .select({ id: reserves.id })
    .from(reserves)
    .where(
      and(
        eq(reserves.parishCouncilId, parishCouncilId),
        eq(reserves.isDefault, true),
        eq(reserves.isActive, true)
      )
    )
    .limit(1)

  if (!defaultReserve) {
    throw new Error('No active default reserve has been configured.')
  }

  const bankNominalCodeId = bankAccount.nominalCodeId

  const enteredLines = input.lines.filter(
    line =>
      line.nominalCodeId ||
      line.description.trim() ||
      line.amount.trim() ||
      line.supplierId ||
      line.reserveId ||
      line.projectId ||
      line.invoiceReference?.trim() ||
      line.goodsSupplied?.trim() ||
      line.supplierVatNumberSnapshot?.trim() ||
      line.attachmentUrl?.trim() ||
      line.attachmentName?.trim() ||
      line.attachmentKey?.trim()
  )

  const cleanedLines = enteredLines.map(line => {
    if (!line.nominalCodeId) {
      throw new Error('Each entered line must have a nominal code.')
    }

    const reserveId = line.reserveId || defaultReserve.id

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
      supplierId:
        input.entryType === 'PAYMENT' ? line.supplierId || null : null,
      reserveId,
      projectId: line.projectId || null,
      invoiceReference:
        input.entryType === 'PAYMENT'
          ? line.invoiceReference?.trim() || null
          : null,
      goodsSupplied:
        input.entryType === 'PAYMENT'
          ? line.goodsSupplied?.trim() || null
          : null,
      supplierVatNumberSnapshot:
        input.entryType === 'PAYMENT'
          ? line.supplierVatNumberSnapshot?.trim() || null
          : null,
      attachmentUrl: line.attachmentUrl?.trim() || null,
      attachmentName: line.attachmentName?.trim() || null,
      attachmentKey: line.attachmentKey?.trim() || null,
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
          uniqueStrings(cleanedLines.map(line => line.nominalCodeId))
        )
      )
    )

  const validCodeIds = new Set(validCodes.map(code => code.id))

  for (const line of cleanedLines) {
    if (!validCodeIds.has(line.nominalCodeId)) {
      throw new Error('Invalid nominal code selected.')
    }
  }

  const supplierIds = uniqueStrings(
    cleanedLines
      .map(line => line.supplierId)
      .filter((id): id is string => Boolean(id))
  )

  const reserveIds = uniqueStrings(cleanedLines.map(line => line.reserveId))

  const projectIds = uniqueStrings(
    cleanedLines
      .map(line => line.projectId)
      .filter((id): id is string => Boolean(id))
  )

  const validSuppliers = supplierIds.length
    ? await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(
          and(
            eq(suppliers.parishCouncilId, parishCouncilId),
            inArray(suppliers.id, supplierIds)
          )
        )
    : []

  const validReserves = await db
    .select({ id: reserves.id })
    .from(reserves)
    .where(
      and(
        eq(reserves.parishCouncilId, parishCouncilId),
        eq(reserves.isActive, true),
        inArray(reserves.id, reserveIds)
      )
    )

  const validProjects = projectIds.length
    ? await db
        .select({
          id: projects.id,
          reserveId: projects.reserveId
        })
        .from(projects)
        .where(
          and(
            eq(projects.parishCouncilId, parishCouncilId),
            eq(projects.isActive, true),
            inArray(projects.id, projectIds)
          )
        )
    : []

  const validSupplierIds = new Set(validSuppliers.map(supplier => supplier.id))
  const validReserveIds = new Set(validReserves.map(reserve => reserve.id))
  const validProjectById = new Map(
    validProjects.map(project => [project.id, project])
  )

  for (const line of cleanedLines) {
    if (line.supplierId && !validSupplierIds.has(line.supplierId)) {
      throw new Error('Invalid supplier selected.')
    }

    if (!validReserveIds.has(line.reserveId)) {
      throw new Error('Invalid reserve selected.')
    }

    if (line.projectId) {
      const project = validProjectById.get(line.projectId)

      if (!project) {
        throw new Error('Invalid project selected.')
      }

      if (project.reserveId !== line.reserveId) {
        throw new Error(
          'Selected project does not belong to the selected reserve.'
        )
      }
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
        input.reference.trim() ||
        `${referencePrefix}-${input.date}-${Date.now()}-${sequence}`

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
          postedById: userId,
          attachmentUrl: input.attachmentUrl || null,
          attachmentName: input.attachmentName || null,
          attachmentKey: input.attachmentKey || null
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
            supplierId: line.supplierId,
            reserveId: line.reserveId,
            projectId: line.projectId,
            invoiceReference: line.invoiceReference,
            goodsSupplied: line.goodsSupplied,
            supplierVatNumberSnapshot: line.supplierVatNumberSnapshot,
            attachmentUrl: line.attachmentUrl,
            attachmentName: line.attachmentName,
            attachmentKey: line.attachmentKey,
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
            supplierId: line.supplierId,
            reserveId: line.reserveId,
            projectId: line.projectId,
            invoiceReference: line.invoiceReference,
            goodsSupplied: line.goodsSupplied,
            supplierVatNumberSnapshot: line.supplierVatNumberSnapshot,
            debit: formatPence(line.vatPence),
            credit: '0.00',
            description: `Recoverable VAT - ${description}`
          })
        }

        lineValues.push({
          parishCouncilId,
          journalEntryId: entry.id,
          nominalCodeId: bankNominalCodeId,
          reserveId: line.reserveId,
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
            reserveId: line.reserveId,
            debit: formatPence(line.grossPence),
            credit: '0.00',
            description
          },
          {
            parishCouncilId,
            journalEntryId: entry.id,
            nominalCodeId: line.nominalCodeId,
            supplierId: line.supplierId,
            reserveId: line.reserveId,
            projectId: line.projectId,
            invoiceReference: line.invoiceReference,
            goodsSupplied: line.goodsSupplied,
            supplierVatNumberSnapshot: line.supplierVatNumberSnapshot,
            attachmentUrl: line.attachmentUrl,
            attachmentName: line.attachmentName,
            attachmentKey: line.attachmentKey,
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
            supplierId: line.supplierId,
            reserveId: line.reserveId,
            projectId: line.projectId,
            invoiceReference: line.invoiceReference,
            goodsSupplied: line.goodsSupplied,
            supplierVatNumberSnapshot: line.supplierVatNumberSnapshot,
            debit: '0.00',
            credit: formatPence(line.vatPence),
            description: `Output VAT - ${description}`
          })
        }

        await trx.insert(journalLines).values(lineValues)
      }
    }
  })

  return {
    success: true
  }
}

export async function quickCreateSupplierAction(input: {
  name: string
  vatNumber?: string
  defaultGoodsSupplied?: string
}) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user?.parishCouncilId) {
    throw new Error('Unauthorised')
  }

  const parishCouncilId = session.user.parishCouncilId
  const name = input.name.trim()

  if (!name) {
    throw new Error('Supplier name is required.')
  }

  const [supplier] = await db
    .insert(suppliers)
    .values({
      parishCouncilId,
      name,
      vatNumber: input.vatNumber?.trim() || null,
      defaultGoodsSupplied: input.defaultGoodsSupplied?.trim() || null,
      isActive: true
    })
    .returning({
      id: suppliers.id,
      name: suppliers.name,
      vatNumber: suppliers.vatNumber,
      defaultGoodsSupplied: suppliers.defaultGoodsSupplied,
      defaultNominalCodeId: suppliers.defaultNominalCodeId,
      defaultReserveId: suppliers.defaultReserveId,
      defaultProjectId: suppliers.defaultProjectId
    })

  return supplier
}

export async function deleteUploadedFileAction(fileKey: string) {
  if (!fileKey) return

  await utapi.deleteFiles(fileKey)
}
