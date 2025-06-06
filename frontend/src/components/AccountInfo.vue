<template>
  <div class="account-info">
    <h3>Account Information</h3>
    
    <div class="balance-setter">
      <div class="form-group">
        <label>Set Initial Balance:</label>
        <div class="balance-input-group">
          <input
            v-model.number="initialBalance"
            type="number"
            min="100"
            step="100"
            class="form-control"
            placeholder="10000"
          />
          <button @click="setBalance" class="btn btn-set">Set</button>
        </div>
      </div>
    </div>
    
    <div class="account-details">
      <div class="detail-section">
        <h4>Balance</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="label">Balance:</span>
            <span class="value balance">{{ formatCurrency(marketStore.account.balance) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Equity:</span>
            <span class="value equity">{{ formatCurrency(marketStore.account.equity) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Free Margin:</span>
            <span class="value free-margin">{{ formatCurrency(marketStore.account.free_margin) }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Used Margin:</span>
            <span class="value used-margin">{{ formatCurrency(marketStore.account.margin_used) }}</span>
          </div>
        </div>
      </div>
      
      <div class="detail-section">
        <h4>Risk Management</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="label">Leverage:</span>
            <span class="value">1:{{ marketStore.account.leverage }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Margin Level:</span>
            <span :class="['value', getMarginLevelClass()]">
              {{ formatMarginLevel() }}
            </span>
          </div>
          <div class="detail-item">
            <span class="label">Open Positions:</span>
            <span class="value">{{ marketStore.positions.length }}</span>
          </div>
          <div class="detail-item">
            <span class="label">Total P&L:</span>
            <span :class="['value', getPnLClass()]">
              {{ formatCurrency(totalPnL) }}
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="account-status">
      <div class="status-bar">
        <div class="status-item">
          <div class="status-label">Account Health</div>
          <div :class="['status-indicator', getAccountHealthClass()]">
            {{ getAccountHealthText() }}
          </div>
        </div>
      </div>
      
      <div class="equity-chart">
        <div class="chart-header">
          <span>Equity Curve</span>
        </div>
        <div class="mini-chart">
          <svg width="100%" height="60" viewBox="0 0 200 60">
            <polyline
              :points="equityPoints"
              fill="none"
              :stroke="totalPnL >= 0 ? '#00ff88' : '#ff6b6b'"
              stroke-width="2"
            />
          </svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMarketStore } from '../stores/market'

const marketStore = useMarketStore()
const initialBalance = ref(10000)

const totalPnL = computed(() => {
  return marketStore.positions.reduce((total, position) => total + position.unrealized_pnl, 0)
})

const equityPoints = computed(() => {
  // Generate a simple equity curve based on current equity
  const baseEquity = marketStore.account.balance
  const currentEquity = marketStore.account.equity
  const points = []
  
  // Generate 20 points for the mini chart
  for (let i = 0; i < 20; i++) {
    const x = (i / 19) * 200
    const equityRatio = baseEquity > 0 ? (currentEquity - baseEquity) / baseEquity : 0
    const variation = Math.sin(i * 0.5) * 5 + equityRatio * 30
    const y = Math.max(5, Math.min(55, 30 + variation))
    points.push(`${x},${y}`)
  }
  
  return points.join(' ')
})

const setBalance = () => {
  if (initialBalance.value >= 100) {
    marketStore.setAccountBalance(initialBalance.value)
  }
}

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount)
}

const formatMarginLevel = () => {
  const level = marketStore.accountMarginLevel
  if (level === Infinity) return '∞'
  return `${level.toFixed(0)}%`
}

const getMarginLevelClass = () => {
  const level = marketStore.accountMarginLevel
  if (level === Infinity || level > 200) return 'safe'
  if (level > 100) return 'warning'
  return 'danger'
}

const getPnLClass = () => {
  if (totalPnL.value > 0) return 'profit'
  if (totalPnL.value < 0) return 'loss'
  return 'neutral'
}

const getAccountHealthClass = () => {
  const marginLevel = marketStore.accountMarginLevel
  const equityRatio = marketStore.account.equity / marketStore.account.balance
  
  if (marginLevel > 200 && equityRatio > 0.9) return 'excellent'
  if (marginLevel > 150 && equityRatio > 0.8) return 'good'
  if (marginLevel > 100 && equityRatio > 0.7) return 'fair'
  return 'poor'
}

const getAccountHealthText = () => {
  const health = getAccountHealthClass()
  return health.charAt(0).toUpperCase() + health.slice(1)
}
</script>

<style scoped>
.account-info {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #444;
  height: fit-content;
}

.account-info h3 {
  margin: 0 0 1.5rem 0;
  color: #00ff88;
  font-size: 1.3rem;
}

.balance-setter {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #444;
}

.form-group label {
  display: block;
  margin-bottom: 0.75rem;
  color: #ccc;
  font-size: 1rem;
}

.balance-input-group {
  display: flex;
  gap: 0.75rem;
}

.form-control {
  flex: 1;
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

.btn {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-set {
  background: #00ff88;
  color: #000;
}

.btn-set:hover {
  background: #00cc6a;
}

.account-details {
  margin-bottom: 1.5rem;
}

.detail-section {
  margin-bottom: 1.25rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h4 {
  margin: 0 0 0.75rem 0;
  color: #ccc;
  font-size: 1rem;
  border-bottom: 1px solid #444;
  padding-bottom: 0.5rem;
}

.detail-grid {
  display: grid;
  gap: 0.5rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.4rem 0;
}

.label {
  color: #888;
  font-size: 0.95rem;
}

.value {
  color: #fff;
  font-weight: 600;
  font-size: 0.95rem;
  font-family: 'Courier New', monospace;
}

.value.balance {
  color: #00ff88;
}

.value.equity {
  color: #4ecdc4;
}

.value.free-margin {
  color: #ffd93d;
}

.value.used-margin {
  color: #ff9800;
}

.value.safe {
  color: #00ff88;
}

.value.warning {
  color: #ffd93d;
}

.value.danger {
  color: #ff6b6b;
}

.value.profit {
  color: #00ff88;
}

.value.loss {
  color: #ff6b6b;
}

.value.neutral {
  color: #ccc;
}

.account-status {
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  padding: 1rem;
}

.status-bar {
  margin-bottom: 1rem;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  color: #888;
  font-size: 0.95rem;
}

.status-indicator {
  padding: 0.4rem 0.75rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 600;
}

.status-indicator.excellent {
  background: rgba(0, 255, 136, 0.3);
  color: #00ff88;
}

.status-indicator.good {
  background: rgba(78, 205, 196, 0.3);
  color: #4ecdc4;
}

.status-indicator.fair {
  background: rgba(255, 217, 61, 0.3);
  color: #ffd93d;
}

.status-indicator.poor {
  background: rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
}

.equity-chart {
  border-top: 1px solid #444;
  padding-top: 0.75rem;
}

.chart-header {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.mini-chart {
  height: 60px;
  background: #111;
  border-radius: 6px;
  padding: 6px;
}

@media (max-width: 768px) {
  .balance-input-group {
    flex-direction: column;
  }
  
  .detail-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .status-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>