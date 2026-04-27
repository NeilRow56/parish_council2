import { db } from "@/db";
import { bankConnections } from "@/db/schema/bankConnection";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

export default async function BankConnectionsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.parishCouncilId) {
    return <div className="p-6">Unauthorised</div>;
  }

  const connections = await db
    .select()
    .from(bankConnections)
    .where(eq(bankConnections.parishCouncilId, session.user.parishCouncilId));

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
            <div key={connection.id} className="rounded border p-4">
              <p className="font-medium">
                {connection.accountName}{" "}
                {connection.accountLast4
                  ? `****${connection.accountLast4}`
                  : ""}
              </p>
              <p className="text-sm text-gray-600">
                Status: {connection.status}
              </p>
              <form action="/api/bank/sync" method="post">
              <input type="hidden" name="connectionId" value={connection.id} />
  <button
    type="submit"
    className="mt-3 rounded border px-3 py-1 text-sm"
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
