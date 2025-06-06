<template>
  <div class="market-data">
    <h3>Market Data</h3>
    
    <div class="data-section">
      <h4>Price Information</h4>
      <div class="data-grid">
        <div class="data-item">
          <span class="label">Symbol:</span>
          <span class="value">{{ marketStore.selectedSymbol }}</span>
        </div>
        <div class="data-item">
          <span class="label">Bid:</span>
          <span class="value bid">{{ marketStore.currentPrice.bid.toFixed(5) }}</span>
        </div>
        <div class="data-item">
          <span class="label">Ask:</span>
          <span class="value ask">{{ marketStore.currentPrice.ask.toFixed(5) }}</span>
        </div>
        <div class="data-item">
          <span class="label">Spread:</span>
          <span class="value">{{ marketStore.currentSpread.toFixed(5) }}</span>
        </div>
        <div class="data-item">
          <span class="label">Volume:</span>
          <span class="value">{{ formatVolume(marketStore.currentPrice.volume || 0) }}</span>
        </div>
        <div class="data-item">
          <span class="label">Last Update:</span>
          <span class="value">{{ formatTime(marketStore.currentPrice.timestamp || Date.now()) }}</span>
        </div>
      </div>
    </div>

    <div class="data-section">
      <h4>Market Statistics</h4>
      <div class="data-grid">
        <div class="data-item">
          <span class="label">Total Volume:</span>
          <span class="value">{{ formatVolume(marketStore.marketStats.total_volume) }}</span>
        </div>
        <div class="data-item">
          <span class="label">Total Trades:</span>
          <span class="value">{{ marketStore.marketStats.total_trades.toLocaleString() }}</span>
        </div>
        <div class="data-item">
          <span class="label">Active Participants:</span>
          <span class="value">{{ marketStore.marketStats.active_participants.toLocaleString() }}</span>
        </div>
        <div class="data-item">
          <span class="label">Liquidity Index:</span>
          <span class="value">{{ marketStore.marketStats.liquidity_index.toFixed(2) }}</span>
        </div>
        <div class="data-item">
          <span class="label">Volatility:</span>
          <span class="value">{{ (marketStore.marketStats.volatility * 100).toFixed(4) }}%</span>
        </div>
      </div>
    </div>

    <div class="data-section">
      <h4>Order Book Summary</h4>
      <div class="orderbook-summary">
        <div class="summary-item">
          <span class="label">Best Bid:</span>
          <span class="value bid">
            {{ bestBid ? bestBid.toFixed(5) : 'N/A' }}
          </span>
        </div>
        <div class="summary-item">
          <span class="label">Best Ask:</span>
          <span class="value ask">
            {{ bestAsk ? bestAsk.toFixed(5) : 'N/A' }}
          </span>
        </div>
        <div class="summary-item">
          <span class="label">Bid Depth:</span>
          <span class="value">{{ formatVolume(totalBidVolume) }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Ask Depth:</span>
          <span class="value">{{ formatVolume(totalAskVolume) }}</span>
        </div>
      </div>
    </div>

    <div class="data-section">
      <h4>Price Movements</h4>
      <div class="price-movements">
        <div class="movement-item">
          <span class="label">1 Min Change:</span>
          <span :class="['value', getChangeClass(change1Min)]">
            {{ formatChange(change1Min) }}
          </span>
        </div>
        <div class="movement-item">
          <span class="label">5 Min Change:</span>
          <span :class="['value', getChangeClass(change5Min)]">
            {{ formatChange(change5Min) }}
          </span>
        </div>
        <div class="movement-item">
          <span class="label">15 Min Change:</span>
          <span :class="['value', getChangeClass(change15Min)]">
            {{ formatChange(change15Min) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useMarketStore } from '../stores/market'

const marketStore = useMarketStore()

const bestBid = computed(() => {
  if (!marketStore.orderbook.bids.length) return null
  return Math.max(...marketStore.orderbook.bids.map(bid => bid[0]))
})

const bestAsk = computed(() => {
  if (!marketStore.orderbook.asks.length) return null
  return Math.min(...marketStore.orderbook.asks.map(ask => ask[0]))
})

const totalBidVolume = computed(() => {
  return marketStore.orderbook.bids.reduce((total, bid) => total + bid[1], 0)
})

const totalAskVolume = computed(() => {
  return marketStore.orderbook.asks.reduce((total, ask) => total + ask[1], 0)
})

const change1Min = computed(() => {
  const history = marketStore.priceHistory
  if (history.length < 2) return 0
  const current = history[history.length - 1]?.price || 0
  const oneMinAgo = history[Math.max(0, history.length - 6)]?.price || current // Assuming 10 updates per minute
  return current - oneMinAgo
})

const change5Min = computed(() => {
  const history = marketStore.priceHistory
  if (history.length < 2) return 0
  const current = history[history.length - 1]?.price || 0
  const fiveMinAgo = history[Math.max(0, history.length - 30)]?.price || current // Assuming 6 updates per minute
  return current - fiveMinAgo
})

const change15Min = computed(() => {
  const history = marketStore.priceHistory
  if (history.length < 2) return 0
  const current = history[history.length - 1]?.price || 0
  const fifteenMinAgo = history[Math.max(0, history.length - 90)]?.price || current // Assuming 6 updates per minute
  return current - fifteenMinAgo
})

const formatVolume = (volume) => {
  if (volume >= 1000000000) {
    return (volume / 1000000000).toFixed(1) + 'B'
  } else if (volume >= 1000000) {
    return (volume / 1000000).toFixed(1) + 'M'
  } else if (volume >= 1000) {
    return (volume / 1000).toFixed(1) + 'K'
  }
  return volume.toFixed(0)
}

const formatTime = (timestamp) => {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString()
}

const formatChange = (change) => {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(5)}`
}

const getChangeClass = (change) => {
  if (change > 0) return 'positive'
  if (change < 0) return 'negative'
  return 'neutral'
}
</script>

<style scoped>
.market-data {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid #444;
}

.market-data h3 {
  margin: 0 0 1rem 0;
  color: #00ff88;
  font-size: 1.2rem;
}

.data-section {
  margin-bottom: 1.5rem;
}

.data-section:last-child {
  margin-bottom: 0;
}

.data-section h4 {
  margin: 0 0 0.75rem 0;
  color: #ccc;
  font-size: 1rem;
  border-bottom: 1px solid #444;
  padding-bottom: 0.5rem;
}

.data-grid {
  display: grid;
  gap: 0.5rem;
}

.data-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
}

.orderbook-summary,
.price-movements {
  display: grid;
  gap: 0.5rem;
}

.summary-item,
.movement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
}

.label {
  color: #888;
  font-size: 0.9rem;
}

.value {
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  font-family: 'Courier New', monospace;
}

.value.bid {
  color: #ff6b6b;
}

.value.ask {
  color: #4ecdc4;
}

.value.positive {
  color: #00ff88;
}

.value.negative {
  color: #ff6b6b;
}

.value.neutral {
  color: #ccc;
}

@media (max-width: 768px) {
  .data-item,
  .summary-item,
  .movement-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>