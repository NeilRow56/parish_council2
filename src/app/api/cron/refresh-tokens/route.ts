import { NextRequest, NextResponse } from "next/server";
import { addDays } from "date-fns";
import { eq, and, lte, inArray } from "drizzle-orm";

import { db } from "@/db";
import { bankConnections } from "@/db/schema/bankConnection";
import { refreshAccessToken } from "@/lib/truelayer/client";

// Called by Vercel Cron every 6 hours
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const expiryCutoff = addDays(new Date(), 0.5);

  const expiringSoon = await db
    .select()
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.status, "ACTIVE"),
        lte(bankConnections.accessTokenExpiry, expiryCutoff)
      )
    );

  const results = await Promise.allSettled(
    expiringSoon.map((connection) => refreshAccessToken(connection))
  );

  const failedIds = results
    .map((result, index) => ({
      id: expiringSoon[index].id,
      result,
    }))
    .filter((item) => item.result.status === "rejected")
    .map((item) => item.id);

  if (failedIds.length > 0) {
    await db
      .update(bankConnections)
      .set({
        status: "ERROR",
        updatedAt: new Date(),
      })
      .where(inArray(bankConnections.id, failedIds));
  }

  return NextResponse.json({
    checked: expiringSoon.length,
    refreshed: results.filter((result) => result.status === "fulfilled").length,
    failed: failedIds.length,
  });
}
