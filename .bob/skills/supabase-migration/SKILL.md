---
name: supabase-migration
description: Use when creating, writing, or applying a Supabase PostgreSQL migration — covers table definitions, foreign keys, indexes, RLS policies, and applying via Supabase CLI or dashboard.
---

# Supabase Migration

Follow these steps whenever a new SQL migration file needs to be written and applied for the Scrum-Up project.

## Step 1 — Determine Migration Scope

Before writing any SQL, read the relevant sub-task in `scrum-up-plan.md` to identify:
- Which tables need to be created or altered
- Which columns, types, foreign keys, and indexes are required
- Which RLS policies apply to each table (check the role model in the plan's Overview section)

## Step 2 — Name the Migration File

Migration files live in `supabase/migrations/` and must be named with an incrementing prefix:

```
supabase/migrations/<NNN>_<short_description>.sql
```

Check existing files in `supabase/migrations/` to find the next number. Use snake_case for the description (e.g. `002_add_github_sprint_data.sql`).

## Step 3 — Write the SQL

Use `write_file` to create the migration. Follow this structure for each table:

```sql
-- =============================================
-- TABLE: <table_name>
-- =============================================
CREATE TABLE IF NOT EXISTS public.<table_name> (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- columns here
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_<table>_<col> ON public.<table_name>(<col>);

-- RLS
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "<table> select for authenticated"
  ON public.<table_name> FOR SELECT
  TO authenticated
  USING ( <condition> );

CREATE POLICY "<table> insert for project_head"
  ON public.<table_name> FOR INSERT
  TO authenticated
  WITH CHECK ( <condition> );
```

### RLS Policy Conventions for Scrum-Up

Always reference the `user_roles` table to check roles. Use these patterns:

**Super-admin check:**
```sql
EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role = 'super_admin'
    AND scope_type = 'global'
)
```

**Project head check (scoped to a team):**
```sql
EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role = 'project_head'
    AND scope_type = 'team'
    AND scope_id = <team_id_expression>
)
```

**Team member check:**
```sql
EXISTS (
  SELECT 1 FROM public.team_members
  WHERE user_id = auth.uid()
    AND team_id = <team_id_expression>
)
```

**Owner check (user owns the row):**
```sql
auth.uid() = <owner_column>
```

Super-admin policies should always be added as a separate OR branch or a separate permissive policy so they cannot be locked out:
```sql
CREATE POLICY "<table> all for super_admin"
  ON public.<table_name> FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
        AND scope_type = 'global'
    )
  );
```

## Step 4 — Apply the Migration

After writing the file, apply it using the Supabase CLI:

```powershell
npx supabase db push
```

If the CLI is not configured locally, instruct the user to paste the SQL directly into the **Supabase Dashboard → SQL Editor**.

## Step 5 — Verify

After applying:
1. Use `execute_command` to run `npx supabase db diff` — confirm no unexpected pending changes remain.
2. Remind the user to verify the tables and RLS policies are visible in the **Supabase Dashboard → Table Editor** and **Authentication → Policies**.

## Step 6 — Update the Plan

After the migration is verified, update the relevant sub-task status in `scrum-up-plan.md` if this migration was the last item in that sub-task's todo list.
