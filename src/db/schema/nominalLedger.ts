import {
  pgTable, pgEnum, text, timestamp, date, boolean,
  decimal, integer, uniqueIndex, index,
} from "drizzle-orm/pg-core";

import { createId } from "@paralleldrive/cuid2";
import { parishCouncils } from "./authSchema";


export const userRoleEnum = pgEnum("user_role", ["CLERK", "RFO", "COUNCILLOR"]);
export const connectionStatusEnum = pgEnum("connection_status", ["ACTIVE", "EXPIRED", "REVOKED", "ERROR"]);
export const txStatusEnum = pgEnum("tx_status", ["PENDING", "CODED", "POSTED", "EXCLUDED"]);
export const accountTypeEnum = pgEnum("account_type", ["INCOME", "EXPENDITURE", "BALANCE_SHEET"]);
export const journalSourceEnum = pgEnum("journal_source", ["BANK_FEED", "MANUAL", "YEAR_END", "OPENING_BALANCE"]);


export const financialYears = pgTable("financial_years", {
  id:        text("id").$defaultFn(() => createId()).primaryKey(),
  parishCouncilId: text("parish_council_id")
  .notNull()
  .references(() => parishCouncils.id, { onDelete: "cascade" }),
  label:     text("label").notNull(),           // "2024/25"
  startDate: date("start_date").notNull(),       // 1 April
  endDate:   date("end_date").notNull(),         // 31 March
  isClosed:  boolean("is_closed").default(false).notNull(),
  closedAt:  timestamp("closed_at"),
}, (t) => ({
  unq: uniqueIndex("financial_year_council_label_idx").on(
    t.parishCouncilId,
    t.label
  ),
}));

export const nominalCodes = pgTable("nominal_codes", {
  id:              text("id").$defaultFn(() => createId()).primaryKey(),
  parishCouncilId: text("parish_council_id")
  .notNull()
  .references(() => parishCouncils.id, { onDelete: "cascade" }),
  financialYearId: text("financial_year_id").notNull().references(() => financialYears.id),
  code:            text("code").notNull(),       // "4010"
  name:            text("name").notNull(),       // "Grounds maintenance"
  type:            accountTypeEnum("type").notNull(),
  category:        text("category"),             // grouping for I&E report
  isBank:          boolean("is_bank").default(false).notNull(),
  isActive:        boolean("is_active").default(true).notNull(),
}, (t) => ({
  unq: uniqueIndex("nominal_code_council_year_code_idx").on(
  t.parishCouncilId,
  t.financialYearId,
  t.code
),
}));

export const journalEntries = pgTable("journal_entries", {
  id:              text("id").$defaultFn(() => createId()).primaryKey(),
  parishCouncilId: text("parish_council_id")
  .notNull()
  .references(() => parishCouncils.id, { onDelete: "cascade" }),
  financialYearId: text("financial_year_id").notNull().references(() => financialYears.id),
  reference:       text("reference").notNull(),  // "BNK-2025-001"
  date:            date("date").notNull(),
  description:     text("description").notNull(),
  source:          journalSourceEnum("source").default("BANK_FEED").notNull(),
  postedById:      text("posted_by_id"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  dateIdx: index("journal_entry_date_idx").on(t.date),
  yearIdx: index("journal_entry_year_idx").on(t.financialYearId),
}));

export const journalLines = pgTable("journal_lines", {
  id:             text("id").$defaultFn(() => createId()).primaryKey(),
  journalEntryId: text("journal_entry_id").notNull().references(() => journalEntries.id),
  nominalCodeId:  text("nominal_code_id").notNull().references(() => nominalCodes.id),
  debit:          decimal("debit", { precision: 12, scale: 2 }).default("0").notNull(),
  credit:         decimal("credit", { precision: 12, scale: 2 }).default("0").notNull(),
  description:    text("description"),
});

export const budgets = pgTable("budgets", {
  id:              text("id").$defaultFn(() => createId()).primaryKey(),
  parishCouncilId: text("parish_council_id")
  .notNull()
  .references(() => parishCouncils.id, { onDelete: "cascade" }),
  financialYearId: text("financial_year_id").notNull().references(() => financialYears.id),
  nominalCodeId:   text("nominal_code_id").notNull().references(() => nominalCodes.id),
  amount:          decimal("amount", { precision: 12, scale: 2 }).notNull(),
}, (t) => ({
  unq: uniqueIndex("budget_council_year_code_idx").on(
  t.parishCouncilId,
  t.financialYearId,
  t.nominalCodeId
),
}));

export const matchingRules = pgTable("matching_rules", {
  id:              text("id").$defaultFn(() => createId()).primaryKey(),
  parishCouncilId: text("parish_council_id")
  .notNull()
  .references(() => parishCouncils.id, { onDelete: "cascade" }),
  name:            text("name").notNull(),
  matchField:      text("match_field").notNull(),    // "description" | "merchant_name" | "category"
  matchType:       text("match_type").notNull(),     // "contains" | "equals" | "starts_with"
  matchValue:      text("match_value").notNull(),
  nominalCodeCode: text("nominal_code_code").notNull(),
  priority:        integer("priority").default(0).notNull(),
  isActive:        boolean("is_active").default(true).notNull(),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  unq: uniqueIndex("matching_rule_council_name_idx").on(
    t.parishCouncilId,
    t.name
  ),
}));
