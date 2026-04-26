import { NextRequest, NextResponse } from "next/server";
import { syncAllConnections } from "@/lib/truelayer/sync";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function POST(request: NextRequest) {
  // ── Auth: get session ─────────────────────────────────────────────
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // ── Authorisation: role check ─────────────────────────────────────
  const role = session.user.role as string;

  if (!["RFO", "CLERK"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Tenant check (critical for multi-tenancy) ─────────────────────
  const parishCouncilId = session.user.parishCouncilId;

  if (!parishCouncilId) {
    return NextResponse.json(
      { error: "User is not linked to a parish council" },
      { status: 403 }
    );
  }

  // ── Sync (scoped to tenant) ───────────────────────────────────────
  const results = await syncAllConnections({
    parishCouncilId,
  });

  return NextResponse.json({ results });
}
