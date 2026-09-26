---
name: scrum-up-theme
description: Use when creating or editing any Vue component or view for the Scrum-Up project — enforces the dark neon-purple futuristic design theme with black backgrounds, purple glow borders, and consistent PrimeVue overrides.
---

# Scrum-Up Theme — Neon Purple Design System

Follow these steps whenever you create or edit a `.vue` file or any CSS for the Scrum-Up project.

## Step 1 — Load the Token Reference

Read `.bob/skills/scrum-up-theme/tokens.md` in full before writing any styles. It defines:
- The complete colour palette (`--su-*` CSS variables)
- Neon glow `box-shadow` and `text-shadow` patterns
- Per-component CSS patterns (card, button, input, sidebar, DataTable, dialog, tag)
- PrimeVue surface token overrides

Do not invent colours outside this palette. Every value must trace to a token in that file.

## Step 2 — Global Theme Setup (first time only)

If `src/assets/theme.css` does not exist, create it and import it in `src/main.ts`:

```ts
import './assets/theme.css'
```

`src/assets/theme.css` must contain:
1. The `:root` block with all `--su-*` custom properties from `tokens.md`
2. The PrimeVue surface token overrides block from `tokens.md`
3. A global `body` reset:
   ```css
   body {
     background: var(--su-bg);
     color: var(--su-text);
     font-family: 'Inter', -apple-system, "Segoe UI", system-ui, sans-serif;
     font-size: 14px;
     line-height: 1.6;
     margin: 0;
   }
   ```

Only create this file once. If it already exists, skip this step.

## Step 3 — Apply Theme to Every New Component

For every `.vue` file created or edited:

### Backgrounds
- Page/view root element: `background: var(--su-bg)`
- Cards, panels, sidebars: `background: var(--su-bg-surface)`
- Modals, dropdowns: `background: var(--su-bg-elevated)`

### Borders
- Default borders: `1px solid var(--su-border)`
- Active / focused / hover borders: `1px solid var(--su-border-glow)`
- Never use plain grey or white borders

### Neon Glow
- Cards at rest: `box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.15)`
- Cards on hover: `box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 16px 4px rgba(124, 58, 237, 0.35)`
- Active/focus states: `box-shadow: 0 0 0 2px #a855f7, 0 0 16px 4px rgba(168, 85, 247, 0.5)`
- Heading glow: `text-shadow: 0 0 8px rgba(168, 85, 247, 0.8)` (use sparingly on h1/h2 only)

### Text
- Primary text: `color: var(--su-text)`
- Muted / labels: `color: var(--su-text-muted)`
- Headings: `color: var(--su-purple-300)`
- Never use plain black text

### Buttons (PrimeVue `Button`)
- Primary actions: use `outlined` prop false, override background to `linear-gradient(135deg, #4c1d95, #7c3aed)` via `:deep(.p-button)` or scoped styles
- Secondary/text actions: `text` prop, color `var(--su-text-muted)` with purple hover
- Danger actions: `severity="danger"`, colour `var(--su-danger)`

### Inputs (PrimeVue `InputText`, `Dropdown`, `MultiSelect`, `Textarea`)
- Override via `:deep()`:
  ```css
  :deep(.p-inputtext),
  :deep(.p-dropdown),
  :deep(.p-multiselect) {
    background: var(--su-bg-elevated);
    border-color: var(--su-border);
    color: var(--su-text);
  }
  :deep(.p-inputtext:focus),
  :deep(.p-dropdown:not(.p-disabled).p-focus) {
    border-color: var(--su-border-glow);
    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
  }
  ```

### DataTable (PrimeVue `DataTable`)
Override header, row, and stripe colours using `:deep()` per the DataTable pattern in `tokens.md`.

### Tags / Badges (PrimeVue `Tag`)
Default severity should be styled with `background: rgba(124, 58, 237, 0.2); color: var(--su-purple-300); border: 1px solid rgba(124, 58, 237, 0.4)`.

### Dialogs (PrimeVue `Dialog`)
Override header and content background via `:deep()` to match the dialog pattern in `tokens.md`.

## Step 4 — Sidebar / Nav Items

For any navigation sidebar (e.g. `AdminLayout`), apply the sidebar nav item pattern from `tokens.md`:
- Resting: muted text, no background, transparent left border
- Hover: soft purple background tint, `--su-purple-300` text
- Active: stronger tint, `--su-purple-400` left border, neon text glow

## Step 5 — Verify Visual Consistency

Before finalising any component:
1. Confirm no raw hex colours are used outside of the token system
2. Confirm no white or light backgrounds appear anywhere
3. Confirm all interactive elements (buttons, inputs, links) have a visible purple glow on focus/hover
4. Run `npm run build` to confirm no CSS or TypeScript errors
