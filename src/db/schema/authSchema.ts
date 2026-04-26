import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Tenant table
 *
 * Each parish council is one tenant.
 * All accounting, bank-feed, period, user, and report data should ultimately
 * be scoped to this table.
 */
export const parishCouncils = pgTable("parish_councils", {
  id: text("id").primaryKey(),

  name: text("name").notNull(),

  createdAt: timestamp("created_at", { mode: "date" })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull(),
});

/**
 * Better Auth user table
 *
 * Better Auth expects the core user fields to exist.
 * We add role and parishCouncilId as custom fields.
 */
export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),

    name: text("name").notNull(),

    email: text("email").notNull().unique(),

    emailVerified: boolean("email_verified")
      .default(false)
      .notNull(),

    image: text("image"),

    role: text("role").notNull().default("CLERK"),

    parishCouncilId: text("parish_council_id").references(
      () => parishCouncils.id,
      { onDelete: "restrict" }
    ),

    createdAt: timestamp("created_at", { mode: "date" })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_email_idx").on(table.email),
  ]
);

/**
 * Better Auth session table
 */
export const session = pgTable("session", {
  id: text("id").primaryKey(),

  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),

  token: text("token").notNull().unique(),

  createdAt: timestamp("created_at", { mode: "date" })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull(),

  ipAddress: text("ip_address"),

  userAgent: text("user_agent"),

  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

/**
 * Better Auth account table
 */
export const account = pgTable("account", {
  id: text("id").primaryKey(),

  accountId: text("account_id").notNull(),

  providerId: text("provider_id").notNull(),

  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  accessToken: text("access_token"),

  refreshToken: text("refresh_token"),

  idToken: text("id_token"),

  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    mode: "date",
  }),

  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    mode: "date",
  }),

  scope: text("scope"),

  password: text("password"),

  createdAt: timestamp("created_at", { mode: "date" })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull(),
});

/**
 * Better Auth verification table
 */
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),

  identifier: text("identifier").notNull(),

  value: text("value").notNull(),

  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),

  createdAt: timestamp("created_at", { mode: "date" })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull(),
});
