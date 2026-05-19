# Demo Data

The repeatable demo tenant is **Barton Seagrave Demo Parish Council**. It is identified by the fixed tenant id `demo-parish-council` and is safe to reset because the seed script deletes and recreates only rows scoped to that demo tenant and the demo sign-in user.

## Resetting the Demo

Run either command from the repo root:

```bash
bun run demo:seed
bun run demo:reset
```

Both commands call the same idempotent reset-and-seed script:

```bash
scripts/seed-demo-parish-council.ts
```

The script loads `.env.local`, uses `DATABASE_URL`, removes the previous demo tenant data, recreates the tenant, and prints the demo credentials.

Do not run this against production unless you intentionally want to create or reset the demo tenant in that production database.

## Demo Login

- Email: `demo@example.com`
- Password: `DemoReview2026!`
- Role: `CLERK`

Rerunning `bun run demo:reset` recreates the demo login, resets the password, marks the email as verified, and links the user back to `demo-parish-council`.

## What It Contains

- Demo parish council details, VAT 126 settings, and receipts/payments AGAR
  accounting basis.
- A closed prior year, `2025/26`, with a completed year-end run.
- A current open year, `2026/27`, ready for live workflow demonstrations.
- A fixed demo review/reconciliation date of `2026-05-18`, with current-year ledger and inbox demo items dated on or before that date.
- Nominal codes copied from the default chart, including AGAR mappings.
- Opening balances, bank accounts, budgets, reserves, projects, suppliers, VAT rates, fixed assets, borrowings, VAT return rows, posted journals, posted bank transactions, matched transactions, coded inbox items, and pending inbox items.

## Suggested Demo Flow

- Sign in as the printed demo user and confirm the dashboard status.
- Open the bank inbox and post the coded audit fee transaction.
- Code one pending receipt and one pending payment.
- Demonstrate manual-entry-first matching by opening the pending `SUMUP VILLAGE FETE STALL` receipt and matching it to the existing manual journal `MAN-2026-FETE-RECEIPT` instead of posting it again.
- Open Bank Reconciliation and review pending bank feed items, the unmatched manual total, and the resulting Difference.
- Expand `Explain` on the current account row and review the unmatched manual cheque `MAN-2026-CHQ-1042` as an uncleared payment with no bank feed item yet.
- Open VAT 126/VAT return reporting and confirm recoverable VAT is visible.
- Open the AGAR summary and confirm receipts/payments reporting shows gross
  cash receipts and payments while VAT remains available for reclaim reporting.
- Export trial balance, income and expenditure, AGAR summary, budget, bank reconciliation, large payments, fixed assets, and borrowings reports to PDF.
- View the closed `2025/26` historic reports.
- Use the open `2026/27` year to demonstrate year-end close, then run `bun run demo:reset` to restore the same starting point.
