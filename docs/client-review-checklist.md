# WpAccPac Client Review Readiness Checklist

Use this checklist before a client review or demo. Each check is intended to be run manually against the deployed review environment and, where useful, repeated locally with seeded demo data.

## Public landing page

- [ ] Visit the public homepage while signed out and confirm the page loads without authentication redirects.
- [ ] Check that the headline, product name, and parish council bookkeeping value proposition are immediately clear.
- [ ] Follow each primary call to action and confirm it leads to the intended sign-in or account creation flow.
- [ ] Confirm public navigation links open the expected pages and do not expose authenticated-only content.
- [ ] Refresh the page and confirm no layout shift, blank screen, or client-side hydration error is visible.

## Mobile layout

- [ ] Open the public homepage on a narrow mobile viewport and confirm text, buttons, and navigation fit without horizontal scrolling.
- [ ] Sign in on mobile and confirm the authenticated shell, menu, and page title remain usable.
- [ ] Open the dashboard, bank inbox, reports, and budget pages on mobile and confirm key actions are reachable.
- [ ] Rotate between portrait and landscape and confirm content reflows without overlapping controls.
- [ ] Confirm tables, lists, and form controls have usable scrolling or responsive alternatives on small screens.

## Auth/sign in/create account

- [ ] Start from a signed-out session and confirm protected routes redirect to sign in.
- [ ] Sign in with the prepared demo user and confirm the user lands in the expected organisation or dashboard.
- [ ] Attempt sign in with an invalid password and confirm a clear, non-technical error is shown.
- [ ] Create a test account, if enabled for review, and confirm the onboarding path completes without manual database changes.
- [ ] Sign out and confirm the session is cleared and authenticated pages are no longer accessible through back navigation.

## Dashboard

- [ ] Open the dashboard with demo data and confirm headline balances, alerts, and recent activity look plausible.
- [ ] Check that dashboard figures reconcile with the underlying bank, budget, VAT, or ledger pages they link to.
- [ ] Follow each dashboard shortcut and confirm it opens the relevant workflow.
- [ ] Confirm closed-year or read-only warnings are visible when reviewing historic financial years.
- [ ] Load the dashboard for an organisation with minimal data and confirm it remains useful and not broken.

## Bank inbox

- [ ] Open the bank inbox and confirm imported transactions appear in review before posting.
- [ ] Review a receipt and confirm suggested account, VAT, fund, and description fields can be checked before posting.
- [ ] Review a payment and confirm the workflow prevents accidental posting with missing required coding.
- [ ] Search, filter, or sort inbox items and confirm the transaction count remains consistent.
- [ ] Confirm ignored, matched, or posted items leave the inbox and are traceable from the relevant ledger or audit view.

## Posting workflow

- [ ] Post a simple receipt and confirm it creates the expected immutable journal entry.
- [ ] Post a simple payment and confirm bank, nominal, fund, and VAT postings are correct.
- [ ] Attempt to edit a posted journal and confirm the app requires reversal and repost rather than direct mutation.
- [ ] Attempt to post into a closed financial year and confirm the action is blocked.
- [ ] Reverse and repost a demo correction and confirm reports reflect both the reversal and replacement posting.

## Bank reconciliation

- [ ] Open bank reconciliation for a demo account and confirm statement balance, book balance, and unreconciled items are shown.
- [ ] Reconcile a set of matching transactions and confirm the calculated difference reaches zero.
- [ ] Save or complete the reconciliation and confirm reconciled items are marked consistently across views.
- [ ] Reopen a completed reconciliation and confirm historic results are readable and not accidentally editable.
- [ ] Test an unreconciled difference and confirm the page explains what remains outstanding.

## VAT Return / VAT 126

- [ ] Open the VAT Return or VAT 126 workflow and confirm the selected period is clear.
- [ ] Confirm VAT inputs, VAT outputs, and claimable totals match the underlying coded transactions.
- [ ] Check that exempt, zero-rated, outside-scope, and no-VAT items are handled as expected in demo data.
- [ ] Generate the VAT report or claim output and confirm totals match the on-screen summary.
- [ ] Confirm historic VAT periods can be reviewed without changing posted accounting records.

## Reports and PDF exports

