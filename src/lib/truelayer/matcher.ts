import { eq, and, lte, gte, desc } from 'drizzle-orm'
import type { TrueLayerTransaction } from './types'
import {
  financialYears,
  matchingRules,
  nominalCodes
} from '@/db/schema/nominalLedger'
import { db } from '@/db'

export interface MatchResult {
  nominalCodeId: string
  nominalCode: string
  nominalName: string
  ruleName: string
  ruleId: string
}

type MatchingRule = typeof matchingRules.$inferSelect

export async function applyMatchingRules(
  tx: TrueLayerTransaction,
  parishCouncilId: string,
  financialYearId?: string
): Promise<MatchResult | null> {
  const yearId =
    financialYearId ?? (await getCurrentFinancialYearId(parishCouncilId))

  if (!yearId) return null

  const rules = await db
    .select()
    .from(matchingRules)
    .where(
      and(
        eq(matchingRules.parishCouncilId, parishCouncilId),
        eq(matchingRules.isActive, true)
      )
    )
    .orderBy(desc(matchingRules.priority))

  for (const rule of rules) {
    if (ruleMatches(rule, tx)) {
      const nominalCode = await resolveNominalCode(
        rule.nominalCodeCode,
        parishCouncilId,
        yearId
      )

      if (nominalCode) {
        return {
          nominalCodeId: nominalCode.id,
          nominalCode: nominalCode.code,
          nominalName: nominalCode.name,
          ruleName: rule.name,
          ruleId: rule.id
        }
      }
    }
  }

  return null
}

export async function applyMatchingRulesBatch(
  transactions: TrueLayerTransaction[],
  parishCouncilId: string,
  financialYearId?: string
): Promise<Map<string, MatchResult>> {
  const results = new Map<string, MatchResult>()

  if (transactions.length === 0) return results

  const yearId =
    financialYearId ?? (await getCurrentFinancialYearId(parishCouncilId))

  if (!yearId) return results

  const rules = await db
    .select()
    .from(matchingRules)
    .where(
      and(
        eq(matchingRules.parishCouncilId, parishCouncilId),
        eq(matchingRules.isActive, true)
      )
    )
    .orderBy(desc(matchingRules.priority))

  if (rules.length === 0) return results

  const codes = await db
    .select()
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, yearId),
        eq(nominalCodes.isActive, true)
      )
    )

  const codesByCode = new Map(codes.map(code => [code.code, code]))

  for (const tx of transactions) {
    const txKey = tx.normalised_provider_transaction_id ?? tx.transaction_id

    for (const rule of rules) {
      if (!ruleMatches(rule, tx)) continue

      const nominalCode = codesByCode.get(rule.nominalCodeCode)

      if (nominalCode) {
        results.set(txKey, {
          nominalCodeId: nominalCode.id,
          nominalCode: nominalCode.code,
          nominalName: nominalCode.name,
          ruleName: rule.name,
          ruleId: rule.id
        })

        break
      }
    }
  }

  return results
}

export async function testRule(
  rule: Pick<MatchingRule, 'matchField' | 'matchType' | 'matchValue'>,
  tx: TrueLayerTransaction
): Promise<boolean> {
  return ruleMatches(rule as MatchingRule, tx)
}

function ruleMatches(rule: MatchingRule, tx: TrueLayerTransaction): boolean {
  if (rule.matchType === 'amount_gt' || rule.matchType === 'amount_lt') {
    const threshold = parseFloat(rule.matchValue)

    if (Number.isNaN(threshold)) return false

    const absAmount = Math.abs(tx.amount)

    return rule.matchType === 'amount_gt'
      ? absAmount > threshold
      : absAmount < threshold
  }

  const fieldValue = getTxField(tx, rule.matchField)

  if (fieldValue === undefined || fieldValue === null) return false

  const haystack = fieldValue.toLowerCase().trim()
  const needle = rule.matchValue.toLowerCase().trim()

  switch (rule.matchType) {
    case 'contains':
      return haystack.includes(needle)

    case 'equals':
      return haystack === needle

    case 'starts_with':
      return haystack.startsWith(needle)

    case 'ends_with':
      return haystack.endsWith(needle)

    case 'regex': {
      try {
        return new RegExp(rule.matchValue, 'i').test(fieldValue)
      } catch {
        console.warn(
          `[Matcher] Invalid regex in rule "${rule.name}": ${rule.matchValue}`
        )
        return false
      }
    }

    default:
      console.warn(
        `[Matcher] Unknown match type "${rule.matchType}" in rule "${rule.name}"`
      )
      return false
  }
}

function getTxField(
  tx: TrueLayerTransaction,
  field: string
): string | undefined {
  switch (field) {
    case 'description':
      return tx.description

    case 'merchant_name':
      return tx.merchant_name

    case 'category':
      return tx.transaction_category

    case 'transaction_type':
      return tx.transaction_type

    default:
      console.warn(`[Matcher] Unknown match field "${field}"`)
      return undefined
  }
}

async function resolveNominalCode(
  code: string,
  parishCouncilId: string,
  financialYearId: string
): Promise<typeof nominalCodes.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.financialYearId, financialYearId),
        eq(nominalCodes.code, code),
        eq(nominalCodes.isActive, true)
      )
    )
    .limit(1)

  return row ?? null
}

async function getCurrentFinancialYearId(
  parishCouncilId: string
): Promise<string | null> {
  const today = new Date().toISOString().split('T')[0]

  const [year] = await db
    .select({ id: financialYears.id })
    .from(financialYears)
    .where(
      and(
        eq(financialYears.parishCouncilId, parishCouncilId),
        lte(financialYears.startDate, today),
        gte(financialYears.endDate, today),
        eq(financialYears.isClosed, false)
      )
    )
    .limit(1)

  return year?.id ?? null
}
