import {
  pgTable,
  text,
  timestamp,
  numeric,
  pgEnum,
  uniqueIndex
} from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { parishCouncils } from './authSchema'
import { financialYears } from './nominalLedger'

export const vatReturnStatusEnum = pgEnum('vat_return_status', [
  'DRAFT',
  'SUBMITTED'
])

export const vatReturns = pgTable(
  'vat_returns',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    parishCouncilId: text('parish_council_id')
      .notNull()
      .references(() => parishCouncils.id, { onDelete: 'cascade' }),

    financialYearId: text('financial_year_id')
      .notNull()
      .references(() => financialYears.id, { onDelete: 'cascade' }),

    periodStart: timestamp('period_start', { mode: 'date' }).notNull(),
    periodEnd: timestamp('period_end', { mode: 'date' }).notNull(),

    inputVat: numeric('input_vat', { precision: 12, scale: 2 }).notNull(),
    outputVat: numeric('output_vat', { precision: 12, scale: 2 }).notNull(),
    netVat: numeric('net_vat', { precision: 12, scale: 2 }).notNull(),

    status: vatReturnStatusEnum('status').notNull().default('DRAFT'),

    submittedAt: timestamp('submitted_at', { mode: 'date' }),

    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),

    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow()
  },
  table => [
    uniqueIndex('vat_returns_unique_period').on(
      table.parishCouncilId,
      table.financialYearId,
      table.periodStart,
      table.periodEnd
    )
  ]
)
