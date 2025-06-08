<template>
  <div class="price-chart">
    <div class="chart-header">
      <div class="chart-title">
        <h3>{{ marketStore.selectedSymbol }} Price Chart</h3>
        <div class="chart-controls">
          <select v-model="selectedSymbol" @change="updateSymbol" class="symbol-selector">
            <option
              v-for="symbol in availableSymbols"
              :key="symbol"
              :value="symbol"
            >
              {{ symbol.slice(0, 3) }}/{{ symbol.slice(3) }}
            </option>
          </select>
          <div class="chart-type-selector">
            <button
              @click="setChartType('line')"
              :class="['chart-type-btn', { active: marketStore.chartType === 'line' }]"
            >
              Line
            </button>
            <button
              @click="setChartType('candlestick')"
              :class="['chart-type-btn', { active: marketStore.chartType === 'candlestick' }]"
            >
              Candles
            </button>
          </div>
        </div>
      </div>
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
          v-if="chartData && marketStore.chartType === 'line'"
          :data="chartData"
          :options="chartOptions"
        />
        <canvas
          v-else-if="marketStore.chartType === 'candlestick'"
          ref="candlestickCanvas"
          style="width: 100%; height: 100%; display: block;"
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
        <span class="value">{{ formatVolume(marketStore.currentPrice.volume || 0) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
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
const selectedSymbol = ref(marketStore.selectedSymbol)
const availableSymbols = computed(() => marketStore.marketEngineStore.config.symbols)
const candlestickCanvas = ref(null)
const candlestickChart = ref(null)
const updateInterval = ref(null)
const resizeObserver = ref(null)

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
  
  const history = marketStore.priceHistory.slice(-100)
  
  return {
    labels: history.map(point => {
      const date = new Date(point.timestamp * 1000)
      // Format time based on timeframe
      if (marketStore.timeframe === '1d') {
        return date.toLocaleDateString()
      } else if (marketStore.timeframe === '4h' || marketStore.timeframe === '1h') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      } else {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    }),
    datasets: [
      {
        label: 'Price',
        data: history.map(point => point.close),
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

const createCandlestickChart = () => {
  console.log('Creating candlestick chart...')
  console.log('Canvas ref:', candlestickCanvas.value)
  console.log('Price history length:', marketStore.priceHistory.length)
  console.log('Price history:', marketStore.priceHistory)
  
  if (!candlestickCanvas.value || !marketStore.priceHistory.length) {
    console.log('Early return: missing canvas or history')
    return
  }
  
  const canvas = candlestickCanvas.value
  const ctx = canvas.getContext('2d')
  const history = marketStore.priceHistory.slice(-50) // Show last 50 candles
  
  if (history.length === 0) {
    console.log('Early return: empty history after slice')
    return
  }
  
  console.log('Drawing candles for', history.length, 'data points')
  
  // Set canvas size properly
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  
  // Reset any existing transforms
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  
  // Clear canvas
  ctx.clearRect(0, 0, rect.width, rect.height)
  
  const width = rect.width
  const height = rect.height
  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  
  // Find min and max prices
  let minPrice = Infinity
  let maxPrice = -Infinity
  
  history.forEach(candle => {
    minPrice = Math.min(minPrice, candle.low)
    maxPrice = Math.max(maxPrice, candle.high)
  })
  
  // Add some padding to price range
  const priceRange = maxPrice - minPrice
  minPrice -= priceRange * 0.1
  maxPrice += priceRange * 0.1
  const totalPriceRange = maxPrice - minPrice
  
  // Calculate candle width
  const candleWidth = Math.max(2, chartWidth / history.length * 0.8)
  const candleSpacing = chartWidth / history.length
  
  // Draw grid lines
  ctx.strokeStyle = '#444'
  ctx.lineWidth = 1
  
  // Horizontal grid lines
  for (let i = 0; i <= 5; i++) {
    const y = padding + (chartHeight / 5) * i
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
  }
  
  // Vertical grid lines
  for (let i = 0; i <= 10; i++) {
    const x = padding + (chartWidth / 10) * i
    ctx.beginPath()
    ctx.moveTo(x, padding)
    ctx.lineTo(x, height - padding)
    ctx.stroke()
  }
  
  // Draw price labels
  ctx.fillStyle = '#ccc'
  ctx.font = '12px Arial'
  ctx.textAlign = 'right'
  
  for (let i = 0; i <= 5; i++) {
    const price = maxPrice - (totalPriceRange / 5) * i
    const y = padding + (chartHeight / 5) * i
    ctx.fillText(price.toFixed(5), width - padding - 5, y + 4)
  }
  
  // Draw candlesticks
  history.forEach((candle, index) => {
    const x = padding + candleSpacing * index + candleSpacing / 2
    
    // Calculate y positions
    const highY = padding + ((maxPrice - candle.high) / totalPriceRange) * chartHeight
    const lowY = padding + ((maxPrice - candle.low) / totalPriceRange) * chartHeight
    const openY = padding + ((maxPrice - candle.open) / totalPriceRange) * chartHeight
    const closeY = padding + ((maxPrice - candle.close) / totalPriceRange) * chartHeight
    
    const isUp = candle.close >= candle.open
    const color = isUp ? '#00ff88' : '#ff6b6b'
    
    // Draw wick (high-low line)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, highY)
    ctx.lineTo(x, lowY)
    ctx.stroke()
    
    // Draw body (open-close rectangle)
    const bodyTop = Math.min(openY, closeY)
    const bodyHeight = Math.abs(closeY - openY)
    
    if (bodyHeight < 1) {
      // Doji - draw horizontal line
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x - candleWidth / 2, openY)
      ctx.lineTo(x + candleWidth / 2, openY)
      ctx.stroke()
    } else {
      if (isUp) {
        // Bullish candle - hollow
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight)
      } else {
        // Bearish candle - filled
        ctx.fillStyle = color
        ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight)
      }
    }
  })
  
  // Draw time labels
  ctx.fillStyle = '#ccc'
  ctx.font = '10px Arial'
  ctx.textAlign = 'center'
  
  const timeStep = Math.ceil(history.length / 8)
  for (let i = 0; i < history.length; i += timeStep) {
    const candle = history[i]
    const x = padding + candleSpacing * i + candleSpacing / 2
    const date = new Date(candle.timestamp * 1000)
    
    // Format time label based on timeframe
    let timeLabel
    if (marketStore.timeframe === '1d') {
      timeLabel = date.toLocaleDateString()
    } else if (marketStore.timeframe === '4h' || marketStore.timeframe === '1h') {
      timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      timeLabel = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    
    ctx.fillText(timeLabel, x, height - padding + 15)
  }
}

const updateCandlestickChart = () => {
  createCandlestickChart()
}

const lastPrice = computed(() => {
  if (!marketStore.priceHistory.length) return 0
  return marketStore.priceHistory[marketStore.priceHistory.length - 1]?.close || 0
})

const priceChange = computed(() => {
  if (marketStore.priceHistory.length < 2) return 0
  const current = lastPrice.value
  const previous = marketStore.priceHistory[marketStore.priceHistory.length - 2]?.close || current
  return current - previous
})

const changePercent = computed(() => {
  if (marketStore.priceHistory.length < 2) return 0
  const previous = marketStore.priceHistory[marketStore.priceHistory.length - 2]?.close || lastPrice.value
  if (previous === 0) return 0
  return (priceChange.value / previous) * 100
})

const setTimeframe = (timeframe) => {
  marketStore.setTimeframe(timeframe)
}

const setChartType = (type) => {
  marketStore.setChartType(type)
  if (type === 'candlestick') {
    nextTick(() => createCandlestickChart())
  }
}

const updateSymbol = () => {
  marketStore.setSelectedSymbol(selectedSymbol.value)
}

const formatVolume = (volume) => {
  if (volume >= 1000000) {
    return (volume / 1000000).toFixed(1) + 'M'
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(1) + 'K'
  }
  return volume.toFixed(0)
}

// Watchers
watch(() => marketStore.selectedSymbol, (newSymbol) => {
  selectedSymbol.value = newSymbol
  if (marketStore.chartType === 'candlestick') {
    nextTick(() => createCandlestickChart())
  }
})

watch(() => marketStore.chartType, (newType) => {
  if (newType === 'candlestick') {
    nextTick(() => {
      if (candlestickCanvas.value && !resizeObserver.value) {
        resizeObserver.value = new ResizeObserver(() => {
          if (marketStore.chartType === 'candlestick') {
            createCandlestickChart()
          }
        })
        resizeObserver.value.observe(candlestickCanvas.value.parentElement)
      }
      createCandlestickChart()
    })
  }
})

watch(() => marketStore.timeframe, () => {
  if (marketStore.chartType === 'candlestick') {
    nextTick(() => createCandlestickChart())
  }
})

watch(() => marketStore.priceHistory, () => {
  if (marketStore.chartType === 'candlestick') {
    nextTick(() => createCandlestickChart())
  }
}, { deep: true })

// Also watch for price history changes by timeframe
watch(() => [marketStore.priceHistory, marketStore.selectedSymbol, marketStore.timeframe], () => {
  if (marketStore.chartType === 'candlestick') {
    nextTick(() => createCandlestickChart())
  }
}, { deep: true })

onMounted(() => {
  // No need to fetchMarketData, simulation updates are automatic

  // Set up resize observer for canvas
  if (candlestickCanvas.value) {
    resizeObserver.value = new ResizeObserver(() => {
      if (marketStore.chartType === 'candlestick') {
        nextTick(() => createCandlestickChart())
      }
    })
    resizeObserver.value.observe(candlestickCanvas.value.parentElement)
  }
  
  if (marketStore.chartType === 'candlestick') {
    nextTick(() => createCandlestickChart())
  }
})

onUnmounted(() => {
  if (updateInterval.value) {
    clearInterval(updateInterval.value)
  }
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
  }
})
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

.chart-title {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.chart-title h3 {
  margin: 0;
  color: #00ff88;
  font-size: 1.4rem;
}

.chart-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.symbol-selector {
  padding: 0.5rem 0.75rem;
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-size: 0.9rem;
}

.symbol-selector:focus {
  outline: none;
  border-color: #00ff88;
}

.chart-type-selector {
  display: flex;
  gap: 0.25rem;
}

.chart-type-btn {
  padding: 0.5rem 0.75rem;
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #ccc;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.chart-type-btn:hover {
  background: #333;
  border-color: #777;
}

.chart-type-btn.active {
  background: #00ff88;
  color: #000;
  border-color: #00ff88;
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
  
  .chart-title {
    align-items: center;
  }
  
  .chart-controls {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .timeframe-selector {
    justify-content: center;
  }
  
  .chart-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>