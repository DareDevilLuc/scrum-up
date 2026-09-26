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
    <div class="metric-card__header">
      <i v-if="icon" :class="['pi', icon, 'metric-card__icon']" />
      <span class="metric-card__title">{{ title }}</span>
    </div>
    <div class="metric-card__body">
      <div v-if="value !== undefined && value !== null" class="metric-card__value">
        {{ value }}
      </div>
      <!-- Slot for chart or custom content -->
      <slot />
    </div>
    <div v-if="subtitle" class="metric-card__subtitle">{{ subtitle }}</div>
  </div>
</template>

<style scoped>
.metric-card {
  background: var(--su-bg-surface);
  border: 1px solid var(--su-border);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 0 0 1px var(--su-border), 0 0 12px 2px rgba(124, 58, 237, 0.15);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.metric-card:hover {
  border-color: var(--su-border-glow);
  box-shadow: 0 0 0 1px var(--su-border-glow), 0 0 16px 4px rgba(124, 58, 237, 0.25);
}

.metric-card__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.metric-card__icon {
  font-size: 0.9rem;
  color: var(--su-purple-400);
}

.metric-card__title {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--su-text-muted);
}

.metric-card__body {
  flex: 1;
}

.metric-card__value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--su-purple-300);
  line-height: 1;
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.5);
}

.metric-card__subtitle {
  font-size: 0.8rem;
  color: var(--su-text-muted);
}
</style>
