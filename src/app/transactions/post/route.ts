import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { postTransactionsToLedger } from "@/lib/ledger/poster";
import { z } from "zod";

const postSchema = z.object({
  transactionIds: z.array(z.string()).optional(),
});

// POST /api/transactions/post
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const role = session.user.role as string;

  if (!["RFO", "CLERK"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parishCouncilId = session.user.parishCouncilId;

  if (!parishCouncilId) {
    return NextResponse.json(
      { error: "User is not linked to a parish council" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const parsed = postSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const result = await postTransactionsToLedger({
    parishCouncilId,
    transactionIds: parsed.data.transactionIds,
    postedById: session.user.id,
  });

  return NextResponse.json(result);
}
