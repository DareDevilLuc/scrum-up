<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Dropdown from 'primevue/dropdown'
import AutoComplete from 'primevue/autocomplete'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useProjectsStore } from '@/stores/projects'
import { useTeamsStore } from '@/stores/teams'
import type { ClientOption } from '@/stores/projects'

const router = useRouter()
const toast = useToast()
const projectsStore = useProjectsStore()
const teamsStore = useTeamsStore()

// ── Form state ────────────────────────────────────────────────────────────────
const projectName = ref('')
const requirements = ref('')
const startDate = ref('')
const endDate = ref('')
const selectedTeamId = ref<string | null>(null)

// Client autocomplete
const clientQuery = ref('')
const selectedClient = ref<ClientOption | null>(null)
const clientContactEmail = ref('')
const clientSuggestions = ref<ClientOption[]>([])

const submitting = ref(false)
const validationError = ref<string | null>(null)

// ── Data loading ──────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([teamsStore.fetchMyTeams(), projectsStore.fetchClients()])
})

const teamOptions = computed(() =>
  teamsStore.myTeams.map((t) => ({ label: t.name, value: t.id }))
)

// ── Client autocomplete ───────────────────────────────────────────────────────
function searchClients(event: { query: string }) {
  const q = event.query.toLowerCase()
  clientSuggestions.value = projectsStore.clients.filter((c) =>
    c.name.toLowerCase().includes(q)
  )
}

function onClientSelect(event: { value: ClientOption }) {
  selectedClient.value = event.value
  clientContactEmail.value = event.value.contact_email ?? ''
}

/** True when the entered name matches no existing client — will create a new one */
const isNewClient = computed(() => {
  if (!clientQuery.value.trim()) return false
  return !projectsStore.clients.some(
    (c) => c.name.toLowerCase() === clientQuery.value.trim().toLowerCase()
  )
})

