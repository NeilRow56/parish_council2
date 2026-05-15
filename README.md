# WpAccPac Parish Accounts

Bookkeeping, reporting, VAT, bank reconciliation, and AGAR preparation software
for UK parish and town councils.

## Stack

- Next.js 16 App Router
- TypeScript strict
- Bun
- Tailwind CSS and shadcn/ui
- Drizzle ORM with Neon Postgres
- Better Auth
- TrueLayer bank feeds
- Vercel deployment

## Development

Install dependencies and run the local app:

```bash
bun install
bun run dev
```

The development server runs at `http://localhost:3000`.

Useful checks before release:

```bash
bun run lint
bun ./node_modules/typescript/bin/tsc --noEmit
bun run build
```

## Notes

The accounting engine is intended to preserve posted records. Closed financial
years are read-only, posted journals are immutable, and corrections should use
reversal and repost workflows.
