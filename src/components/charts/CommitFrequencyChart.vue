<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { GitHubCommitDay } from '@/composables/useSprintMetrics'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps<{
  days: GitHubCommitDay[]
}>()

const chartData = computed(() => ({
  labels: props.days.map((d) => d.date.slice(5)), // 'MM-DD'
  datasets: [
    {
      label: 'Commits',
      data: props.days.map((d) => d.count),
      backgroundColor: 'rgba(34, 197, 94, 0.5)',
      borderColor: '#22c55e',
      borderWidth: 1,
      borderRadius: 3,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#14142a',
      borderColor: '#2a1a4e',
      borderWidth: 1,
      titleColor: '#22c55e',
      bodyColor: '#e2d9f3',
    },
  },
  scales: {
    x: {
      ticks: { color: '#8b7aab', font: { size: 10 } },
      grid: { color: 'rgba(42, 26, 78, 0.6)' },
    },
    y: {
      beginAtZero: true,
      ticks: { color: '#8b7aab', font: { size: 10 }, stepSize: 1 },
      grid: { color: 'rgba(42, 26, 78, 0.6)' },
    },
  },
}
</script>

<template>
  <div class="chart-wrap">
    <Bar v-if="days.length" :data="chartData" :options="options" />
    <div v-else class="chart-empty">No GitHub data — link a repo and refresh</div>
  </div>
</template>

<style scoped>
.chart-wrap { height: 160px; width: 100%; }
.chart-empty { display: flex; align-items: center; justify-content: center; height: 160px; color: var(--su-text-muted); font-size: 0.82rem; text-align: center; padding: 0 1rem; }
</style>
