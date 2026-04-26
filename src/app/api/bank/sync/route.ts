import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { syncAllConnections } from "@/lib/truelayer/sync";

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

  const results = await syncAllConnections({
    parishCouncilId,
  });

  return NextResponse.json({ results });
}
