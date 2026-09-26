<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Checkbox from 'primevue/checkbox'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'

// ── Router / stores ───────────────────────────────────────────────────────────

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const projectId = computed(() => route.params.id as string)
const sprintId = computed(() => route.params.sprintId as string)

const isProjectHead = computed(
  () => auth.role === 'project_head' || auth.role === 'super_admin',
)

// ── Types ─────────────────────────────────────────────────────────────────────

interface RetroNote {
  text: string
  author: string
  anonymous: boolean
}

interface RetroNotes {
  went_well: RetroNote[]
  could_improve: RetroNote[]
  action_items: RetroNote[]
}

type RetroColumn = keyof RetroNotes

// ── State ─────────────────────────────────────────────────────────────────────

const sprintName = ref<string>('')
const notes = ref<RetroNotes>({ went_well: [], could_improve: [], action_items: [] })
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

// Per-column inputs
const newNote = ref<Record<RetroColumn, string>>({
  went_well: '',
  could_improve: '',
  action_items: '',
})

// Per-column anonymous toggle
const postAnonymous = ref<Record<RetroColumn, boolean>>({
  went_well: false,
  could_improve: false,
  action_items: false,
})

// Current user display name
const currentAuthor = computed(() => {
  const user = auth.user
  if (!user) return 'Unknown'
  return (user as any).user_metadata?.display_name
    ?? (user as any).user_metadata?.full_name
    ?? user.email?.split('@')[0]
    ?? 'Unknown'
})

// ── AI Retro Summary ──────────────────────────────────────────────────────────

const retroSummary = ref<string | null>(null)
const generatingSummary = ref(false)
const summaryError = ref<string | null>(null)

async function generateRetroSummary() {
  generatingSummary.value = true
  summaryError.value = null
  try {
    const { data, error: fnErr } = await supabase.functions.invoke(
      'generate-retro-summary',
      { body: { sprint_id: sprintId.value } },
    )
    if (fnErr) throw new Error(fnErr.message)
    retroSummary.value = data.summary
  } catch (e) {
    summaryError.value = (e as Error).message
  } finally {
    generatingSummary.value = false
  }
}

// ── Save (debounced) ──────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(persistNotes, 800)
}

async function persistNotes() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  saving.value = true
  try {
    const { error: err } = await supabase
      .from('sprints')
      .update({ retrospective_notes: JSON.stringify(notes.value) })
      .eq('id', sprintId.value)
    if (err) throw err
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: (e as Error).message, life: 5000 })
  } finally {
    saving.value = false
  }
}

// ── Add / remove notes ────────────────────────────────────────────────────────

function addNote(col: RetroColumn) {
  const text = newNote.value[col].trim()
  if (!text) return
  notes.value[col].push({
    text,
    author: currentAuthor.value,
    anonymous: postAnonymous.value[col],
  })
  newNote.value[col] = ''
  scheduleSave()
}

function removeNote(col: RetroColumn, index: number) {
  notes.value[col].splice(index, 1)
  scheduleSave()
}

function canRemove(note: RetroNote): boolean {
  if (isProjectHead.value) return true
  return note.author === currentAuthor.value
}

