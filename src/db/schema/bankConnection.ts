import {
  pgTable, pgEnum, text, timestamp,
  index,
  uniqueIndex
} from "drizzle-orm/pg-core";

import { createId } from "@paralleldrive/cuid2";
import { parishCouncils } from "./authSchema";
import { nominalCodes } from "./nominalLedger";

export const connectionStatusEnum = pgEnum("connection_status", ["ACTIVE", "EXPIRED", "REVOKED", "ERROR"]);

export const bankConnections = pgTable(
  "bank_connections",
  {
    id: text("id").$defaultFn(() => createId()).primaryKey(),

    parishCouncilId: text("parish_council_id")
      .notNull()
      .references(() => parishCouncils.id, { onDelete: "cascade" }),

    providerName: text("provider_name").notNull(), // "truelayer"
    providerId: text("provider_id").notNull(),     // "barclays"
    providerAccountId: text("provider_account_id").notNull(),

    accountName: text("account_name").notNull(),
    accountType: text("account_type").notNull(),

    sortCode: text("sort_code"),
    accountLast4: text("account_last4"),

    nominalCodeId: text("nominal_code_id").references(() => nominalCodes.id),

    currency: text("currency").default("GBP").notNull(),

    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    accessTokenExpiry: timestamp("access_token_expiry").notNull(),

    consentExpiry: timestamp("consent_expiry"),

    lastSyncAt: timestamp("last_sync_at"),

    status: connectionStatusEnum("status")
      .default("ACTIVE")
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    parishIdx: index("bank_connections_parish_idx").on(
      table.parishCouncilId
    ),

    providerAccountUnique: uniqueIndex(
      "bank_connections_provider_account_unique"
    ).on(table.providerName, table.providerAccountId),
  })
);
