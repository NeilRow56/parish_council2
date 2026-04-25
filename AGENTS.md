<!-- BEGIN:nextjs-agent-rules -->

# Project: WpAccPac (UK Accounts Working Papers SaaS)

## Stack

- Next.js 16 App Router
- TypeScript strict
- Drizzle ORM + Postgres (Neon)
- Tailwind + shadcn/ui

## Rules

- NEVER use `any`
- Always use canonical asset fields:
  - originalCost
  - acquisitionDate
  - depreciationRate
  - depreciationMethod
- Period CLOSED = fully read-only
- Use server actions for mutations

## UI Conventions

- Use modal dialogs for schedule drilldowns
- Currency formatting uses £ but not inline in inputs
- Tables follow consistent structure

## Domain Rules

- Depreciation is period-based
- Rollforward must be idempotent

<!-- END:nextjs-agent-rules -->
