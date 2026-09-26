<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useConfirm } from 'primevue/useconfirm'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import type { Team } from '@/stores/admin'

const adminStore = useAdminStore()
const authStore = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

// ── Create / Edit dialog ──────────────────────────────────────────────────────
const dialogVisible = ref(false)
const isEditMode = ref(false)
const editingTeam = ref<Team | null>(null)
const teamName = ref('')
const selectedMemberIds = ref<string[]>([])
const dialogLoading = ref(false)

const userOptions = computed(() =>
  adminStore.users.map((u) => ({
    label: u.display_name ?? u.github_username ?? u.id,
    value: u.id,
  })),
)

function openCreateDialog() {
  isEditMode.value = false
  editingTeam.value = null
  teamName.value = ''
  selectedMemberIds.value = []
  dialogVisible.value = true
}

function openEditDialog(team: Team) {
  isEditMode.value = true
  editingTeam.value = team
  teamName.value = team.name
  selectedMemberIds.value = []
  dialogVisible.value = true
}

async function submitDialog() {
  if (!teamName.value.trim()) return

  dialogLoading.value = true

  if (isEditMode.value && editingTeam.value) {
    const ok = await adminStore.updateTeam(editingTeam.value.id, teamName.value.trim())
    dialogLoading.value = false
    if (ok) {
      toast.add({ severity: 'success', summary: 'Team updated', life: 3000 })
      dialogVisible.value = false
    } else {
      toast.add({ severity: 'error', summary: 'Failed', detail: adminStore.error ?? '', life: 4000 })
    }
  } else {
    const team = await adminStore.createTeam(
      teamName.value.trim(),
      selectedMemberIds.value,
      authStore.user!.id,
    )
    dialogLoading.value = false
    if (team) {
      toast.add({ severity: 'success', summary: 'Team created', life: 3000 })
      dialogVisible.value = false
    } else {
      toast.add({ severity: 'error', summary: 'Failed', detail: adminStore.error ?? '', life: 4000 })
    }
  }
}

function confirmDeleteTeam(team: Team) {
  confirm.require({
    message: `Delete team "${team.name}"? This cannot be undone.`,
    header: 'Confirm deletion',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      const ok = await adminStore.deleteTeam(team.id)
      if (ok) {
        toast.add({ severity: 'success', summary: 'Team deleted', life: 3000 })
      } else {
        toast.add({ severity: 'error', summary: 'Failed', detail: adminStore.error ?? '', life: 4000 })
      }
    },
  })
}

onMounted(async () => {
  await Promise.all([adminStore.fetchTeams(), adminStore.fetchUsers()])
})
</script>

<template>
  <div>
    <div class="page-header">
      <div>
        <h2 class="page-title">Teams</h2>
        <p class="page-subtitle">Create and manage teams. Members are assigned to teams by super-admins.</p>
      </div>
      <Button label="New Team" icon="pi pi-plus" @click="openCreateDialog" />
    </div>

    <Message v-if="adminStore.error" severity="error" :closable="false" class="mb-4">
      {{ adminStore.error }}
    </Message>

    <div v-if="adminStore.loading && adminStore.teams.length === 0" class="spinner-wrap">
      <ProgressSpinner />
    </div>

    <DataTable
      v-else
      :value="adminStore.teams"
      paginator
      :rows="15"
      stripedRows
      tableStyle="min-width: 32rem"
    >
      <Column field="name" header="Team Name" style="min-width: 12rem" />

      <Column header="Members" style="min-width: 8rem">
        <template #body="{ data }: { data: Team }">
          <Tag :value="`${data.member_count ?? 0} member${(data.member_count ?? 0) === 1 ? '' : 's'}`" severity="secondary" />
        </template>
      </Column>

      <Column header="Created" style="min-width: 10rem">
        <template #body="{ data }: { data: Team }">
          {{ new Date(data.created_at).toLocaleDateString() }}
        </template>
      </Column>

      <Column header="" style="width: 10rem">
        <template #body="{ data }: { data: Team }">
          <div class="action-cell">
            <Button
              icon="pi pi-pencil"
              rounded
              text
              size="small"
              @click="openEditDialog(data)"
            />
            <Button
              icon="pi pi-trash"
              rounded
              text
              size="small"
              severity="danger"
              @click="confirmDeleteTeam(data)"
            />
          </div>
        </template>
      </Column>
    </DataTable>
  </div>

  <!-- Create / Edit Team Dialog -->
  <Dialog
    v-model:visible="dialogVisible"
    modal
    :header="isEditMode ? 'Edit Team' : 'Create Team'"
    :style="{ width: '28rem' }"
  >
    <div class="team-form">
      <div class="form-field">
        <label for="team-name">Team name</label>
        <InputText
          id="team-name"
          v-model="teamName"
          placeholder="e.g. Platform Team"
          class="w-full"
          @keyup.enter="submitDialog"
        />
      </div>

      <div v-if="!isEditMode" class="form-field">
        <label>Members (optional)</label>
        <MultiSelect
          v-model="selectedMemberIds"
          :options="userOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select team members"
          display="chip"
          :filter="true"
          class="w-full"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="dialogVisible = false" />
      <Button
        :label="isEditMode ? 'Save' : 'Create'"
        icon="pi pi-check"
        :loading="dialogLoading"
        :disabled="!teamName.trim()"
        @click="submitDialog"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
}
.page-title {
  font-size: 1.5rem;
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
.spinner-wrap {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}
.action-cell {
  display: flex;
  gap: 0.25rem;
}
.team-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.form-field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--su-text);
}
.mb-4 {
  margin-bottom: 1rem;
}
</style>
