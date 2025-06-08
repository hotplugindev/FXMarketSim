<template>
  <div class="trading-interface">
    <h3>Trading Interface</h3>
    
    <div class="trade-form">
      <div class="form-group">
        <label>Symbol</label>
        <select v-model="selectedSymbol" class="form-control">
          <option v-for="symbol in availableSymbols" :key="symbol" :value="symbol">
            {{ symbol.slice(0, 3) }}/{{ symbol.slice(3) }}
          </option>
        </select>
      </div>
      
      <div class="form-group">
        <label>Trade Size</label>
        <input
          v-model.number="tradeSize"
          type="number"
          min="0.01"
          step="0.01"
          class="form-control"
          placeholder="1.00"
        />
      </div>
      
      <div class="form-group">
        <label>Leverage</label>
        <select v-model.number="leverage" class="form-control">
          <option value="1">1:1</option>
          <option value="10">1:10</option>
          <option value="50">1:50</option>
          <option value="100">1:100</option>
          <option v-if="maxLeverage >= 200" value="200">1:200</option>
          <option v-if="maxLeverage >= 500" value="500">1:500</option>
          <option v-if="maxLeverage >= 1000" value="1000">1:1000</option>
        </select>
      </div>
      
      <div class="price-display">
        <div class="price-item">
          <span class="label">Bid:</span>
          <span class="bid-price">{{ marketStore.currentPrice.bid.toFixed(5) }}</span>
        </div>
        <div class="price-item">
          <span class="label">Ask:</span>
          <span class="ask-price">{{ marketStore.currentPrice.ask.toFixed(5) }}</span>
        </div>
        <div class="price-item">
          <span class="label">Spread:</span>
          <span class="spread">{{ marketStore.currentSpread.toFixed(5) }}</span>
        </div>
        <div v-if="tradingCosts" class="price-item">
          <span class="label">Commission:</span>
          <span class="commission">${{ tradingCosts.commission.toFixed(2) }}</span>
        </div>
        <div v-if="tradingCosts" class="price-item">
          <span class="label">Margin Required:</span>
          <span class="margin">${{ tradingCosts.marginRequired.toFixed(2) }}</span>
        </div>
      </div>
      
      <div class="trade-buttons">
        <button
          @click="placeTrade('Sell')"
          :disabled="!canTrade"
          class="btn btn-sell"
        >
          SELL {{ marketStore.currentPrice.bid.toFixed(5) }}
        </button>
        <button
          @click="placeTrade('Buy')"
          :disabled="!canTrade"
          class="btn btn-buy"
        >
          BUY {{ marketStore.currentPrice.ask.toFixed(5) }}
        </button>
      </div>
      
      <div v-if="tradeMessage" class="trade-message" :class="tradeMessage.type">
        {{ tradeMessage.text }}
      </div>
    </div>

    <div class="positions-section">
      <h4>Open Positions</h4>
      <div v-if="marketStore.positions.length === 0" class="no-positions">
        No open positions
      </div>
      <div v-else class="positions-list">
        <div
          v-for="position in marketStore.positions"
          :key="position.id"
          class="position-item"
          :class="{ profit: position.unrealized_pnl > 0, loss: position.unrealized_pnl < 0 }"
        >
          <div class="position-header">
            <span class="symbol">{{ position.symbol }}</span>
            <span class="side" :class="position.side.toLowerCase()">{{ position.side }}</span>
            <span class="volume">{{ position.volume }}</span>
          </div>
          <div class="position-details">
            <div class="detail">
              <span>Entry: {{ position.entry_price.toFixed(5) }}</span>
            </div>
            <div class="detail">
              <span>Current: {{ position.current_price.toFixed(5) }}</span>
            </div>
            <div class="detail pnl">
              <span>P&L: {{ position.unrealized_pnl.toFixed(2) }}</span>
            </div>
          </div>
          <button @click="closePosition(position.id)" class="btn-close">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMarketStore } from '../stores/market'
import { useBrokerStore } from '../stores/brokerStore'

const marketStore = useMarketStore()
const brokerStore = useBrokerStore()

const selectedSymbol = ref(marketStore.selectedSymbol)
const tradeSize = ref(1.0)
const leverage = ref(100)
const tradeMessage = ref(null)

// Watch for symbol changes and update store
watch(selectedSymbol, (newSymbol) => {
  marketStore.setSelectedSymbol(newSymbol)
})

// Watch for broker changes
watch(() => brokerStore.selectedBroker, (newBroker) => {
  if (newBroker) {
    // Update available symbols based on broker
    const availableSymbols = newBroker.availableSymbols || ['EURUSD', 'GBPUSD', 'USDJPY']
    if (!availableSymbols.includes(selectedSymbol.value)) {
      selectedSymbol.value = availableSymbols[0]
      marketStore.setSelectedSymbol(availableSymbols[0])
    }
  }
})

const canTrade = computed(() => {
  const broker = brokerStore.selectedBroker
  if (!broker) return false
  
  return tradeSize.value > 0 && 
         marketStore.account.free_margin > 0 &&
         tradeSize.value >= broker.minTradeSize &&
         tradeSize.value <= broker.maxTradeSize &&
         broker.availableSymbols.includes(selectedSymbol.value)
})

const availableSymbols = computed(() => {
  const broker = brokerStore.selectedBroker
  return broker ? broker.availableSymbols : ['EURUSD', 'GBPUSD', 'USDJPY']
})

const maxLeverage = computed(() => {
  const broker = brokerStore.selectedBroker
  return broker ? broker.maxLeverage : 100
})

const tradingCosts = computed(() => {
  const broker = brokerStore.selectedBroker
  if (!broker) return null
  
  return brokerStore.calculateTradingCosts(
    broker.id,
    selectedSymbol.value,
    'Buy', // Default to buy for calculation
    tradeSize.value,
    leverage.value
  )
})

