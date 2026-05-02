// src/db/schema/bankOpeningBalances.ts

import {
  pgTable,
  text,
  numeric,
  timestamp,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'

import { parishCouncils } from './authSchema'
import { financialYears } from './nominalLedger'
import { bankConnections } from './bankConnection'
import { nominalCodes } from './nominalLedger'

export const bankOpeningBalances = pgTable(
  'bank_opening_balances',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),

    parishCouncilId: text('parish_council_id')
      .notNull()
      .references(() => parishCouncils.id, { onDelete: 'cascade' }),

    financialYearId: text('financial_year_id')
      .notNull()
      .references(() => financialYears.id, { onDelete: 'cascade' }),

    connectionId: text('connection_id')
      .notNull()
      .references(() => bankConnections.id, { onDelete: 'cascade' }),

    nominalCodeId: text('nominal_code_id')
      .notNull()
      .references(() => nominalCodes.id),

    openingBalance: numeric('opening_balance', {
      precision: 14,
      scale: 2
    })
      .default('0.00')
      .notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  table => [
    index('bank_opening_balances_parish_idx').on(table.parishCouncilId),

    uniqueIndex('bank_opening_balances_connection_year_unique').on(
      table.connectionId,
      table.financialYearId
    )
  ]
)
