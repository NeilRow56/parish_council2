import {
  pgTable,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core'

import { createId } from '@paralleldrive/cuid2'

import { parishCouncils } from './authSchema'
import { nominalCodes } from './nominalLedger'

export const reserves = pgTable(
  'reserves',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),

    parishCouncilId: text('parish_council_id')
      .notNull()
      .references(() => parishCouncils.id, { onDelete: 'cascade' }),

    code: text('code').notNull(),
    name: text('name').notNull(),

    isDefault: boolean('is_default').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  t => [
    uniqueIndex('reserves_parish_code_unique').on(t.parishCouncilId, t.code),
    uniqueIndex('reserves_parish_name_unique').on(t.parishCouncilId, t.name),
    index('reserves_parish_idx').on(t.parishCouncilId)
  ]
)

export const projects = pgTable(
  'projects',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),

    parishCouncilId: text('parish_council_id')
      .notNull()
      .references(() => parishCouncils.id, { onDelete: 'cascade' }),

    reserveId: text('reserve_id')
      .notNull()
      .references(() => reserves.id),

    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),

    isActive: boolean('is_active').default(true).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  t => [
    uniqueIndex('projects_parish_code_unique').on(t.parishCouncilId, t.code),
    uniqueIndex('projects_parish_name_unique').on(t.parishCouncilId, t.name),
    index('projects_parish_idx').on(t.parishCouncilId),
    index('projects_reserve_idx').on(t.reserveId)
  ]
)

export const suppliers = pgTable(
  'suppliers',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),

    parishCouncilId: text('parish_council_id')
      .notNull()
      .references(() => parishCouncils.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    vatNumber: text('vat_number'),

    defaultGoodsSupplied: text('default_goods_supplied'),

    defaultNominalCodeId: text('default_nominal_code_id').references(
      () => nominalCodes.id,
      { onDelete: 'set null' }
    ),

    defaultReserveId: text('default_reserve_id').references(() => reserves.id, {
      onDelete: 'set null'
    }),

    defaultProjectId: text('default_project_id').references(() => projects.id, {
      onDelete: 'set null'
    }),

    isActive: boolean('is_active').default(true).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  t => [
    uniqueIndex('suppliers_parish_name_unique').on(t.parishCouncilId, t.name),
    index('suppliers_parish_idx').on(t.parishCouncilId),
    index('suppliers_default_nominal_idx').on(t.defaultNominalCodeId),
    index('suppliers_default_reserve_idx').on(t.defaultReserveId),
    index('suppliers_default_project_idx').on(t.defaultProjectId)
  ]
)
