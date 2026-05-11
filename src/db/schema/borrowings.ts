import {
  pgTable,
  text,
  timestamp,
  date,
  boolean,
  numeric
} from 'drizzle-orm/pg-core'
import { createId } from '@paralleldrive/cuid2'
import { parishCouncils } from './authSchema'
import { financialYears, nominalCodes } from './nominalLedger'

export const borrowings = pgTable('borrowings', {
  id: text('id')
    .$defaultFn(() => createId())
    .primaryKey(),

  parishCouncilId: text('parish_council_id')
    .notNull()
    .references(() => parishCouncils.id, { onDelete: 'cascade' }),

  financialYearId: text('financial_year_id')
    .notNull()
    .references(() => financialYears.id, { onDelete: 'cascade' }),

  lender: text('lender').notNull(),
  reference: text('reference'),
  purpose: text('purpose'),

  startDate: date('start_date'),
  originalAmount: numeric('original_amount', { precision: 12, scale: 2 }),
  openingBalance: numeric('opening_balance', { precision: 12, scale: 2 })
    .notNull()
    .default('0'),

  interestRate: numeric('interest_rate', { precision: 6, scale: 3 }),
  repaymentFrequency: text('repayment_frequency'),

  nominalCodeId: text('nominal_code_id').references(() => nominalCodes.id),

  notes: text('notes'),

  isActive: boolean('is_active').notNull().default(true),
  closedDate: date('closed_date'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})
