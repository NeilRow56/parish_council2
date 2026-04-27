// src/app/api/bank/callback/route.ts

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { bankConnections } from "@/db/schema/bankConnection";

import type {
  TrueLayerAccount,
  TrueLayerTokenResponse,
} from "@/lib/truelayer/types";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("TrueLayer callback error:", error);

      return NextResponse.redirect(
        new URL("/bank-connections?error=truelayer", req.url)
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: "Missing TrueLayer authorisation code" },
        { status: 400 }
      );
    }

    const session = await auth.api.getSession({
      headers: req.headers,
    });

    const parishCouncilId = session?.user?.parishCouncilId;

    if (!parishCouncilId) {
      return NextResponse.json(
        { error: "Missing parish council session" },
        { status: 401 }
      );
    }

    const clientId = process.env.TRUELAYER_CLIENT_ID;
    const clientSecret = process.env.TRUELAYER_CLIENT_SECRET;
    const redirectUri = process.env.TRUELAYER_REDIRECT_URI;

    const authBaseUrl =
      process.env.TRUELAYER_AUTH_URL ?? "https://auth.truelayer-sandbox.com";

    const apiBaseUrl =
      process.env.TRUELAYER_API_URL ?? "https://api.truelayer-sandbox.com";

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: "Missing TrueLayer environment variables" },
        { status: 500 }
      );
    }

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });

    const tokenRes = await fetch(`${authBaseUrl}/connect/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody,
      cache: "no-store",
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();

      console.error("TrueLayer token exchange failed:", {
        status: tokenRes.status,
        body,
      });

      return NextResponse.json(
        {
          error: "TrueLayer token exchange failed",
          status: tokenRes.status,
          body,
        },
        { status: 502 }
      );
    }

    const tokens = (await tokenRes.json()) as TrueLayerTokenResponse;

    const accessTokenExpiry = new Date(
      Date.now() + tokens.expires_in * 1000
    );

    const accountsRes = await fetch(`${apiBaseUrl}/data/v1/accounts`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
      cache: "no-store",
    });

    if (!accountsRes.ok) {
      const body = await accountsRes.text();

      console.error("TrueLayer accounts fetch failed:", {
        status: accountsRes.status,
        body,
      });

      return NextResponse.json(
        {
          error: "TrueLayer accounts fetch failed",
          status: accountsRes.status,
          body,
        },
        { status: 502 }
      );
    }

    const accountsJson = (await accountsRes.json()) as {
      results: TrueLayerAccount[];
    };

    const accounts = accountsJson.results ?? [];

    for (const account of accounts) {
      const existing = await db.query.bankConnections.findFirst({
        where: and(
          eq(bankConnections.providerName, "truelayer"),
          eq(bankConnections.providerAccountId, account.account_id)
        ),
      });

      const values = {
        parishCouncilId,

        providerName: "truelayer",
        providerId: account.provider.provider_id,
        providerAccountId: account.account_id,

        accountName: account.display_name,
        accountType: account.account_type,
        sortCode: account.account_number?.sort_code ?? null,
        accountLast4: account.account_number?.number?.slice(-4) ?? null,
        currency: account.currency ?? "GBP",

        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiry,

        status: "ACTIVE" as const,
        updatedAt: new Date(),
      };

      if (existing) {
        await db
          .update(bankConnections)
          .set(values)
          .where(eq(bankConnections.id, existing.id));
      } else {
        await db.insert(bankConnections).values({
          ...values,
          createdAt: new Date(),
        });
      }
    }

    return NextResponse.redirect(
      new URL("/bank-connections?connected=1", req.url)
    );
  } catch (err) {
    console.error("TrueLayer callback failed:", err);

    return NextResponse.json(
      { error: "TrueLayer callback failed" },
      { status: 500 }
    );
  }
}
