import {
  pgTable, pgEnum, text, timestamp
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { parishCouncils } from "./authSchema";

export const connectionStatusEnum = pgEnum("connection_status", ["ACTIVE", "EXPIRED", "REVOKED", "ERROR"]);

export const bankConnections = pgTable("bank_connections", {
  id:                text("id").$defaultFn(() => createId()).primaryKey(),
  parishCouncilId: text("parish_council_id")
  .notNull()
  .references(() => parishCouncils.id, { onDelete: "cascade" }),
  providerName:      text("provider_name").notNull(),
  providerId:        text("provider_id").notNull(),
  accountId:         text("account_id").notNull().unique(),
  accountName:       text("account_name").notNull(),
  accountType:       text("account_type").notNull(),
  sortCode:          text("sort_code"),
  accountNumber:     text("account_number"),
  currency:          text("currency").default("GBP").notNull(),
  accessToken:       text("access_token").notNull(),
  refreshToken:      text("refresh_token").notNull(),
  accessTokenExpiry: timestamp("access_token_expiry").notNull(),
  consentExpiry:     timestamp("consent_expiry"),
  lastSyncAt:        timestamp("last_sync_at"),
  status:            connectionStatusEnum("status").default("ACTIVE").notNull(),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
  updatedAt:         timestamp("updated_at").defaultNow().notNull(),
});
