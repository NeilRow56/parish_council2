import { NextRequest, NextResponse } from "next/server";
import { syncAllConnections } from "@/lib/truelayer/sync";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const results = await syncAllConnections();
  return NextResponse.json({ results });
}
