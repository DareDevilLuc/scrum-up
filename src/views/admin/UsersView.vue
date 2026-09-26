<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Dropdown from 'primevue/dropdown'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Avatar from 'primevue/avatar'
import { useConfirm } from 'primevue/useconfirm'
import { useAdminStore } from '@/stores/admin'
import type { AdminUser, UserRole } from '@/stores/admin'

const adminStore = useAdminStore()
const toast = useToast()
const confirm = useConfirm()

// ── Assign Role Dialog ────────────────────────────────────────────────────────
const dialogVisible = ref(false)
const selectedUser = ref<AdminUser | null>(null)
const newRole = ref<'super_admin' | 'project_head' | 'developer' | null>(null)
const newScopeTeamId = ref<string | null>(null)
const dialogLoading = ref(false)

const roleOptions = [
  { label: 'Super Admin', value: 'super_admin' },
  { label: 'Project Head', value: 'project_head' },
  { label: 'Developer', value: 'developer' },
]

const teamOptions = adminStore.teams.map((t) => ({ label: t.name, value: t.id }))

function openAssignDialog(user: AdminUser) {
  selectedUser.value = user
  newRole.value = null
  newScopeTeamId.value = null
  dialogVisible.value = true
}

async function submitAssignRole() {
  if (!selectedUser.value || !newRole.value) return

  dialogLoading.value = true
  const ok = await adminStore.assignRole(
    selectedUser.value.id,
    newRole.value,
    newRole.value === 'project_head' ? newScopeTeamId.value : null,
  )
  dialogLoading.value = false

  if (ok) {
    toast.add({ severity: 'success', summary: 'Role assigned', life: 3000 })
    dialogVisible.value = false
  } else {
    toast.add({ severity: 'error', summary: 'Failed', detail: adminStore.error ?? 'Unknown error', life: 4000 })
  }
}

function confirmRemoveRole(role: UserRole, user: AdminUser) {
  confirm.require({
    message: `Remove the "${role.role}" role from ${user.display_name ?? user.github_username ?? 'this user'}?`,
    header: 'Confirm removal',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      const ok = await adminStore.removeRole(role.id, user.id)
      if (ok) {
        toast.add({ severity: 'success', summary: 'Role removed', life: 3000 })
      } else {
        toast.add({ severity: 'error', summary: 'Failed', detail: adminStore.error ?? '', life: 4000 })
      }
    },
  })
}

function roleSeverity(role: string): 'danger' | 'warn' | 'info' {
  if (role === 'super_admin') return 'danger'
  if (role === 'project_head') return 'warn'
  return 'info'
}

onMounted(async () => {
  await Promise.all([adminStore.fetchUsers(), adminStore.fetchTeams()])
})
</script>

<template>
  <div>
    <div class="page-header">
      <h2 class="page-title">Users</h2>
      <p class="page-subtitle">Manage user roles across the platform.</p>
    </div>

    <Message v-if="adminStore.error" severity="error" :closable="false" class="mb-4">
      {{ adminStore.error }}
    </Message>

    <div v-if="adminStore.loading && adminStore.users.length === 0" class="spinner-wrap">
      <ProgressSpinner />
    </div>

    <DataTable
      v-else
      :value="adminStore.users"
      paginator
      :rows="15"
      stripedRows
      tableStyle="min-width: 42rem"
    >
      <Column header="User" style="min-width: 14rem">
        <template #body="{ data }: { data: AdminUser }">
          <div class="user-cell">
            <Avatar
              :image="data.avatar_url ?? undefined"
              :label="data.display_name?.[0] ?? '?'"
              shape="circle"
              size="normal"
            />
            <div>
              <div class="user-name">{{ data.display_name ?? '—' }}</div>
              <div class="user-github">@{{ data.github_username ?? '—' }}</div>
            </div>
          </div>
        </template>
      </Column>

      <Column header="Roles" style="min-width: 16rem">
        <template #body="{ data }: { data: AdminUser }">
          <div class="roles-cell">
            <span v-if="data.roles.length === 0" class="no-roles">No roles</span>
            <span
              v-for="r in data.roles"
              :key="r.id"
              class="role-badge-wrap"
            >
              <Tag :severity="roleSeverity(r.role)" :value="r.role.replace('_', ' ')" />
              <span v-if="r.scope_type !== 'global'" class="role-scope">
                ({{ r.scope_type }})
              </span>
              <Button
                icon="pi pi-times"
                rounded
                text
                size="small"
                severity="secondary"
                class="remove-role-btn"
                @click="confirmRemoveRole(r, data)"
              />
            </span>
          </div>
        </template>
      </Column>

      <Column header="Joined" style="min-width: 10rem">
        <template #body="{ data }: { data: AdminUser }">
          {{ new Date(data.created_at).toLocaleDateString() }}
        </template>
      </Column>

      <Column header="" style="width: 8rem">
        <template #body="{ data }: { data: AdminUser }">
          <Button
            label="Assign Role"
            icon="pi pi-user-plus"
            size="small"
            outlined
            @click="openAssignDialog(data)"
          />
        </template>
      </Column>
    </DataTable>
  </div>

  <!-- Assign Role Dialog -->
  <Dialog
    v-model:visible="dialogVisible"
    modal
    header="Assign Role"
    :style="{ width: '26rem' }"
  >
    <div v-if="selectedUser" class="assign-form">
      <p class="assign-target">
        Assigning role to
        <strong>{{ selectedUser.display_name ?? selectedUser.github_username }}</strong>
      </p>

      <div class="form-field">
        <label>Role</label>
        <Dropdown
          v-model="newRole"
          :options="roleOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select a role"
          class="w-full"
        />
      </div>

      <div v-if="newRole === 'project_head'" class="form-field">
        <label>Team scope</label>
        <Dropdown
          v-model="newScopeTeamId"
          :options="teamOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="Select a team (optional)"
          :showClear="true"
          class="w-full"
        />
      </div>
    </div>

    <template #footer>
      <Button label="Cancel" text @click="dialogVisible = false" />
      <Button
        label="Assign"
        icon="pi pi-check"
        :loading="dialogLoading"
        :disabled="!newRole"
        @click="submitAssignRole"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.page-header {
  margin-bottom: 1.5rem;
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
.user-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.user-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--su-text);
}
.user-github {
  font-size: 0.8rem;
  color: var(--su-text-muted);
}
.roles-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
.role-badge-wrap {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
}
.role-scope {
  font-size: 0.75rem;
  color: var(--su-text-muted);
}
.remove-role-btn {
  padding: 0 !important;
  width: 1.4rem !important;
  height: 1.4rem !important;
}
.no-roles {
  color: var(--su-text-muted);
  font-size: 0.85rem;
}
.assign-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.assign-target {
  margin: 0;
  font-size: 0.9rem;
  color: var(--su-text);
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
