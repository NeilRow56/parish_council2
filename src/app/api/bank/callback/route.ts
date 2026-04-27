import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, fetchAccounts } from "@/lib/truelayer/client";

import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { bankConnections } from "@/db/schema/bankConnection";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/bank-connections?error=${error ?? "no_code"}`, request.url)
    );
  }

  // ── Auth + tenant ───────────────────────────────────────────────
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.redirect(
      new URL("/bank-connections?error=unauthorised", request.url)
    );
  }

  const parishCouncilId = session.user.parishCouncilId;

  if (!parishCouncilId) {
    return NextResponse.redirect(
      new URL("/bank-connections?error=no_parish", request.url)
    );
  }

  try {
    // ── Exchange code ─────────────────────────────────────────────
    const tokens = await exchangeCode(code);
    const accessTokenExpiry = new Date(
      Date.now() + tokens.expires_in * 1000
    );

    const tempConnection = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiry,
    } as Parameters<typeof fetchAccounts>[0];

    const accounts = await fetchAccounts(tempConnection);

    if (!accounts.length) {
      return NextResponse.redirect(
        new URL("/bank-connections?error=no_accounts", request.url)
      );
    }

    // ── Persist accounts (tenant-scoped) ──────────────────────────
    for (const account of accounts) {
      const existing = await db
        .select({ id: bankConnections.id })
        .from(bankConnections)
        .where(
          and(
            eq(bankConnections.parishCouncilId, parishCouncilId),
            eq(bankConnections.providerAccountId, account.account_id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing connection
        await db
          .update(bankConnections)
          .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            accessTokenExpiry,
            status: "ACTIVE",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(bankConnections.parishCouncilId, parishCouncilId),
              eq(bankConnections.providerAccountId, account.account_id)
            )
          );
      } else {
        // Insert new connection
        await db.insert(bankConnections).values({
  parishCouncilId,

  providerId: account.provider.provider_id,
  providerName: "truelayer",

  providerAccountId: account.account_id,
  accountName: account.display_name,
  accountType: account.account_type,

  sortCode: account.account_number?.sort_code ?? null,
  accountLast4: account.account_number?.number?.slice(-4) ?? null,

  currency: account.currency,

  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  accessTokenExpiry,
  status: "ACTIVE",

  createdAt: new Date(),
  updatedAt: new Date(),
});
      }
    }

    return NextResponse.redirect(
      new URL("/bank-connections?success=1", request.url)
    );
  } catch (err) {
    console.error("[TrueLayer] Callback error:", err);

    return NextResponse.redirect(
      new URL("/bank-connections?error=exchange_failed", request.url)
    );
  }
}
