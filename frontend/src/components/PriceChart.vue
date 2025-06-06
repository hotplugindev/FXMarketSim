<template>
  <div class="price-chart">
    <div class="chart-header">
      <h3>{{ marketStore.currentPrice.symbol }} Price Chart</h3>
      <div class="timeframe-selector">
        <button
          v-for="tf in timeframes"
          :key="tf.value"
          @click="setTimeframe(tf.value)"
          :class="['timeframe-btn', { active: marketStore.timeframe === tf.value }]"
        >
          {{ tf.label }}
        </button>
      </div>
    </div>
    
    <div class="chart-container">
      <div class="chart-canvas-wrapper">
        <Line
          v-if="chartData"
          :data="chartData"
          :options="chartOptions"
        />
      </div>
    </div>
    
    <div class="chart-stats">
      <div class="stat-item">
        <span class="label">Last:</span>
        <span class="value">{{ lastPrice.toFixed(5) }}</span>
      </div>
      <div class="stat-item">
        <span class="label">Change:</span>
        <span :class="['value', priceChange >= 0 ? 'positive' : 'negative']">
          {{ priceChange.toFixed(5) }} ({{ changePercent.toFixed(2) }}%)
        </span>
      </div>
      <div class="stat-item">
        <span class="label">Volume:</span>
        <span class="value">{{ formatVolume(marketStore.currentPrice.volume) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
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
  Filler
} from 'chart.js'
import { useMarketStore } from '../stores/market'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const marketStore = useMarketStore()

const timeframes = [
  { label: '1M', value: '1m' },
  { label: '5M', value: '5m' },
  { label: '15M', value: '15m' },
  { label: '1H', value: '1h' },
  { label: '4H', value: '4h' },
  { label: '1D', value: '1d' }
]

const chartData = computed(() => {
  if (!marketStore.priceHistory.length) return null
  
  const history = marketStore.priceHistory.slice(-100) // Last 100 points
  
  return {
    labels: history.map(point => {
      const date = new Date(point.timestamp * 1000)
      return date.toLocaleTimeString()
    }),
    datasets: [
      {
        label: 'Price',
        data: history.map(point => point.price),
        borderColor: '#00ff88',
        backgroundColor: 'rgba(0, 255, 136, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 4
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  resizeDelay: 0,
  interaction: {
    intersect: false,
    mode: 'index'
  },
  layout: {
    padding: 10
  },
  scales: {
    x: {
      display: true,
      grid: {
        color: '#444',
        borderColor: '#666'
      },
      ticks: {
        color: '#ccc',
        maxTicksLimit: 10
      }
    },
    y: {
      display: true,
      position: 'right',
      grid: {
        color: '#444',
        borderColor: '#666'
      },
      ticks: {
        color: '#ccc',
        callback: function(value) {
          return value.toFixed(5)
        }
      }
    }
  },
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: '#2d2d2d',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: '#555',
      borderWidth: 1,
      callbacks: {
        label: function(context) {
          return `Price: ${context.parsed.y.toFixed(5)}`
        }
      }
    }
  },
  elements: {
    point: {
      hoverBackgroundColor: '#00ff88'
    }
  }
}

const lastPrice = computed(() => {
  if (!marketStore.priceHistory.length) return 0
  return marketStore.priceHistory[marketStore.priceHistory.length - 1]?.price || 0
})

const priceChange = computed(() => {
  if (marketStore.priceHistory.length < 2) return 0
  const current = lastPrice.value
  const previous = marketStore.priceHistory[marketStore.priceHistory.length - 2]?.price || current
  return current - previous
})

const changePercent = computed(() => {
  if (marketStore.priceHistory.length < 2) return 0
  const previous = marketStore.priceHistory[marketStore.priceHistory.length - 2]?.price || lastPrice.value
  if (previous === 0) return 0
  return (priceChange.value / previous) * 100
})

const setTimeframe = (timeframe) => {
  marketStore.setTimeframe(timeframe)
}

const formatVolume = (volume) => {
  if (volume >= 1000000) {
    return (volume / 1000000).toFixed(1) + 'M'
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(1) + 'K'
  }
  return volume.toFixed(0)
}
</script>

<style scoped>
.price-chart {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #444;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.chart-header h3 {
  margin: 0;
  color: #00ff88;
  font-size: 1.4rem;
}

.timeframe-selector {
  display: flex;
  gap: 0.5rem;
}

.timeframe-btn {
  padding: 0.6rem 1rem;
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #ccc;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.timeframe-btn:hover {
  background: #333;
  border-color: #777;
}

.timeframe-btn.active {
  background: #00ff88;
  color: #000;
  border-color: #00ff88;
}

.chart-container {
  flex: 1;
  min-height: 500px;
  height: 100%;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chart-canvas-wrapper {
  flex: 1;
  position: relative;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.chart-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #444;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.label {
  color: #888;
  font-size: 0.95rem;
}

.value {
  color: #fff;
  font-weight: 600;
  font-size: 1.1rem;
}

.value.positive {
  color: #00ff88;
}

.value.negative {
  color: #ff6b6b;
}

@media (max-width: 768px) {
  .chart-header {
    flex-direction: column;
    align-items: stretch;
  }
  
  .timeframe-selector {
    justify-content: center;
  }
  
  .chart-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>