---
name: supabase-edge-function
description: Use when creating or editing a Supabase Edge Function — covers Deno/TypeScript structure, CORS headers, reading secrets, calling OpenAI or GitHub APIs, and deploying via Supabase CLI.
---

# Supabase Edge Function

Follow these steps whenever a new Edge Function needs to be written for the Scrum-Up project.

## Step 1 — Determine the Function's Responsibility

Read the relevant sub-task in `scrum-up-plan.md` to identify:
- The function's **input** (request body shape)
- The function's **output** (response JSON shape)
- Which **external API** it calls (OpenAI, GitHub, or both)
- Which **Supabase tables** it reads or writes

Each function does one thing. Do not combine multiple responsibilities into a single function.

## Step 2 — Create the Function File

Edge Functions live at:
```
supabase/functions/<function-name>/index.ts
```

Use `write_file` to create the file. The function name must be kebab-case (e.g. `generate-sprint-plan`).

## Step 3 — Write the Function

Use this canonical template for all Scrum-Up Edge Functions:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse input
    const { /* destructure expected fields */ } = await req.json()

    // 2. Create Supabase client (uses caller's auth token for RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 3. Read secrets (never hardcode)
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const githubToken = Deno.env.get('GITHUB_TOKEN') // or read from users table

    // 4. Core logic here

    // 5. Return response
    return new Response(
      JSON.stringify({ /* result */ }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### OpenAI GPT-4o Call Pattern

```typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${openaiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    response_format: { type: 'json_object' }, // always use for structured output
    messages: [
      { role: 'system', content: '...' },
      { role: 'user', content: '...' },
    ],
  }),
})
const data = await response.json()
const parsed = JSON.parse(data.choices[0].message.content)
```

### GitHub REST API Call Pattern

```typescript
// Read the user's stored GitHub token from the DB
const { data: userRow } = await supabase
  .from('users')
  .select('github_token')
  .eq('id', userId)
  .single()

const ghResponse = await fetch(`https://api.github.com/repos/${repoFullName}/commits`, {
  headers: {
    'Authorization': `Bearer ${userRow.github_token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
})
const commits = await ghResponse.json()
```

## Step 4 — Register Secrets

Any secret the function needs must be registered before deployment. Use `execute_command`:

```powershell
npx supabase secrets set OPENAI_API_KEY=<value>
```

Never put secrets in `.env` — they belong in Supabase Vault / Edge Function secrets only.

## Step 5 — Deploy the Function

```powershell
npx supabase functions deploy <function-name>
```

If Supabase CLI is not configured locally, instruct the user to use the Supabase Dashboard → Edge Functions → Deploy.

## Step 6 — Wire the Frontend Call

Show how to invoke the function from Vue using the Supabase JS client:

```typescript
const { data, error } = await supabase.functions.invoke('<function-name>', {
  body: { /* input payload */ },
})
```

This automatically forwards the user's auth token, which the Edge Function uses for RLS-compliant Supabase queries.

## Step 7 — Update the Plan

After the function is deployed and wired, update the relevant sub-task status in `scrum-up-plan.md`.
