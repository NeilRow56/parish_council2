import { db } from "@/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  // ── Database ──────────────────────────────────────────────────────────────
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  // ── Email + password ──────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },

  // ── Session ───────────────────────────────────────────────────────────────
  session: {
    // 8-hour working-day session
    expiresIn: 60 * 60 * 8,

    // Refresh session once per hour while active
    updateAge: 60 * 60,
  },

  // ── Custom user fields ────────────────────────────────────────────────────
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "CLERK",
        input: false,
      },

      parishCouncilId: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },

  // ── Trusted origins ───────────────────────────────────────────────────────
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  ],
});

export type Auth = typeof auth;