// ── Validation ────────────────────────────────────────────────────────────────
function validate(): boolean {
  if (!projectName.value.trim()) {
    validationError.value = 'Project name is required.'
    return false
  }
  if (!requirements.value.trim()) {
    validationError.value = 'Requirements are required.'
    return false
  }
  if (!selectedTeamId.value) {
    validationError.value = 'Please assign a team to this project.'
    return false
  }
  if (!startDate.value) {
    validationError.value = 'Start date is required.'
    return false
  }
  if (!endDate.value) {
    validationError.value = 'End date is required.'
    return false
  }
  if (new Date(endDate.value) <= new Date(startDate.value)) {
    validationError.value = 'End date must be after start date.'
    return false
  }
  validationError.value = null
  return true
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function submit() {
  if (!validate()) return

  submitting.value = true
  try {
    const newId = await projectsStore.createProject({
      name: projectName.value.trim(),
      requirements: requirements.value.trim(),
      team_id: selectedTeamId.value!,
      start_date: startDate.value,
      end_date: endDate.value,
      // existing client
      ...(selectedClient.value ? { client_id: selectedClient.value.id } : {}),
      // new client
      ...(isNewClient.value
        ? {
            client_name: clientQuery.value.trim(),
            client_contact_email: clientContactEmail.value.trim() || undefined,
          }
        : {}),
    })

    if (!newId) {
      toast.add({ severity: 'error', summary: 'Error', detail: projectsStore.error ?? 'Failed to create project.', life: 4000 })
      return
    }

    toast.add({ severity: 'success', summary: 'Project created', detail: projectName.value, life: 3000 })
    router.push({ name: 'project-detail', params: { id: newId } })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="create-project-view">
    <div class="page-header">
      <Button icon="pi pi-arrow-left" text @click="router.push({ name: 'projects' })" class="back-btn" />
      <div>
        <h1 class="page-title">New Project</h1>
        <p class="page-subtitle">Fill in the details to create a new project.</p>
      </div>
    </div>

    <div class="form-card">
      <Message v-if="validationError" severity="error" :closable="false" class="mb-4">
        {{ validationError }}
      </Message>
      <Message v-if="projectsStore.error" severity="error" :closable="false" class="mb-4">
        {{ projectsStore.error }}
      </Message>

      <!-- Section: Project Info -->
      <section class="form-section">
        <h2 class="section-title">Project Details</h2>

        <div class="field">
          <label class="field-label">Project Name <span class="required">*</span></label>
          <InputText
            v-model="projectName"
            placeholder="e.g. Customer Portal v2"
            class="w-full"
          />
        </div>

        <div class="field">
          <label class="field-label">Requirements <span class="required">*</span></label>
          <Textarea
            v-model="requirements"
            placeholder="Describe the project goals, scope, and key requirements…"
            rows="6"
            class="w-full requirements-textarea"
            autoResize
          />
        </div>
      </section>

      <!-- Section: Timeline -->
      <section class="form-section">
        <h2 class="section-title">Timeline</h2>
        <div class="date-row">
          <div class="field">
            <label class="field-label">Start Date <span class="required">*</span></label>
            <InputText
              v-model="startDate"
              type="date"
              class="w-full"
            />
          </div>
          <div class="field">
            <label class="field-label">End Date <span class="required">*</span></label>
            <InputText
              v-model="endDate"
              type="date"
              class="w-full"
            />
          </div>
        </div>
      </section>

      <!-- Section: Client -->
      <section class="form-section">
        <h2 class="section-title">Client <span class="optional">(optional)</span></h2>

        <div class="field">
          <label class="field-label">Client Name</label>
          <AutoComplete
            v-model="clientQuery"
            :suggestions="clientSuggestions"
            optionLabel="name"
            placeholder="Search or enter a new client name…"
            class="w-full"
            @complete="searchClients"
            @option-select="onClientSelect"
            @clear="selectedClient = null"
            forceSelection
          />
          <span v-if="isNewClient" class="new-client-hint">
            <i class="pi pi-plus-circle" /> New client will be created
          </span>
        </div>

        <div v-if="isNewClient || selectedClient" class="field">
          <label class="field-label">Contact Email</label>
          <InputText
            v-model="clientContactEmail"
            type="email"
            placeholder="client@example.com"
            class="w-full"
            :disabled="!!selectedClient"
          />
        </div>
      </section>

      <!-- Section: Team -->
      <section class="form-section">
        <h2 class="section-title">Team Assignment <span class="required-section">*</span></h2>

        <div class="field">
          <label class="field-label">Team <span class="required">*</span></label>
          <Dropdown
            v-model="selectedTeamId"
            :options="teamOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Select a team…"
            class="w-full"
            :loading="teamsStore.loading"
          />
          <span v-if="teamOptions.length === 0 && !teamsStore.loading" class="field-hint">
            You are not a member of any teams yet.
          </span>
        </div>
      </section>

      <!-- Actions -->
      <div class="form-actions">
        <Button
          label="Cancel"
          text
          @click="router.push({ name: 'projects' })"
          :disabled="submitting"
        />
        <Button
          label="Create Project"
          icon="pi pi-check"
          :loading="submitting"
          @click="submit"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.create-project-view {
  padding: 2rem;
  background: var(--su-bg);
  min-height: 100vh;
  max-width: 760px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.back-btn {
  margin-top: 0.2rem;
  flex-shrink: 0;
}

.page-title {
  font-size: 1.75rem;
  font-weight: 800;
  margin: 0 0 0.25rem;
  color: var(--su-purple-300);
  text-shadow: 0 0 10px rgba(168, 85, 247, 0.6);
}

.page-subtitle {
  margin: 0;
  color: var(--su-text-muted);
  font-size: 0.9rem;
}

.form-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.15);
}

.form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--su-border);
}

.form-section:last-of-type {
  border-bottom: none;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--su-purple-300);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 1.25rem;
}

.optional,
.required-section {
  font-size: 0.8rem;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  color: var(--su-text-muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.25rem;
}

.field:last-child {
  margin-bottom: 0;
}

.field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--su-text-muted);
}

.required {
  color: var(--su-danger);
}

.field-hint {
  font-size: 0.8rem;
  color: var(--su-text-muted);
}

.new-client-hint {
  font-size: 0.8rem;
  color: var(--su-purple-300);
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.date-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.requirements-textarea {
  resize: vertical;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.w-full {
  width: 100%;
}

.mb-4 {
  margin-bottom: 1rem;
}

/* Override AutoComplete width */
:deep(.p-autocomplete) {
  width: 100%;
}
:deep(.p-autocomplete-input) {
  width: 100%;
}
:deep(.p-textarea) {
  background: var(--su-bg-elevated) !important;
  border-color: var(--su-border) !important;
  color: var(--su-text) !important;
  border-radius: 6px !important;
}
:deep(.p-textarea:focus) {
  border-color: var(--su-border-glow) !important;
  box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.3) !important;
}
:deep(.p-autocomplete-panel) {
  background: var(--su-bg-elevated) !important;
  border: 1px solid var(--su-border-glow) !important;
  box-shadow: 0 0 20px 4px rgba(124, 58, 237, 0.25) !important;
}
:deep(.p-autocomplete-item) {
  color: var(--su-text) !important;
}
:deep(.p-autocomplete-item:hover) {
  background: rgba(124, 58, 237, 0.15) !important;
  color: var(--su-purple-300) !important;
}
</style>