const placeTrade = async (side) => {
  if (!canTrade.value) return
  
  const broker = brokerStore.selectedBroker
  if (!broker) {
    tradeMessage.value = {
      type: 'error',
      text: 'No broker selected'
    }
    return
  }
    
  const tradeData = {
    symbol: selectedSymbol.value,
    side: side,
    amount: tradeSize.value,
    leverage: leverage.value,
    brokerId: broker.id
  }
    
  try {
    const result = await marketStore.placeTrade(tradeData)
      
    if (result.success) {
      tradeMessage.value = {
        type: 'success',
        text: `${side} order placed successfully`
      }
    } else {
      tradeMessage.value = {
        type: 'error',
        text: result.error
      }
    }
  } catch {
    tradeMessage.value = {
      type: 'error',
      text: 'Failed to place trade'
    }
  }
    
  setTimeout(() => {
    tradeMessage.value = null
  }, 3000)
}

const closePosition = (positionId) => {
  marketStore.closePosition(positionId)
  tradeMessage.value = {
    type: 'success',
    text: 'Position closed'
  }
  
  setTimeout(() => {
    tradeMessage.value = null
  }, 3000)
}
</script>

<style scoped>
.trading-interface {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #444;
  height: fit-content;
}

.trading-interface h3 {
  margin: 0 0 1.5rem 0;
  color: #00ff88;
  font-size: 1.3rem;
}

.trade-form {
  margin-bottom: 2rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.75rem;
  color: #ccc;
  font-size: 1rem;
}

.form-control {
  width: 100%;
  padding: 0.75rem;
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-size: 1rem;
}

.form-control:focus {
  outline: none;
  border-color: #00ff88;
}

.price-display {
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.price-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.price-item:last-child {
  margin-bottom: 0;
}

.label {
  color: #ccc;
  font-size: 1rem;
}

.bid-price {
  color: #ff6b6b;
  font-weight: 600;
}

.ask-price {
  color: #4ecdc4;
  font-weight: 600;
}

.spread {
  color: #ffd93d;
  font-weight: 600;
}

.commission {
  color: #ff9800;
  font-weight: 600;
}

.margin {
  color: #9c27b0;
  font-weight: 600;
}

.trade-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.btn {
  padding: 1rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sell {
  background: #ff6b6b;
  color: white;
}

.btn-sell:hover:not(:disabled) {
  background: #ff5252;
}

.btn-buy {
  background: #4ecdc4;
  color: white;
}

.btn-buy:hover:not(:disabled) {
  background: #26a69a;
}

.trade-message {
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 1rem;
  text-align: center;
}

.trade-message.success {
  background: rgba(0, 255, 136, 0.2);
  color: #00ff88;
  border: 1px solid #00ff88;
}

.trade-message.error {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
  border: 1px solid #ff6b6b;
}

.positions-section h4 {
  margin: 0 0 1.25rem 0;
  color: #00ff88;
  font-size: 1.2rem;
}

.no-positions {
  color: #888;
  text-align: center;
  padding: 1.5rem;
  font-style: italic;
  font-size: 1rem;
}

.positions-list {
  max-height: 300px;
  overflow-y: auto;
}

.position-item {
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  position: relative;
}

.position-item.profit {
  border-left: 3px solid #00ff88;
}

.position-item.loss {
  border-left: 3px solid #ff6b6b;
}

.position-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.symbol {
  font-weight: 600;
  color: #fff;
  font-size: 1rem;
}

.side {
  padding: 0.3rem 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
}

.side.buy {
  background: rgba(78, 205, 196, 0.3);
  color: #4ecdc4;
}

.side.sell {
  background: rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
}

.volume {
  color: #ccc;
  font-size: 1rem;
}

.position-details {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.detail {
  font-size: 0.9rem;
  color: #ccc;
}

.detail.pnl {
  font-weight: 600;
}

.profit .pnl {
  color: #00ff88;
}

.loss .pnl {
  color: #ff6b6b;
}

.btn-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  padding: 0.3rem 0.6rem;
  background: #ff6b6b;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
}

.btn-close:hover {
  background: #ff5252;
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .trading-interface {
    padding: 1.25rem;
  }
  
  .trading-interface h3 {
    font-size: 1.2rem;
    margin-bottom: 1.25rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    font-size: 0.95rem;
    margin-bottom: 0.5rem;
  }
  
  .form-control {
    padding: 0.6rem;
    font-size: 0.95rem;
  }
  
  .price-item {
    font-size: 0.95rem;
    margin-bottom: 0.6rem;
  }
  
  .btn {
    padding: 0.8rem;
    font-size: 0.95rem;
  }
}

@media (max-width: 768px) {
  .trading-interface {
    padding: 1rem;
  }
  
  .trading-interface h3 {
    font-size: 1.1rem;
    margin-bottom: 1rem;
  }
  
  .form-group label {
    font-size: 0.9rem;
  }
  
  .form-control {
    padding: 0.5rem;
    font-size: 0.9rem;
  }
  
  .price-display {
    padding: 0.75rem;
    margin-bottom: 1rem;
  }
  
  .price-item {
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
  }
  
  .trade-buttons {
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  
  .btn {
    padding: 0.75rem;
    font-size: 0.9rem;
  }
  
  .positions-section h4 {
    font-size: 1rem;
    margin-bottom: 1rem;
  }
  
  .position-item {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }
  
  .symbol {
    font-size: 0.9rem;
  }
  
  .volume {
    font-size: 0.85rem;
  }
  
  .detail {
    font-size: 0.8rem;
  }
  
  .btn-close {
    top: 0.5rem;
    right: 0.5rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }
}
</style>