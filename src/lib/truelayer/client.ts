import axios from "axios";

import { and, eq } from "drizzle-orm";
import type {
  BankConnection,
  TrueLayerAccount,
  TrueLayerBalance,
  TrueLayerTokenResponse,
  TrueLayerTransaction,
} from "./types";
import { bankConnections } from "@/db/schema/bankConnection";
import { db } from "@/db";

// Re-export types so callers can import from one place
export type {
  BankConnection,
  TrueLayerAccount,
  TrueLayerBalance,
  TrueLayerTokenResponse,
  TrueLayerTransaction,
};

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

const AUTH_URL = requiredEnv("TRUELAYER_AUTH_URL");
const API_URL = requiredEnv("TRUELAYER_API_URL");
const CLIENT_ID = requiredEnv("TRUELAYER_CLIENT_ID");
const CLIENT_SECRET = requiredEnv("TRUELAYER_CLIENT_SECRET");
const REDIRECT_URI = requiredEnv("TRUELAYER_REDIRECT_URI");

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

export function buildAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: [
      "info",
      "accounts",
      "balance",
      "transactions",
      "offline_access",
    ].join(" "),
    providers: "uk-ob-all uk-oauth-all",
  });

  return `${AUTH_URL}/?${params.toString()}`;
}

export async function exchangeCode(
  code: string
): Promise<TrueLayerTokenResponse> {
  const { data } = await axios.post<TrueLayerTokenResponse>(
    `${AUTH_URL}/connect/token`,
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return data;
}

export async function refreshAccessToken(
  connection: BankConnection
): Promise<string> {
  const { data } = await axios.post<TrueLayerTokenResponse>(
    `${AUTH_URL}/connect/token`,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: connection.refreshToken,
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const expiry = new Date(Date.now() + data.expires_in * 1000);

  await db
    .update(bankConnections)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpiry: expiry,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bankConnections.id, connection.id),
        eq(bankConnections.parishCouncilId, connection.parishCouncilId)
      )
    );

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Internal: get a valid non-expired access token
// ---------------------------------------------------------------------------

async function getValidToken(connection: BankConnection): Promise<string> {
  const bufferMs = 5 * 60 * 1000;

  if (connection.accessTokenExpiry.getTime() - Date.now() < bufferMs) {
    return refreshAccessToken(connection);
  }

  return connection.accessToken;
}

function apiClient(token: string) {
  return axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// ---------------------------------------------------------------------------
// Data API
// ---------------------------------------------------------------------------

export async function fetchAccounts(
  connection: Pick<
    BankConnection,
    "accessToken" | "refreshToken" | "accessTokenExpiry"
  > &
    Partial<Pick<BankConnection, "id" | "parishCouncilId">>
): Promise<TrueLayerAccount[]> {
  const token =
    connection.id && connection.parishCouncilId
      ? await getValidToken(connection as BankConnection)
      : connection.accessToken;

  const { data } = await apiClient(token).get<{
    results: TrueLayerAccount[];
  }>("/data/v1/accounts");

  return data.results;
}

export async function fetchTransactions(
  connection: BankConnection,
  from: Date,
  to: Date
): Promise<TrueLayerTransaction[]> {
  const token = await getValidToken(connection);

  const params = {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };

  const { data } = await apiClient(token).get<{
    results: TrueLayerTransaction[];
  }>(`/data/v1/accounts/${connection.accountId}/transactions`, {
    params,
  });

  return data.results;
}

export async function fetchBalance(
  connection: BankConnection
): Promise<TrueLayerBalance> {
  const token = await getValidToken(connection);

  const { data } = await apiClient(token).get<{
    results: TrueLayerBalance[];
  }>(`/data/v1/accounts/${connection.accountId}/balance`);

  return data.results[0];
}
