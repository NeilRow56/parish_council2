import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  date,
  boolean,
  decimal,
  integer,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

import { createId } from "@paralleldrive/cuid2";
import { parishCouncils } from "./authSchema";

export const userRoleEnum = pgEnum("user_role", [
  "CLERK",
  "RFO",
  "COUNCILLOR",
]);

export const accountTypeEnum = pgEnum("account_type", [
  "INCOME",
  "EXPENDITURE",
  "BALANCE_SHEET",
]);

export const journalSourceEnum = pgEnum("journal_source", [
  "BANK_FEED",
  "MANUAL",
  "YEAR_END",
  "OPENING_BALANCE",
]);

export const financialYears = pgTable(
  "financial_years",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),

    parishCouncilId: text("parish_council_id")
      .notNull()
      .references(() => parishCouncils.id, { onDelete: "cascade" }),

    label: text("label").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),

    isClosed: boolean("is_closed").default(false).notNull(),
    closedAt: timestamp("closed_at"),
  },
  (t) => ({
    unq: uniqueIndex("financial_year_council_label_idx").on(
      t.parishCouncilId,
      t.label
    ),
    parishIdx: index("financial_year_parish_idx").on(t.parishCouncilId),
  })
);

export const nominalCodes = pgTable(
  "nominal_codes",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),

    parishCouncilId: text("parish_council_id")
      .notNull()
      .references(() => parishCouncils.id, { onDelete: "cascade" }),

    financialYearId: text("financial_year_id")
      .notNull()
      .references(() => financialYears.id, { onDelete: "cascade" }),

    code: text("code").notNull(),
    name: text("name").notNull(),

    type: accountTypeEnum("type").notNull(),
    category: text("category"),

    isBank: boolean("is_bank").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (t) => ({
    unq: uniqueIndex("nominal_code_council_year_code_idx").on(
      t.parishCouncilId,
      t.financialYearId,
      t.code
    ),
    parishYearIdx: index("nominal_code_parish_year_idx").on(
      t.parishCouncilId,
      t.financialYearId
    ),
    bankIdx: index("nominal_code_bank_idx").on(
      t.parishCouncilId,
      t.financialYearId,
      t.isBank
    ),
  })
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),

    parishCouncilId: text("parish_council_id")
      .notNull()
      .references(() => parishCouncils.id, { onDelete: "cascade" }),

    financialYearId: text("financial_year_id")
      .notNull()
      .references(() => financialYears.id, { onDelete: "cascade" }),

    reference: text("reference").notNull(),

    date: date("date").notNull(),
    description: text("description").notNull(),

    source: journalSourceEnum("source").default("BANK_FEED").notNull(),

    // For BANK_FEED this should store bank_transactions.id.
    // This helps prevent duplicate posting.
    sourceId: text("source_id"),

    postedById: text("posted_by_id"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    referenceUnq: uniqueIndex("journal_entry_reference_idx").on(
      t.parishCouncilId,
      t.financialYearId,
      t.reference
    ),

    sourceUnq: uniqueIndex("journal_entry_source_idx").on(
      t.parishCouncilId,
      t.source,
      t.sourceId
    ),

    dateIdx: index("journal_entry_date_idx").on(t.date),

    parishYearIdx: index("journal_entry_parish_year_idx").on(
      t.parishCouncilId,
      t.financialYearId
    ),
  })
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),

    parishCouncilId: text("parish_council_id")
      .notNull()
      .references(() => parishCouncils.id, { onDelete: "cascade" }),

    journalEntryId: text("journal_entry_id")
      .notNull()
      .references(() => journalEntries.id, { onDelete: "cascade" }),

    nominalCodeId: text("nominal_code_id")
      .notNull()
      .references(() => nominalCodes.id),

    debit: decimal("debit", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),

    credit: decimal("credit", { precision: 12, scale: 2 })
      .default("0.00")
      .notNull(),

    description: text("description"),
  },
  (t) => ({
    entryIdx: index("journal_line_entry_idx").on(t.journalEntryId),
    nominalIdx: index("journal_line_nominal_idx").on(t.nominalCodeId),
    parishIdx: index("journal_line_parish_idx").on(t.parishCouncilId),
  })
);

export const budgets = pgTable(
  "budgets",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),

    parishCouncilId: text("parish_council_id")
      .notNull()
      .references(() => parishCouncils.id, { onDelete: "cascade" }),

    financialYearId: text("financial_year_id")
      .notNull()
      .references(() => financialYears.id, { onDelete: "cascade" }),

    nominalCodeId: text("nominal_code_id")
      .notNull()
      .references(() => nominalCodes.id, { onDelete: "cascade" }),

    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    unq: uniqueIndex("budget_council_year_code_idx").on(
      t.parishCouncilId,
      t.financialYearId,
      t.nominalCodeId
    ),
  })
);

export const matchingRules = pgTable(
  "matching_rules",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),

    parishCouncilId: text("parish_council_id")
      .notNull()
      .references(() => parishCouncils.id, { onDelete: "cascade" }),

    name: text("name").notNull(),

    matchField: text("match_field").notNull(),
    matchType: text("match_type").notNull(),
    matchValue: text("match_value").notNull(),

    nominalCodeCode: text("nominal_code_code").notNull(),

    priority: integer("priority").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    unq: uniqueIndex("matching_rule_council_name_idx").on(
      t.parishCouncilId,
      t.name
    ),
    parishIdx: index("matching_rule_parish_idx").on(t.parishCouncilId),
  })
);