function handleEnter(col: RetroColumn, event: KeyboardEvent) {
  event.preventDefault()
  addNote(col)
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchRetroNotes() {
  loading.value = true
  error.value = null
  try {
    const { data, error: err } = await supabase
      .from('sprints')
      .select('name, retrospective_notes')
      .eq('id', sprintId.value)
      .single()
    if (err) throw err

    sprintName.value = data.name

    if (data.retrospective_notes) {
      try {
        const raw =
          typeof data.retrospective_notes === 'string'
            ? JSON.parse(data.retrospective_notes)
            : data.retrospective_notes
        const toNoteList = (arr: unknown[]): RetroNote[] =>
          (arr ?? []).map((n) =>
            typeof n === 'string'
              ? { text: n, author: 'Team', anonymous: false }
              : (n as RetroNote),
          )
        notes.value = {
          went_well: toNoteList(raw.went_well ?? []),
          could_improve: toNoteList(raw.could_improve ?? []),
          action_items: toNoteList(raw.action_items ?? []),
        }
      } catch {
        notes.value = { went_well: [], could_improve: [], action_items: [] }
      }
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(fetchRetroNotes)
watch(sprintId, fetchRetroNotes)

// ── Column config ─────────────────────────────────────────────────────────────

interface ColConfig {
  key: RetroColumn
  label: string
  icon: string
  inputPlaceholder: string
  accentClass: string
}

const columns: ColConfig[] = [
  {
    key: 'went_well',
    label: 'Went Well',
    icon: 'pi pi-thumbs-up',
    inputPlaceholder: 'What went well this sprint?',
    accentClass: 'col--success',
  },
  {
    key: 'could_improve',
    label: 'Could Improve',
    icon: 'pi pi-exclamation-triangle',
    inputPlaceholder: 'What could be better next time?',
    accentClass: 'col--warn',
  },
  {
    key: 'action_items',
    label: 'Action Items',
    icon: 'pi pi-check-square',
    inputPlaceholder: 'Concrete action for next sprint…',
    accentClass: 'col--info',
  },
]
</script>

<template>
  <Toast />

  <div class="retro-page">

    <!-- Loading -->
    <div v-if="loading" class="centered">
      <ProgressSpinner />
    </div>

    <Message v-else-if="error" severity="error" :closable="false" class="mb-4">
      {{ error }}
    </Message>

    <template v-else>
      <!-- ── Page header ────────────────────────────────────────────────── -->
      <div class="page-header">
        <Button
          icon="pi pi-arrow-left"
          text
          class="back-btn"
          aria-label="Back to kanban"
          @click="router.push({ name: 'kanban', params: { id: projectId, sprintId } })"
        />
        <div class="header-content">
          <div>
            <h1 class="page-title">
              <i class="pi pi-comments title-icon" />
              Retrospective
            </h1>
            <p v-if="sprintName" class="page-subtitle">{{ sprintName }}</p>
          </div>
          <div class="header-actions">
            <span v-if="saving" class="saving-badge">
              <i class="pi pi-spin pi-spinner" /> Saving…
            </span>
            <Button
              label="Sprint Review"
              icon="pi pi-chart-bar"
              text
              @click="router.push({ name: 'sprint-review', params: { id: projectId, sprintId } })"
            />
          </div>
        </div>
      </div>

      <!-- ── Retro board ──────────────────────────────────────────────────── -->
      <div class="retro-board">
        <div
          v-for="col in columns"
          :key="col.key"
          class="retro-col"
          :class="col.accentClass"
        >
          <!-- Column header -->
          <div class="col-header">
            <span class="col-title">
              <i :class="col.icon" />
              {{ col.label }}
            </span>
            <span class="col-count">{{ notes[col.key].length }}</span>
          </div>

          <!-- Notes list -->
          <div class="notes-list">
            <div
              v-for="(note, index) in notes[col.key]"
              :key="index"
              class="note-item"
            >
              <div class="note-body">
                <span class="note-text">{{ note.text }}</span>
                <span class="note-author">
                  <i class="pi pi-user author-icon" />
                  {{ note.anonymous ? 'Anonymous' : note.author }}
                </span>
              </div>
              <button
                v-if="canRemove(note)"
                class="note-remove"
                title="Remove note"
                @click="removeNote(col.key, index)"
              >
                <i class="pi pi-times" />
              </button>
            </div>

            <div v-if="notes[col.key].length === 0" class="notes-empty">
              <i class="pi pi-inbox empty-icon" />
              <span>No notes yet</span>
            </div>
          </div>

          <!-- Add note area -->
          <div class="add-note-area">
            <div class="add-note-row">
              <InputText
                v-model="newNote[col.key]"
                :placeholder="col.inputPlaceholder"
                class="note-input"
                @keydown.enter="handleEnter(col.key, $event)"
              />
              <Button
                icon="pi pi-plus"
                class="add-btn"
                :disabled="!newNote[col.key].trim()"
                aria-label="Add note"
                @click="addNote(col.key)"
              />
            </div>
            <label class="anon-toggle">
              <Checkbox v-model="postAnonymous[col.key]" :binary="true" class="anon-checkbox" />
              <span class="anon-label">Post anonymously</span>
            </label>
          </div>
        </div>
      </div>
      <!-- ── AI Retro Summary ───────────────────────────────────────────────── -->
      <div class="summary-card">
        <div class="summary-header">
          <span class="summary-title">
            <i class="pi pi-sparkles" />
            AI Retrospective Summary
          </span>
          <Button
            :label="retroSummary ? 'Regenerate' : 'Generate Summary'"
            icon="pi pi-refresh"
            size="small"
            text
            :loading="generatingSummary"
            @click="generateRetroSummary"
          />
        </div>

        <div v-if="generatingSummary" class="centered-sm">
          <ProgressSpinner style="width:28px;height:28px" />
        </div>
        <Message v-else-if="summaryError" severity="error" :closable="false" class="summary-msg">
          {{ summaryError }}
        </Message>
        <div v-else-if="retroSummary" class="summary-text">{{ retroSummary }}</div>
        <div v-else class="summary-empty">
          <i class="pi pi-file-edit summary-empty-icon" />
          <p>Click <strong>Generate Summary</strong> to get an AI-written overview of the team's retrospective notes.</p>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.retro-page {
  min-height: 100vh;
  background: var(--su-bg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Header ────────────────────────────────────────────────────────────────── */

.page-header {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.back-btn { flex-shrink: 0; margin-top: 0.25rem; }

.header-content {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.page-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--su-purple-300);
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.8);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title-icon { color: var(--su-purple-400); }

.page-subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.85rem;
  color: var(--su-text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding-top: 0.25rem;
}

.saving-badge {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--su-text-muted);
}

/* ── Board ─────────────────────────────────────────────────────────────────── */

.retro-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  align-items: flex-start;
  flex: 1;
}

@media (max-width: 900px) {
  .retro-board { grid-template-columns: 1fr; }
}

.retro-col {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 0;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.1);
  overflow: hidden;
}

/* column accent top borders */
.col--success { border-top: 2px solid var(--su-success); }
.col--warn    { border-top: 2px solid var(--su-warning); }
.col--info    { border-top: 2px solid #38bdf8; }

.col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--su-border);
}

.col-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-text-muted);
}

