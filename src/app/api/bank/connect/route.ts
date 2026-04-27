import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.redirect(
      new URL("/auth/login", process.env.NEXT_PUBLIC_APP_URL)
    );
  }

  const parishCouncilId = session.user.parishCouncilId;

  if (!parishCouncilId) {
    return NextResponse.json(
      { error: "User is not linked to a parish council" },
      { status: 403 }
    );
  }

  const clientId = process.env.TRUELAYER_CLIENT_ID;
  const redirectUri = process.env.TRUELAYER_REDIRECT_URI;
  const authBaseUrl =
    process.env.TRUELAYER_AUTH_URL ?? "https://auth.truelayer-sandbox.com";

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing TrueLayer environment variables" },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: [
      "info",
      "accounts",
      "balance",
      "cards",
      "transactions",
      "offline_access",
    ].join(" "),
    providers: "uk-cs-mock uk-ob-all uk-oauth-all",
  });

  const authUrl = `${authBaseUrl}/?${params.toString()}`;

  return NextResponse.redirect(authUrl);
}
