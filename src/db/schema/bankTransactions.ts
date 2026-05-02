import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  date,
  decimal,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core'

import { createId } from '@paralleldrive/cuid2'
import { bankConnections } from './bankConnection'
import { journalEntries, nominalCodes } from './nominalLedger'
import { parishCouncils } from './authSchema'

export const txStatusEnum = pgEnum('tx_status', [
  'PENDING',
  'CODED',
  'POSTED',
  'MATCHED',
  'EXCLUDED'
])

export const vatRateEnum = pgEnum('vat_rate', [
  'NO_VAT',
  'ZERO',
  'STANDARD_20',
  'REDUCED_5'
])

export const vatTreatmentEnum = pgEnum('vat_treatment', [
  'RECOVERABLE',
  'IRRECOVERABLE',
  'OUTSIDE_SCOPE'
])

export const bankTransactions = pgTable(
  'bank_transactions',
  {
    id: text('id')
      .$defaultFn(() => createId())
      .primaryKey(),

    connectionId: text('connection_id')
      .notNull()
      .references(() => bankConnections.id, { onDelete: 'cascade' }),

    parishCouncilId: text('parish_council_id')
      .notNull()
      .references(() => parishCouncils.id, { onDelete: 'cascade' }),

    providerTxId: text('provider_tx_id').notNull(),

    date: date('date').notNull(),
    description: text('description').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').default('GBP').notNull(),

    merchantName: text('merchant_name'),
    category: text('category'),
    transactionType: text('transaction_type'),

    status: txStatusEnum('status').default('PENDING').notNull(),

    nominalCodeId: text('nominal_code_id').references(() => nominalCodes.id),
    matchingRule: text('matching_rule'),

    vatRate: vatRateEnum('vat_rate').default('NO_VAT').notNull(),

    vatTreatment: vatTreatmentEnum('vat_treatment')
      .default('OUTSIDE_SCOPE')
      .notNull(),

    netAmount: decimal('net_amount', { precision: 12, scale: 2 }),
    vatAmount: decimal('vat_amount', { precision: 12, scale: 2 }),
    grossAmount: decimal('gross_amount', { precision: 12, scale: 2 }),

    notes: text('notes'),

    journalEntryId: text('journal_entry_id').references(
      () => journalEntries.id
    ),

    matchedJournalEntryId: text('matched_journal_entry_id').references(
      () => journalEntries.id
    ),

    importedAt: timestamp('imported_at').defaultNow().notNull(),
    postedAt: timestamp('posted_at'),
    matchedAt: timestamp('matched_at')
  },
  t => [
    uniqueIndex('bank_tx_connection_provider_tx_unique').on(
      t.connectionId,
      t.providerTxId
    ),

    index('bank_tx_parish_status_idx').on(t.parishCouncilId, t.status),

    index('bank_tx_parish_date_idx').on(t.parishCouncilId, t.date),

    index('bank_tx_connection_idx').on(t.connectionId)
  ]
)
