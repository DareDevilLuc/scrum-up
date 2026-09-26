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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export interface VelocityPoint {
  sprintName: string
  storyPoints: number
}

const props = defineProps<{
  sprints: VelocityPoint[]
}>()

const chartData = computed(() => ({
  labels: props.sprints.map((s) => s.sprintName),
  datasets: [
    {
      label: 'Story Points Completed',
      data: props.sprints.map((s) => s.storyPoints),
      backgroundColor: 'rgba(124, 58, 237, 0.6)',
      borderColor: '#a855f7',
      borderWidth: 1,
      borderRadius: 4,
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
      titleColor: '#c084fc',
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
      ticks: { color: '#8b7aab', font: { size: 10 } },
      grid: { color: 'rgba(42, 26, 78, 0.6)' },
    },
  },
}
</script>

<template>
  <div class="chart-wrap">
    <Bar v-if="sprints.length" :data="chartData" :options="options" />
    <div v-else class="chart-empty">No completed sprints yet</div>
  </div>
</template>

<style scoped>
.chart-wrap { height: 160px; width: 100%; }
.chart-empty { display: flex; align-items: center; justify-content: center; height: 160px; color: var(--su-text-muted); font-size: 0.82rem; }
</style>
