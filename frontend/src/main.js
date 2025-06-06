import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Initialize with some sample data after app is mounted
app.mount('#app')

// Add initial market data after a short delay
setTimeout(async () => {
  const { useMarketStore } = await import('./stores/market')
  const marketStore = useMarketStore()
  
  // Initialize brokers if none exist
  if (marketStore.brokers.length === 0) {
    marketStore.brokers.push(
      {
        id: 'direct_access',
        name: 'Direct Access',
        broker_type: 'Direct Access',
        spread: 0.0001,
        commission: 0
      },
      {
        id: 'ecn_broker',
        name: 'ECN Pro',
        broker_type: 'ECN Broker',
        spread: 0.0000,
        commission: 3.50
      },
      {
        id: 'market_maker',
        name: 'Market Maker',
        broker_type: 'Market Maker',
        spread: 0.0003,
        commission: 0
      }
    )
  }
  
  // Initialize some historical data
  const symbols = ['EURUSD', 'GBPUSD', 'USDJPY']
  const basePrices = {
    'EURUSD': 1.0951,
    'GBPUSD': 1.2651,
    'USDJPY': 149.86
  }
  
  symbols.forEach(symbol => {
    const basePrice = basePrices[symbol]
    const history = []
    let currentPrice = basePrice
    
    // Generate 100 historical candles with more realistic OHLC data
    for (let i = 0; i < 100; i++) {
      const timestamp = Date.now() - (100 - i) * 60 * 1000 // 1 minute intervals
      
      // Create realistic price movement
      const variation = (Math.random() - 0.5) * 0.0010
      const open = currentPrice
      const volatility = symbol === 'USDJPY' ? 0.05 : 0.0005
      
      const high = open + Math.random() * volatility
      const low = open - Math.random() * volatility
      const close = open + variation
      
      currentPrice = close // Next candle starts where this one ends
      
      const candle = {
        timestamp: timestamp / 1000,
        open: Number(open.toFixed(symbol === 'USDJPY' ? 3 : 5)),
        high: Number(Math.max(open, high, close).toFixed(symbol === 'USDJPY' ? 3 : 5)),
        low: Number(Math.min(open, low, close).toFixed(symbol === 'USDJPY' ? 3 : 5)),
        close: Number(close.toFixed(symbol === 'USDJPY' ? 3 : 5)),
        volume: Math.floor(Math.random() * 1000000) + 50000
      }
      
      history.push(candle)
    }
    
    console.log(`Initialized ${symbol} with ${history.length} candles:`, history.slice(0, 3))
    marketStore.priceHistories[symbol]['1m'] = history
    marketStore.aggregateTimeframes(symbol)
  })
  
  console.log('Initial market data loaded')
}, 500)