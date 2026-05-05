// src/db/schema/vatRate.ts

import {
  pgTable,
  text,
  decimal,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core'

import { createId } from '@paralleldrive/cuid2'
import { parishCouncils } from './authSchema'

export const vatRates = pgTable(
  'vat_rates',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),

    parishCouncilId: text('parish_council_id')
      .notNull()
      .references(() => parishCouncils.id, { onDelete: 'cascade' }),

    code: text('code').notNull(),

    name: text('name').notNull(),

    ratePercent: decimal('rate_percent', {
      precision: 5,
      scale: 2
    }).notNull(),

    isActive: boolean('is_active').default(true).notNull(),

    isSystem: boolean('is_system').default(false).notNull(),

    sortOrder: integer('sort_order').default(0).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),

    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  t => [
    uniqueIndex('vat_rates_parish_code_unique').on(t.parishCouncilId, t.code),

    index('vat_rates_parish_active_idx').on(t.parishCouncilId, t.isActive)
  ]
)
