<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { CompletionCounts } from '@/composables/useSprintMetrics'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  counts: CompletionCounts
}>()

const chartData = computed(() => ({
  labels: ['Done', 'In Progress', 'To Do'],
  datasets: [
    {
      data: [props.counts.done, props.counts.in_progress, props.counts.todo],
      backgroundColor: [
        'rgba(34, 197, 94, 0.7)',
        'rgba(168, 85, 247, 0.7)',
        'rgba(42, 26, 78, 0.9)',
      ],
      borderColor: [
        '#22c55e',
        '#a855f7',
        '#2a1a4e',
      ],
      borderWidth: 1,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { color: '#8b7aab', font: { size: 10 }, padding: 8 },
    },
    tooltip: {
      backgroundColor: '#14142a',
      borderColor: '#2a1a4e',
      borderWidth: 1,
      titleColor: '#c084fc',
      bodyColor: '#e2d9f3',
    },
  },
}
</script>

<template>
  <div class="ring-wrap">
    <template v-if="counts.total > 0">
      <Doughnut :data="chartData" :options="options" />
      <div class="center-label">
        <span class="percent">{{ counts.percent }}%</span>
        <span class="label">done</span>
      </div>
    </template>
    <div v-else class="chart-empty">No tasks yet</div>
  </div>
</template>

<style scoped>
.ring-wrap {
  position: relative;
  height: 160px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.center-label {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
}
.percent {
  font-size: 1.4rem;
  font-weight: 800;
  color: var(--su-purple-300);
  line-height: 1;
}
.label {
  font-size: 0.65rem;
  color: var(--su-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.chart-empty { display: flex; align-items: center; justify-content: center; height: 160px; color: var(--su-text-muted); font-size: 0.82rem; }
</style>