- [ ] Open core reports, including trial balance, income and expenditure, balance sheet, cashbook, and AGAR-related reports.
- [ ] Confirm each report uses the selected financial year, period, fund, and account filters correctly.
- [ ] Export each client-facing report to PDF and confirm the file opens, has readable formatting, and includes the expected title and dates.
- [ ] Compare a PDF export with the on-screen report and confirm totals, rows, and headings match.
- [ ] Confirm reports for closed years remain available and do not require reposting or recalculation by hand.

## Fixed assets

- [ ] Open the fixed assets register and confirm existing assets show cost, acquisition date, category, and current status.
- [ ] Add a demo asset and confirm required fields are validated before saving.
- [ ] Edit non-accounting descriptive details and confirm accounting history is not rewritten.
- [ ] Dispose of or mark a demo asset according to the intended workflow and confirm reporting reflects the change.
- [ ] Export or print the asset register and confirm it is suitable for client review.

## Borrowings

- [ ] Open borrowings and confirm each loan shows lender, opening balance, repayments, interest, and closing balance.
- [ ] Add or review a scheduled repayment and confirm principal and interest treatment is clear.
- [ ] Confirm borrowing balances reconcile to the relevant ledger and year-end report lines.
- [ ] Check historic borrowings in a closed year and confirm they are read-only where required.
- [ ] Export or print borrowing details and confirm the output is suitable for audit support.

## Budget

- [ ] Open the budget page and confirm budget lines map to the expected nominal codes or report categories.
- [ ] Enter or review budget values for a financial year and confirm totals update correctly.
- [ ] Compare budget versus actual figures and confirm actuals match posted transactions.
- [ ] Test fund, department, or category filters where available and confirm totals remain internally consistent.
- [ ] Confirm budgets for closed or historic years cannot be changed unless the product explicitly allows that workflow.

## Year-end close and historic reports

- [ ] Run through the year-end close preview and confirm pre-close checks identify any outstanding issues.
- [ ] Confirm closing balances, reserves, debtors, creditors, and AGAR mappings are visible before final close.
- [ ] Attempt to post into a closed year and confirm the app blocks the change.
- [ ] Open reports for a closed year and confirm they remain available without changing historic data.
- [ ] Confirm corrections after close use the agreed reversal and repost process in an open period.

## Empty states

- [ ] Open dashboard, bank inbox, reports, assets, borrowings, and budget with an organisation that has no demo data.
- [ ] Confirm each empty state explains what is missing and offers a relevant next action.
- [ ] Confirm empty pages do not show broken totals, placeholder errors, or developer-only text.
- [ ] Check that empty report exports are blocked or generated with clear zero-state messaging, as appropriate.
- [ ] Confirm empty states remain usable on mobile.

## Loading states

- [ ] Throttle the network or reload pages with larger demo data and confirm loading indicators appear promptly.
- [ ] Confirm loading states do not allow duplicate submissions for posting, reconciliation, or account creation.
- [ ] Navigate between dashboard, bank inbox, reports, and exports and confirm transitions do not leave stale data visible as current data.
- [ ] Generate a PDF export and confirm the user receives progress feedback until the file is ready.
- [ ] Confirm failed loads show recoverable errors with retry or navigation options.

## Production console/log checks

- [ ] Open the browser console during the full review path and confirm there are no uncaught errors or noisy warnings.
- [ ] Check production server logs while signing in, posting, reconciling, and exporting PDFs.
- [ ] Confirm expected validation errors are logged at an appropriate level and do not expose sensitive data.
- [ ] Confirm bank feed and posting actions have enough audit logging to diagnose review issues.
- [ ] Review monitoring or deployment dashboards for recent 4xx, 5xx, auth, and database errors before the client session.

## Demo data readiness

- [ ] Confirm the demo organisation name, financial year, funds, nominal codes, bank accounts, and opening balances are client-appropriate.
- [ ] Confirm demo bank transactions cover receipts, payments, VAT, transfers, corrections, and reconciliation examples.
- [ ] Confirm demo data includes fixed assets, borrowings, budget lines, and at least one historic year.
- [ ] Confirm demo reports and PDF exports contain realistic totals without private, test, or joke data.
- [ ] Reset or reseed the demo environment and confirm the review script can be repeated from a clean starting point.
