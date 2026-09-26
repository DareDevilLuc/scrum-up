---
name: vue-primevue-component
description: Use when creating a new Vue 3 component or view for the Scrum-Up project — covers script setup with TypeScript, PrimeVue component usage, Supabase data fetching inside composables, and emits/props conventions.
---

# Vue + PrimeVue Component

Follow these steps whenever a new `.vue` file needs to be created for the Scrum-Up project — whether it is a reusable component in `src/components/` or a page-level view in `src/views/`.

## Step 1 — Identify the Component's Role

Read the relevant sub-task in `scrum-up-plan.md` to confirm:
- Is this a **page-level view** (`src/views/`) or a **reusable component** (`src/components/`)?
- What **props** does it accept?
- What **events** does it emit?
- Which **Pinia store** or **composable** does it consume?
- Which **PrimeVue components** are needed?

## Step 2 — File Location Convention

| Type | Location | Naming |
|---|---|---|
| Page view | `src/views/<feature>/NameView.vue` | PascalCase, suffix `View` |
| Reusable component | `src/components/NameComponent.vue` | PascalCase |
| Chart component | `src/components/charts/NameChart.vue` | PascalCase, suffix `Chart` |
| Dialog component | `src/components/NameDialog.vue` | PascalCase, suffix `Dialog` |

## Step 3 — Write the Component

Use this canonical template for all Scrum-Up `.vue` files:

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
// PrimeVue imports — import only what is used
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
// Store / composable
import { useExampleStore } from '@/stores/example'

// Props
const props = defineProps<{
  exampleId: string
}>()

// Emits
const emit = defineEmits<{
  (e: 'saved', id: string): void
}>()

// Store
const store = useExampleStore()

// Local state
const loading = ref(false)
const error = ref<string | null>(null)

// Fetch on mount
onMounted(async () => {
  loading.value = true
  try {
    await store.fetchData(props.exampleId)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <p v-if="error" class="text-red-500">{{ error }}</p>
    <ProgressSpinner v-if="loading" />
    <template v-else>
      <!-- component body -->
    </template>
  </div>
</template>
```

### PrimeVue Component Conventions

- Always import components individually from `primevue/<component>` — do not rely on global auto-import unless it is already configured in `main.ts`.
- Use PrimeVue's `severity` prop for status badges: `success`, `warning`, `danger`, `info`.
- Use `PrimeVue Dialog` for all modal interactions — controlled via a `ref<boolean>` named `visible`.
- Use `PrimeVue DataTable` with `lazy` + pagination for any list longer than 20 rows.
- For forms, use `PrimeVue InputText`, `Textarea`, `Dropdown`, `MultiSelect`, `Calendar` — never raw `<input>`.
- Use `PrimeVue Toast` (via `useToast()`) for success/error feedback — never `alert()`.

### Error and Loading Pattern

Every component that fetches data must have:
```vue
const loading = ref(false)
const error = ref<string | null>(null)
```
Show `<ProgressSpinner />` while loading, show the error string in a `<Message severity="error">` if set.

### Role-Based Visibility

Use the `auth` store to conditionally show actions:
```vue
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()
// In template:
// <Button v-if="auth.role === 'project_head'" label="Create Project" />
```

## Step 4 — Register the Route (views only)

If the file is a page-level view, add its route to `src/router/index.ts`:
```typescript
{
  path: '/your-path',
  component: () => import('@/views/feature/YourView.vue'),
  meta: { requiresAuth: true, roles: ['project_head'] }, // add roles if guarded
}
```

Apply the `requireAuth` and `requireRole` guards defined in `src/router/guards.ts`.

## Step 5 — Verify

After writing the component:
1. Run `execute_command` → `npm run build` to confirm no TypeScript or Vue compilation errors.
2. Check that all PrimeVue imports resolve (no missing module errors).
3. Update the relevant sub-task status in `scrum-up-plan.md`.
