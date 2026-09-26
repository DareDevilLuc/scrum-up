<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { BurndownPoint } from '@/composables/useSprintMetrics'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const props = defineProps<{
  series: BurndownPoint[]
  totalPoints: number
}>()

const chartData = computed(() => ({
  labels: props.series.map((p) => p.date.slice(5)), // 'MM-DD'
  datasets: [
    {
      label: 'Remaining Points',
      data: props.series.map((p) => p.remaining),
      borderColor: '#a855f7',
      backgroundColor: 'rgba(168, 85, 247, 0.12)',
      borderWidth: 2,
      pointBackgroundColor: '#a855f7',
      pointRadius: 3,
      fill: true,
      tension: 0.3,
    },
    {
      label: 'Ideal',
      data: props.series.map((_, i) => {
        if (props.series.length < 2) return props.totalPoints
        const step = props.totalPoints / (props.series.length - 1)
        return Math.round(props.totalPoints - step * i)
      }),
      borderColor: 'rgba(139, 122, 171, 0.35)',
      borderWidth: 1,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#8b7aab', font: { size: 11 } },
    },
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
    <Line v-if="series.length" :data="chartData" :options="options" />
    <div v-else class="chart-empty">No data yet</div>
  </div>
</template>

<style scoped>
.chart-wrap { height: 160px; width: 100%; }
.chart-empty { display: flex; align-items: center; justify-content: center; height: 160px; color: var(--su-text-muted); font-size: 0.82rem; }
</style>
