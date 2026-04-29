import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { bankConnections } from "@/db/schema/bankConnection";
import { nominalCodes } from "@/db/schema/nominalLedger";

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.parishCouncilId) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const parishCouncilId = session.user.parishCouncilId;

  const formData = await request.formData();
  const connectionId = String(formData.get("connectionId") ?? "");
  const nominalCodeId = String(formData.get("nominalCodeId") ?? "");

  if (!connectionId || !nominalCodeId) {
    return NextResponse.json(
      { error: "Missing connectionId or nominalCodeId" },
      { status: 400 }
    );
  }

  const [code] = await db
    .select({ id: nominalCodes.id })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.id, nominalCodeId),
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.isBank, true),
        eq(nominalCodes.isActive, true)
      )
    )
    .limit(1);

  if (!code) {
    return NextResponse.json(
      { error: "Bank nominal code not found" },
      { status: 404 }
    );
  }

  await db
    .update(bankConnections)
    .set({
      nominalCodeId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bankConnections.id, connectionId),
        eq(bankConnections.parishCouncilId, parishCouncilId)
      )
    );

  return NextResponse.redirect(new URL("/bank-connections", request.url));
}
