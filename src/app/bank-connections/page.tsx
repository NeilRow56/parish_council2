// src/app/bank-connections/page.tsx

import { db } from "@/db";
import { bankConnections } from "@/db/schema/bankConnection";
import { nominalCodes } from "@/db/schema/nominalLedger";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, asc, eq } from "drizzle-orm";

export default async function BankConnectionsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.parishCouncilId) {
    return <div className="p-6">Unauthorised</div>;
  }

  const parishCouncilId = session.user.parishCouncilId;

  const connections = await db
    .select({
      id: bankConnections.id,
      accountName: bankConnections.accountName,
      accountLast4: bankConnections.accountLast4,
      status: bankConnections.status,
      nominalCodeId: bankConnections.nominalCodeId,
      nominalCode: nominalCodes.code,
      nominalName: nominalCodes.name,
    })
    .from(bankConnections)
    .leftJoin(nominalCodes, eq(bankConnections.nominalCodeId, nominalCodes.id))
    .where(eq(bankConnections.parishCouncilId, parishCouncilId))
    .orderBy(asc(bankConnections.accountName));

  const bankNominalCodes = await db
    .select({
      id: nominalCodes.id,
      code: nominalCodes.code,
      name: nominalCodes.name,
    })
    .from(nominalCodes)
    .where(
      and(
        eq(nominalCodes.parishCouncilId, parishCouncilId),
        eq(nominalCodes.isBank, true),
        eq(nominalCodes.isActive, true)
      )
    )
    .orderBy(asc(nominalCodes.code));

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Bank connections</h1>

      <a
        href="/api/bank/connect"
        className="inline-flex rounded bg-black px-4 py-2 text-white"
      >
        Connect bank account
      </a>

      <div className="space-y-3">
        {connections.length === 0 ? (
          <p>No bank accounts connected yet.</p>
        ) : (
          connections.map((connection) => (
            <div key={connection.id} className="rounded border p-4 space-y-3">
              <div>
                <p className="font-medium">
                  {connection.accountName}{" "}
                  {connection.accountLast4
                    ? `****${connection.accountLast4}`
                    : ""}
                </p>

                <p className="text-sm text-gray-600">
                  Status: {connection.status}
                </p>

                <p className="text-sm text-gray-600">
                  Ledger code:{" "}
                  {connection.nominalCode
                    ? `${connection.nominalCode} — ${connection.nominalName}`
                    : "Not linked"}
                </p>
              </div>

              <form
                action="/api/bank-connections/link-ledger-code"
                method="post"
                className="flex flex-wrap gap-2"
              >
                <input
                  type="hidden"
                  name="connectionId"
                  value={connection.id}
                />

                <select
                  name="nominalCodeId"
                  defaultValue={connection.nominalCodeId ?? ""}
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="">Select bank ledger code...</option>

                  {bankNominalCodes.map((code) => (
                    <option key={code.id} value={code.id}>
                      {code.code} — {code.name}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  className="rounded border px-3 py-2 text-sm"
                >
                  Save ledger code
                </button>
              </form>

              <form action="/api/bank/sync" method="post">
                <input
                  type="hidden"
                  name="connectionId"
                  value={connection.id}
                />

                <button
                  type="submit"
                  className="rounded border px-3 py-1 text-sm"
                >
                  Sync now
                </button>
              </form>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
