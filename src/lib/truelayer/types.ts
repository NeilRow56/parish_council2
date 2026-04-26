// Shared types for TrueLayer integration.
// Keeping these separate avoids circular imports between client.ts and sync.ts.

import type { InferSelectModel } from "drizzle-orm";
import { bankConnections } from "@/db/schema/bankConnection";

export interface TrueLayerTransaction {
  transaction_id: string;
  normalised_provider_transaction_id?: string;
  timestamp: string;
  description: string;
  transaction_type: "CREDIT" | "DEBIT";
  transaction_category: string;
  amount: number; // always positive from TrueLayer
  currency: string;
  merchant_name?: string;
}

export interface TrueLayerAccount {
  account_id: string;
  account_type: string;
  display_name: string;
  currency: string;
  account_number: {
    iban?: string;
    number?: string;
    sort_code?: string;
  };
  provider: {
    provider_id: string;
    display_name: string;
  };
}

export interface TrueLayerBalance {
  current: number;
  available: number;
  currency: string;
  update_timestamp: string;
}

export interface TrueLayerTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

// BankConnection row inferred directly from Drizzle.
// This keeps the TypeScript type in sync with your schema, including parishCouncilId.
export type BankConnection = InferSelectModel<typeof bankConnections>;
