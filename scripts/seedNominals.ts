import { db } from "@/db";
import { financialYears, nominalCodes } from "@/db/schema/nominalLedger";
import { parishCouncils } from "@/db/schema/authSchema";
import { eq } from "drizzle-orm";

async function main() {
  // ⚠️ Replace with your actual parishCouncilId from DB
  const parishCouncilId = process.argv[2];

  if (!parishCouncilId) {
    throw new Error("Pass parishCouncilId as argument");
  }

  console.log("Seeding for parishCouncilId:", parishCouncilId);

  // 1. Ensure financial year exists
  let [year] = await db
    .select()
    .from(financialYears)
    .where(eq(financialYears.parishCouncilId, parishCouncilId))
    .limit(1);

  if (!year) {
    console.log("Creating financial year...");

    [year] = await db
      .insert(financialYears)
      .values({
        parishCouncilId,
        label: "2026/27",
        startDate: "2026-04-01",
        endDate: "2027-03-31",
        isClosed: false,
      })
      .returning();
  }

  console.log("Using financial year:", year.id);

  // 2. Default nominal codes
  const defaults = [
    {
      code: "1200",
      name: "Bank Current Account",
      type: "BALANCE_SHEET" as const,
      category: "Bank",
      isBank: true,
    },
    {
      code: "4000",
      name: "Income",
      type: "INCOME" as const,
      category: "Income",
      isBank: false,
    },
    {
      code: "5000",
      name: "General Expenses",
      type: "EXPENDITURE" as const,
      category: "Admin",
      isBank: false,
    },
    {
      code: "5010",
      name: "Insurance",
      type: "EXPENDITURE" as const,
      category: "Admin",
      isBank: false,
    },
    {
      code: "5020",
      name: "Licences & Subscriptions",
      type: "EXPENDITURE" as const,
      category: "Admin",
      isBank: false,
    },
  ];

  for (const item of defaults) {
    const exists = await db.query.nominalCodes.findFirst({
      where: (t, { and, eq }) =>
        and(
          eq(t.parishCouncilId, parishCouncilId),
          eq(t.financialYearId, year.id),
          eq(t.code, item.code)
        ),
    });

    if (!exists) {
      await db.insert(nominalCodes).values({
        parishCouncilId,
        financialYearId: year.id,
        code: item.code,
        name: item.name,
        type: item.type,
        category: item.category,
        isBank: item.isBank,
        isActive: true,
      });

      console.log("Inserted:", item.code);
    } else {
      console.log("Exists:", item.code);
    }
  }

  console.log("✅ Done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
