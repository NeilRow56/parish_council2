import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bankTransactions } from "@/db/schema/bankTransactions";
import { nominalCodes } from "@/db/schema/nominalLedger";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign_nominal"),
    nominalCodeId: z.string().min(1),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal("exclude"),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal("update_notes"),
    notes: z.string(),
  }),
  z.object({
    action: z.literal("unexclude"),
  }),
]);

// PATCH /api/transactions/staged/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const parishCouncilId = session.user.parishCouncilId;

  if (!parishCouncilId) {
    return NextResponse.json(
      { error: "User is not linked to a parish council" },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const [tx] = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.id, id),
        eq(bankTransactions.parishCouncilId, parishCouncilId)
      )
    )
    .limit(1);

  if (!tx) {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 404 }
    );
  }

  if (tx.status === "POSTED") {
    return NextResponse.json(
      { error: "Cannot modify a posted transaction" },
      { status: 409 }
    );
  }

  const { action } = parsed.data;

  if (action === "assign_nominal") {
    const { nominalCodeId, notes } = parsed.data;

    const [code] = await db
      .select({
        id: nominalCodes.id,
        name: nominalCodes.name,
        code: nominalCodes.code,
      })
      .from(nominalCodes)
      .where(
        and(
          eq(nominalCodes.id, nominalCodeId),
          eq(nominalCodes.parishCouncilId, parishCouncilId),
          eq(nominalCodes.isActive, true)
        )
      )
      .limit(1);

    if (!code) {
      return NextResponse.json(
        { error: "Nominal code not found" },
        { status: 404 }
      );
    }

    const [updated] = await db
      .update(bankTransactions)
      .set({
        nominalCodeId,
        status: "CODED",
        ...(notes !== undefined && { notes }),
      })
      .where(
        and(
          eq(bankTransactions.id, id),
          eq(bankTransactions.parishCouncilId, parishCouncilId)
        )
      )
      .returning();

    return NextResponse.json({
      transaction: updated,
      nominalCode: code,
    });
  }

  if (action === "exclude") {
    const [updated] = await db
      .update(bankTransactions)
      .set({
        status: "EXCLUDED",
        notes: parsed.data.notes ?? tx.notes,
      })
      .where(
        and(
          eq(bankTransactions.id, id),
          eq(bankTransactions.parishCouncilId, parishCouncilId)
        )
      )
      .returning();

    return NextResponse.json({ transaction: updated });
  }

  if (action === "unexclude") {
    const newStatus = tx.nominalCodeId ? "CODED" : "PENDING";

    const [updated] = await db
      .update(bankTransactions)
      .set({ status: newStatus })
      .where(
        and(
          eq(bankTransactions.id, id),
          eq(bankTransactions.parishCouncilId, parishCouncilId)
        )
      )
      .returning();

    return NextResponse.json({ transaction: updated });
  }

  if (action === "update_notes") {
    const [updated] = await db
      .update(bankTransactions)
      .set({ notes: parsed.data.notes })
      .where(
        and(
          eq(bankTransactions.id, id),
          eq(bankTransactions.parishCouncilId, parishCouncilId)
        )
      )
      .returning();

    return NextResponse.json({ transaction: updated });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
