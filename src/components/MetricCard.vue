<script setup lang="ts">
defineProps<{
  title: string
  value?: string | number | null
  subtitle?: string
  icon?: string
}>()
</script>

<template>
  <div class="metric-card">
    <div class="metric-header">
      <i v-if="icon" :class="['pi', icon, 'metric-icon']" />
      <span class="metric-title">{{ title }}</span>
    </div>
    <div class="metric-value">{{ value ?? '—' }}</div>
    <div v-if="subtitle" class="metric-subtitle">{{ subtitle }}</div>
    <!-- Slot for chart content (filled in Sub-Task 12) -->
    <slot />
  </div>
</template>

<style scoped>
.metric-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 0 12px 2px rgba(124, 58, 237, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.metric-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 16px 4px rgba(124, 58, 237, 0.2);
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.metric-icon {
  color: var(--su-purple-400);
  font-size: 0.9rem;
}

.metric-title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--su-text-muted);
}

.metric-value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--su-purple-300);
  line-height: 1;
}

.metric-subtitle {
  font-size: 0.78rem;
  color: var(--su-text-muted);
}
</style>
