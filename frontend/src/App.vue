<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useMarketStore } from './stores/market'
import { useMarketEngineStore } from './stores/marketEngine'
import { useBrokerStore } from './stores/brokerStore'
import TradingInterface from './components/TradingInterface.vue'
import PriceChart from './components/PriceChart.vue'
import OrderBook from './components/OrderBook.vue'
import MarketData from './components/MarketData.vue'
import BrokerSelector from './components/BrokerSelector.vue'
import AccountInfo from './components/AccountInfo.vue'
import MarketConfiguration from './components/MarketConfiguration.vue'

const marketStore = useMarketStore()
const marketEngineStore = useMarketEngineStore()
const brokerStore = useBrokerStore()
const isConnected = ref(true) // Always connected since it's client-side
const activeTab = ref('trading')

onMounted(() => {
  initializeMarket()
})

onUnmounted(() => {
  marketStore.cleanup()
})

const initializeMarket = async () => {
  console.log('Initializing comprehensive market simulation...')
  
  try {
    // Initialize market data and start simulation
    marketStore.initializeMarketData()
    
    // Start the market engine simulation
    setTimeout(() => {
      marketEngineStore.startSimulation()
    }, 1000)
    
    console.log('Market simulation initialized successfully')
  } catch (error) {
    console.error('Failed to initialize market:', error)
  }
}

const setActiveTab = (tab) => {
  activeTab.value = tab
}</script>

<template>
  <div id="app">
    <header class="app-header">
      <div class="header-left">
        <h1>FX Market Simulation</h1>
        <div class="connection-status">
          <span :class="['status-indicator', { connected: isConnected }]"></span>
          {{ isConnected ? 'Connected' : 'Disconnected' }}
        </div>
      </div>
      
      <nav class="main-nav">
        <button 
          @click="setActiveTab('trading')"
          :class="['nav-btn', { active: activeTab === 'trading' }]"
        >
          Trading
        </button>
        <button 
          @click="setActiveTab('analysis')"
          :class="['nav-btn', { active: activeTab === 'analysis' }]"
        >
          Market Analysis
        </button>
        <button 
          @click="setActiveTab('configuration')"
          :class="['nav-btn', { active: activeTab === 'configuration' }]"
        >
          Configuration
        </button>
      </nav>
    </header>

    <main class="app-main">
      <!-- Trading Page -->
      <div v-if="activeTab === 'trading'" class="trading-page">
        <div class="trading-sidebar">
          <AccountInfo />
          <BrokerSelector />
          <TradingInterface />
        </div>
        
        <div class="chart-section">
          <PriceChart />
        </div>
      </div>

      <!-- Analysis Page -->
      <div v-if="activeTab === 'analysis'" class="analysis-page">
        <div class="analysis-grid">
          <div class="market-data-panel">
            <MarketData />
          </div>
          <div class="orderbook-panel">
            <OrderBook />
          </div>
        </div>
      </div>

      <!-- Configuration Page -->
      <div v-if="activeTab === 'configuration'" class="configuration-page">
        <MarketConfiguration />
      </div>
    </main>
  </div>
</template>

<style scoped>
#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  color: #ffffff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  overflow: hidden;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: #2d2d2d;
  border-bottom: 1px solid #444;
  height: 70px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.app-header h1 {
  margin: 0;
  color: #00ff88;
  font-size: 1.8rem;
  font-weight: 600;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff4444;
  transition: background-color 0.3s ease;
}

.status-indicator.connected {
  background: #00ff88;
}

.main-nav {
  display: flex;
  gap: 0.5rem;
}

.nav-btn {
  padding: 0.75rem 1.5rem;
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #ccc;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.nav-btn:hover {
  background: #333;
  border-color: #777;
  color: #fff;
}

.nav-btn.active {
  background: #00ff88;
  color: #000;
  border-color: #00ff88;
}

.app-main {
  flex: 1;
  overflow: hidden;
  height: calc(100vh - 70px);
}

/* Trading Page Layout */
.trading-page {
  display: grid;
  grid-template-columns: 380px 1fr;
  height: 100%;
  background: #444;
  gap: 2px;
  max-width: 100vw;
}

.trading-sidebar {
  background: #1a1a1a;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
}

.chart-section {
  background: #1a1a1a;
  padding: 1.5rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* Analysis Page Layout */
.analysis-page {
  height: 100%;
  padding: 1.5rem;
  overflow: hidden;
  max-width: 100vw;
}

/* Configuration Page Layout */
.configuration-page {
  height: 100%;
  overflow-y: auto;
  max-width: 100vw;
}

.analysis-grid {
  display: grid;
  grid-template-columns: 1fr 450px;
  gap: 1.5rem;
  height: 100%;
  max-width: 100%;
}

.market-data-panel,
.orderbook-panel {
  overflow-y: auto;
  min-width: 0;
}

/* Responsive Design */
@media (max-width: 1400px) {
  .trading-page {
    grid-template-columns: 350px 1fr;
  }
  
  .analysis-grid {
    grid-template-columns: 1fr 400px;
  }
}

@media (max-width: 1200px) {
  .trading-page {
    grid-template-columns: 320px 1fr;
  }
  
  .analysis-grid {
    grid-template-columns: 1fr 350px;
  }
  
  .trading-sidebar,
  .chart-section,
  .analysis-page {
    padding: 1rem;
  }
  
  .analysis-grid {
    gap: 1rem;
  }
}

@media (max-width: 1024px) {
  .app-header {
    flex-direction: column;
    gap: 1rem;
    height: auto;
    padding: 1rem;
  }
  
  .header-left {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .trading-page {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
  
  .trading-sidebar {
    max-height: 40vh;
  }
  
  .analysis-grid {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
  
  .configuration-page {
    padding: 0;
  }
  
  .app-main {
    height: calc(100vh - 140px);
  }
}

@media (max-width: 768px) {
  .app-header {
    padding: 0.75rem;
  }
  
  .app-header h1 {
    font-size: 1.4rem;
  }
  
  .nav-btn {
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
  }
  
  .trading-page {
    grid-template-columns: 1fr;
  }
  
  .trading-sidebar {
    max-height: 50vh;
  }
}
</style>