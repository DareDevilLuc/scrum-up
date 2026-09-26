---
name: pinia-store
description: Use when creating a new Pinia store for the Scrum-Up project — covers the setup store pattern with TypeScript, Supabase query conventions, loading and error state, and store composition.
---

# Pinia Store

Follow these steps whenever a new Pinia store needs to be written for the Scrum-Up project.

## Step 1 — Identify the Store's Responsibility

Read the relevant sub-task in `scrum-up-plan.md` to confirm:
- What **state** does this store own?
- What **actions** (async Supabase calls) does it expose?
- Which **other stores** does it depend on (e.g. the `auth` store for the current user's ID)?
- Does any state need to **persist** across page reloads? (rare — only for auth session)

One store per feature domain (e.g. `projects`, `teams`, `dashboard`). Do not create one giant store.

## Step 2 — File Location

All stores live at:
```
src/stores/<name>.ts
```
Name the file after the domain in camelCase (e.g. `src/stores/projects.ts`).

## Step 3 — Write the Store

Use the **setup store** pattern (not the options API pattern) for all Scrum-Up stores:

```typescript
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/supabase' // generated types

export const useExampleStore = defineStore('example', () => {
  // ── State ────────────────────────────────────────────────────────────────
  const items = ref<Database['public']['Tables']['example']['Row'][]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ──────────────────────────────────────────────────────────────
  const count = computed(() => items.value.length)

  // ── Actions ──────────────────────────────────────────────────────────────
  async function fetchItems(scopeId: string) {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('example')
        .select('*')
        .eq('scope_id', scopeId)
        .order('created_at', { ascending: false })

      if (sbError) throw sbError
      items.value = data ?? []
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function createItem(payload: Database['public']['Tables']['example']['Insert']) {
    loading.value = true
    error.value = null
    try {
      const { data, error: sbError } = await supabase
        .from('example')
        .insert(payload)
        .select()
        .single()

      if (sbError) throw sbError
      items.value.unshift(data)
      return data
    } catch (e) {
      error.value = (e as Error).message
      return null
    } finally {
      loading.value = false
    }
  }

  async function updateItem(id: string, payload: Partial<Database['public']['Tables']['example']['Update']>) {
    const { error: sbError } = await supabase
      .from('example')
      .update(payload)
      .eq('id', id)

    if (sbError) {
      error.value = sbError.message
      return false
    }
    const idx = items.value.findIndex(i => i.id === id)
    if (idx !== -1) Object.assign(items.value[idx], payload)
    return true
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  function $reset() {
    items.value = []
    loading.value = false
    error.value = null
  }

  return { items, loading, error, count, fetchItems, createItem, updateItem, $reset }
})
```

### Key Conventions

- **Always** include `loading` and `error` refs in every store that makes async calls.
- **Never** put raw `fetch()` calls in a store — use the Supabase JS client from `@/lib/supabase`.
- **Optimistic updates:** after an insert, `unshift` the new row into the local array so the UI updates without a re-fetch.
- **Type safety:** use `Database['public']['Tables']['<table>']['Row']` for row types. If Supabase types are not yet generated, use `any` as a temporary placeholder and add a `// TODO: generate types` comment.
- **Auth-scoped queries:** when a query should be scoped to the current user, import `useAuthStore` and use `auth.user?.id`:
  ```typescript
  import { useAuthStore } from '@/stores/auth'
  const auth = useAuthStore()
  // ...
  .eq('user_id', auth.user!.id)
  ```
- **Do not** call `useAuthStore()` at the top level of the setup function if the auth store might not be initialized yet — call it inside the action function instead.

## Step 4 — Generate Supabase Types (if not yet done)

If `src/types/supabase.ts` does not exist, generate it with:

```powershell
npx supabase gen types typescript --project-id <project-ref> --schema public > src/types/supabase.ts
```

This gives full type safety for all table rows, inserts, and updates.

## Step 5 — Verify

After writing the store:
1. Run `execute_command` → `npm run build` to confirm no TypeScript errors.
2. Confirm the store is imported and used correctly in its corresponding component.
3. Update the relevant sub-task status in `scrum-up-plan.md`.
