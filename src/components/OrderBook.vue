<template>
  <div class="orderbook">
    <h3>Order Book</h3>
    
    <div class="orderbook-header">
      <div class="column-header">Price</div>
      <div class="column-header">Size</div>
      <div class="column-header">Total</div>
    </div>
    
    <div class="orderbook-content">
      <!-- Asks (Sell orders) -->
      <div class="asks-section">
        <div
          v-for="(ask, index) in displayAsks"
          :key="`ask-${index}`"
          class="orderbook-row ask"
        >
          <div class="price">{{ ask[0].toFixed(5) }}</div>
          <div class="size">{{ formatSize(ask[1]) }}</div>
          <div class="total">{{ formatSize(ask[2]) }}</div>
        </div>
      </div>
      
      <!-- Spread -->
      <div class="spread-row">
        <div class="spread-info">
          <span class="spread-label">Spread:</span>
          <span class="spread-value">{{ currentSpread.toFixed(5) }}</span>
        </div>
      </div>
      
      <!-- Bids (Buy orders) -->
      <div class="bids-section">
        <div
          v-for="(bid, index) in displayBids"
          :key="`bid-${index}`"
          class="orderbook-row bid"
        >
          <div class="price">{{ bid[0].toFixed(5) }}</div>
          <div class="size">{{ formatSize(bid[1]) }}</div>
          <div class="total">{{ formatSize(bid[2]) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMarketStore } from '../stores/market'

const marketStore = useMarketStore()

const maxRows = 10

const displayAsks = computed(() => {
  const asks = Array.isArray(marketStore.orderbook?.asks) ? [...marketStore.orderbook.asks] : []
    .sort((a, b) => a[0] - b[0])
    .slice(0, maxRows)
  
  let runningTotal = 0
  return asks.map(ask => {
    runningTotal += ask[1]
    return [ask[0], ask[1], runningTotal]
  }).reverse()
})

const displayBids = computed(() => {
  const bids = Array.isArray(marketStore.orderbook?.bids) ? [...marketStore.orderbook.bids] : []
    .sort((a, b) => b[0] - a[0])
    .slice(0, maxRows)
  
  let runningTotal = 0
  return bids.map(bid => {
    runningTotal += bid[1]
    return [bid[0], bid[1], runningTotal]
  })
})

const currentSpread = computed(() => {
  if (!Array.isArray(displayAsks.value) || !Array.isArray(displayBids.value) ||
      displayAsks.value.length === 0 || displayBids.value.length === 0) {
    return marketStore.currentSpread || 0
  }
  
  const lowestAsk = displayAsks.value[displayAsks.value.length - 1][0]
  const highestBid = displayBids.value[0][0]
  
  return lowestAsk - highestBid
})

const formatSize = (size) => {
  if (typeof size !== 'number' || isNaN(size)) return '0'
  if (size >= 1000000) {
    return (size / 1000000).toFixed(1) + 'M'
  } else if (size >= 1000) {
    return (size / 1000).toFixed(1) + 'K'
  }
  return size.toFixed(0)
}
</script>

<style scoped>
.orderbook {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #444;
  height: fit-content;
}

.orderbook h3 {
  margin: 0 0 1rem 0;
  color: #00ff88;
  font-size: 1.2rem;
}

.orderbook-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #444;
  margin-bottom: 0.5rem;
}

.column-header {
  color: #888;
  font-size: 0.8rem;
  font-weight: 600;
  text-align: center;
}

.orderbook-content {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
}

.asks-section {
  margin-bottom: 0.5rem;
}

.bids-section {
  margin-top: 0.5rem;
}

.orderbook-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
  padding: 0.25rem 0;
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.orderbook-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.orderbook-row.ask {
  background: linear-gradient(90deg, transparent 0%, rgba(255, 107, 107, 0.1) 100%);
}

.orderbook-row.bid {
  background: linear-gradient(90deg, transparent 0%, rgba(78, 205, 196, 0.1) 100%);
}

.price {
  text-align: left;
  font-weight: 600;
}

.ask .price {
  color: #ff6b6b;
}

.bid .price {
  color: #4ecdc4;
}

.size {
  text-align: center;
  color: #ccc;
}

.total {
  text-align: right;
  color: #888;
  font-size: 0.8rem;
}

.spread-row {
  display: flex;
  justify-content: center;
  padding: 0.5rem 0;
  border-top: 1px solid #444;
  border-bottom: 1px solid #444;
  margin: 0.5rem 0;
}

.spread-info {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.spread-label {
  color: #888;
  font-size: 0.8rem;
}

.spread-value {
  color: #ffd93d;
  font-weight: 600;
  font-size: 0.9rem;
}
</style>