.col-count {
  background: rgba(124, 58, 237, 0.2);
  color: var(--su-purple-300);
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.55rem;
  min-width: 1.4rem;
  text-align: center;
}

/* ── Notes ─────────────────────────────────────────────────────────────────── */

.notes-list {
  flex: 1;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 120px;
}

.note-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  background: var(--su-bg-elevated);
  border: 1px solid var(--su-border);
  border-radius: 7px;
  padding: 0.55rem 0.65rem;
  transition: border-color 0.15s;
}

.note-item:hover {
  border-color: var(--su-border-glow);
}

.note-text {
  flex: 1;
  font-size: 0.85rem;
  color: var(--su-text);
  line-height: 1.5;
  word-break: break-word;
}

.note-remove {
  flex-shrink: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--su-text-muted);
  padding: 0.1rem 0.2rem;
  border-radius: 4px;
  font-size: 0.7rem;
  transition: color 0.15s, background 0.15s;
  line-height: 1;
}

.note-remove:hover {
  color: var(--su-danger);
  background: rgba(239, 68, 68, 0.1);
}

.notes-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.5rem 0;
  color: var(--su-text-muted);
  font-size: 0.78rem;
}

.empty-icon {
  font-size: 1.4rem;
  opacity: 0.4;
}

.note-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.note-author {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: var(--su-text-muted);
}

.author-icon { font-size: 0.65rem; opacity: 0.7; }

/* ── Add note area ─────────────────────────────────────────────────────────── */

.add-note-area {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.6rem 0.75rem;
  border-top: 1px solid var(--su-border);
  background: var(--su-bg-elevated);
}

.add-note-row {
  display: flex;
  gap: 0.4rem;
}

.note-input {
  flex: 1;
  font-size: 0.82rem;
}

:deep(.note-input.p-inputtext) {
  background: var(--su-bg-surface);
  border-color: var(--su-border);
  color: var(--su-text);
  font-size: 0.82rem;
  padding: 0.4rem 0.65rem;
}

:deep(.note-input.p-inputtext:focus) {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3);
}

.add-btn { flex-shrink: 0; }

/* ── Anonymous toggle ──────────────────────────────────────────────────────── */

.anon-toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  user-select: none;
  width: fit-content;
}

.anon-label {
  font-size: 0.75rem;
  color: var(--su-text-muted);
}

.anon-toggle:hover .anon-label { color: var(--su-text); }

:deep(.anon-checkbox .p-checkbox-box) {
  background: var(--su-bg-surface);
  border-color: var(--su-border);
  width: 14px;
  height: 14px;
}

:deep(.anon-checkbox .p-checkbox-box.p-highlight) {
  background: rgba(124, 58, 237, 0.8);
  border-color: var(--su-border-glow);
}

/* ── AI Summary card ───────────────────────────────────────────────────────── */

.summary-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 10px;
  padding: 1.1rem 1.25rem;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.1);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.summary-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-purple-300);
}

.summary-text {
  font-size: 0.875rem;
  color: var(--su-text);
  line-height: 1.75;
  white-space: pre-wrap;
  background: var(--su-bg-elevated);
  border: 1px solid var(--su-border);
  border-radius: 8px;
  padding: 0.85rem 1rem;
}

.summary-msg { margin: 0; }

.summary-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1rem 0;
  text-align: center;
}

.summary-empty-icon {
  font-size: 1.5rem;
  color: var(--su-border-glow);
  opacity: 0.6;
}

.summary-empty p {
  margin: 0;
  font-size: 0.82rem;
  color: var(--su-text-muted);
}

/* ── Misc ──────────────────────────────────────────────────────────────────── */

.centered {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.centered-sm {
  display: flex;
  justify-content: center;
  padding: 0.75rem 0;
}

.mb-4 { margin-bottom: 1rem; }
</style>
