import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshAccessToken } from "@/lib/truelayer/client";
import { addDays } from "date-fns";

// Called by Vercel Cron every 6 hours (set in vercel.json)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Find tokens expiring in the next 12 hours
  const expiringSoon = await prisma.bankConnection.findMany({
    where: {
      status: "ACTIVE",
      accessTokenExpiry: { lte: addDays(new Date(), 0.5) },
    },
  });

  const results = await Promise.allSettled(
    expiringSoon.map((c) => refreshAccessToken(c))
  );

  const failed = results
    .map((r, i) => ({ id: expiringSoon[i].id, result: r }))
    .filter((r) => r.result.status === "rejected");

  // Mark failed connections
  if (failed.length > 0) {
    await prisma.bankConnection.updateMany({
      where: { id: { in: failed.map((f) => f.id) } },
      data: { status: "ERROR" },
    });
  }

  return NextResponse.json({
    refreshed: results.filter((r) => r.status === "fulfilled").length,
    failed: failed.length,
  });
}
