<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may
all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation
notices.

# Parish Council App

UK parish council bookkeeping, reporting, and AGAR preparation SaaS.

## Stack

- Next.js 16 App Router
- TypeScript strict
- Bun
- Tailwind CSS
- shadcn/ui
- Drizzle ORM
- Neon Postgres
- Better Auth
- Vercel
- TrueLayer bank feeds

## Rules

- Make minimal changes.
- Do not rewrite working business logic.
- Preserve existing database schema unless explicitly asked.
- Keep TypeScript strict.
- Closed financial years are read-only.
- Journals are immutable after posting.
- Corrections use reversal and repost.
- AGAR reports derive from nominal code mappings.
- Bank feed imports go through inbox/review before posting.
- Explain every file changed.

<!-- END:nextjs-agent-rules -->
