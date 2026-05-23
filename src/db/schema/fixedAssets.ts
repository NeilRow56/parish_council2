// src/db/schema/fixedAssets.ts

import {
  boolean,
  date,
  decimal,
  index,
  pgTable,
  text,
  timestamp
} from 'drizzle-orm/pg-core'

import { createId } from '@paralleldrive/cuid2'
import { parishCouncils } from './authSchema'
import { financialYears, nominalCodes } from './nominalLedger'

export const fixedAssets = pgTable(
  'fixed_assets',
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

    nominalCodeId: text('nominal_code_id').references(() => nominalCodes.id),

    refNo: text('ref_no'),
    category: text('category').notNull(),
    description: text('description').notNull(),
    location: text('location'),
    insuranceCategory: text('insurance_category'),
    dateAcquired: date('date_acquired'),

    purchaseCost: decimal('purchase_cost', {
      precision: 12,
      scale: 2
    }),

    assetRegisterValue: decimal('asset_register_value', {
      precision: 12,
      scale: 2
    }).notNull(),

    assetOrigin: text('asset_origin')
      .$type<'opening_balance' | 'live'>()
      .default('opening_balance')
      .notNull(),

    notes: text('notes'),

    isDisposed: boolean('is_disposed').default(false).notNull(),
    disposalDate: date('disposal_date'),
    disposalNotes: text('disposal_notes'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  t => [
    index('fixed_assets_parish_year_idx').on(
      t.parishCouncilId,
      t.financialYearId
    ),

    index('fixed_assets_parish_category_idx').on(t.parishCouncilId, t.category),

    index('fixed_assets_nominal_code_idx').on(t.nominalCodeId)
  ]
)
