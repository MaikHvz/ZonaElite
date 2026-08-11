<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project context

Read `contexto/BRAIN.md` first. It contains everything needed to understand the project without reviewing source code.
Read the entire `documentacion/` folder if you need deep codebase understanding.

# Workflow Skill (CRITICAL)

Before implementing any new feature, you MUST read and execute the workflow defined in `documentacion/guia-de-trabajo.md`. 
Every new feature requires a planning phase, an impact analysis phase, the execution itself, and a mandatory post-implementation documentation update (including SQL schema).

# Database & migrations

- The stack is **Supabase (PostgreSQL) + RLS** for both production and local dev (no Prisma/SQLite fallback).
- SQL schema/function changes go in a numbered migration under `contexto/migrations/` (e.g. `022_expire_benefits.sql`). Migrations are idempotent and applied manually in the Supabase SQL Editor.
- Keep the schema mirror `documentacion/squema-sql-actualizado.sql` in 1:1 sync with migrations (the test suite `scripts/test-flows.mjs` asserts the mirror matches).
- Feature work must also log its changelog entry via a seed migration (`NNN_changelog_vX_Y_Z.sql`, `ON CONFLICT (version) DO NOTHING`).
