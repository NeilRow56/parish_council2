import { relations } from 'drizzle-orm'

import { parishCouncils, user } from './authSchema'
import { bankConnections } from './bankConnection'
import { bankTransactions } from './bankTransactions'
import {
  budgets,
  financialYears,
  journalEntries,
  journalLines,
  nominalCodes,
  matchingRules
} from './nominalLedger'
import { bankOpeningBalances } from './bankOpeningBalances'

export const parishCouncilsRelations = relations(
  parishCouncils,
  ({ many }) => ({
    users: many(user),
    financialYears: many(financialYears),
    nominalCodes: many(nominalCodes),
    journalEntries: many(journalEntries),
    budgets: many(budgets),
    matchingRules: many(matchingRules),
    bankConnections: many(bankConnections),
    bankTransactions: many(bankTransactions),
    bankOpeningBalances: many(bankOpeningBalances)
  })
)

export const usersRelations = relations(user, ({ one }) => ({
  parishCouncil: one(parishCouncils, {
    fields: [user.parishCouncilId],
    references: [parishCouncils.id]
  })
}))

export const bankConnectionsRelations = relations(
  bankConnections,
  ({ one, many }) => ({
    parishCouncil: one(parishCouncils, {
      fields: [bankConnections.parishCouncilId],
      references: [parishCouncils.id]
    }),

    nominalCode: one(nominalCodes, {
      fields: [bankConnections.nominalCodeId],
      references: [nominalCodes.id]
    }),

    transactions: many(bankTransactions),
    bankOpeningBalances: many(bankOpeningBalances)
  })
)

export const bankTransactionsRelations = relations(
  bankTransactions,
  ({ one }) => ({
    parishCouncil: one(parishCouncils, {
      fields: [bankTransactions.parishCouncilId],
      references: [parishCouncils.id]
    }),
    connection: one(bankConnections, {
      fields: [bankTransactions.connectionId],
      references: [bankConnections.id]
    }),
    nominalCode: one(nominalCodes, {
      fields: [bankTransactions.nominalCodeId],
      references: [nominalCodes.id]
    }),
    journalEntry: one(journalEntries, {
      fields: [bankTransactions.journalEntryId],
      references: [journalEntries.id]
    })
  })
)

export const financialYearsRelations = relations(
  financialYears,
  ({ one, many }) => ({
    parishCouncil: one(parishCouncils, {
      fields: [financialYears.parishCouncilId],
      references: [parishCouncils.id]
    }),
    nominalCodes: many(nominalCodes),
    journalEntries: many(journalEntries),
    bankOpeningBalances: many(bankOpeningBalances),
    budgets: many(budgets)
  })
)

export const nominalCodesRelations = relations(
  nominalCodes,
  ({ one, many }) => ({
    parishCouncil: one(parishCouncils, {
      fields: [nominalCodes.parishCouncilId],
      references: [parishCouncils.id]
    }),
    financialYear: one(financialYears, {
      fields: [nominalCodes.financialYearId],
      references: [financialYears.id]
    }),
    journalLines: many(journalLines),
    bankTransactions: many(bankTransactions),
    bankConnections: many(bankConnections),
    bankOpeningBalances: many(bankOpeningBalances),
    budgets: many(budgets)
  })
)

export const bankOpeningBalancesRelations = relations(
  bankOpeningBalances,
  ({ one }) => ({
    parishCouncil: one(parishCouncils, {
      fields: [bankOpeningBalances.parishCouncilId],
      references: [parishCouncils.id]
    }),

    financialYear: one(financialYears, {
      fields: [bankOpeningBalances.financialYearId],
      references: [financialYears.id]
    }),

    bankConnection: one(bankConnections, {
      fields: [bankOpeningBalances.connectionId],
      references: [bankConnections.id]
    }),

    nominalCode: one(nominalCodes, {
      fields: [bankOpeningBalances.nominalCodeId],
      references: [nominalCodes.id]
    })
  })
)

export const journalEntriesRelations = relations(
  journalEntries,
  ({ one, many }) => ({
    parishCouncil: one(parishCouncils, {
      fields: [journalEntries.parishCouncilId],
      references: [parishCouncils.id]
    }),
    financialYear: one(financialYears, {
      fields: [journalEntries.financialYearId],
      references: [financialYears.id]
    }),
    lines: many(journalLines),
    bankTransactions: many(bankTransactions)
  })
)

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalLines.journalEntryId],
    references: [journalEntries.id]
  }),
  nominalCode: one(nominalCodes, {
    fields: [journalLines.nominalCodeId],
    references: [nominalCodes.id]
  })
}))

export const budgetsRelations = relations(budgets, ({ one }) => ({
  parishCouncil: one(parishCouncils, {
    fields: [budgets.parishCouncilId],
    references: [parishCouncils.id]
  }),
  financialYear: one(financialYears, {
    fields: [budgets.financialYearId],
    references: [financialYears.id]
  }),
  nominalCode: one(nominalCodes, {
    fields: [budgets.nominalCodeId],
    references: [nominalCodes.id]
  })
}))

export const matchingRulesRelations = relations(matchingRules, ({ one }) => ({
  parishCouncil: one(parishCouncils, {
    fields: [matchingRules.parishCouncilId],
    references: [parishCouncils.id]
  })
}))
