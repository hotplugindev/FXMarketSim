import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

export const useMarketStore = defineStore('market', () => {
  // State
  const currentPrice = ref({
    symbol: 'EURUSD',
    bid: 1.0950,
    ask: 1.0952,
    timestamp: Date.now(),
    volume: 0,
    orderbook_snapshot: { bids: [], asks: [] }
  })
  
  const priceHistory = ref([])
  const brokers = ref([])
  const selectedBroker = ref('direct_access')
  const timeframe = ref('1m')
  const account = ref({
    balance: 10000,
    equity: 10000,
    margin_used: 0,
    free_margin: 10000,
    leverage: 100
  })
  
  const orderbook = ref({
    bids: [],
    asks: []
  })
  
  const marketStats = ref({
    total_volume: 0,
    total_trades: 0,
    active_participants: 0,
    liquidity_index: 0,
    volatility: 0
  })
  
  const positions = ref([])
  const pendingOrders = ref([])
  
  // Computed
  const currentSpread = computed(() => {
    return currentPrice.value.ask - currentPrice.value.bid
  })
  
  const accountMarginLevel = computed(() => {
    if (account.value.margin_used === 0) return Infinity
    return (account.value.equity / account.value.margin_used) * 100
  })
  
  const selectedBrokerDetails = computed(() => {
    return brokers.value.find(b => b.id === selectedBroker.value) || {}
  })
  
  // Actions
  const updateMarketData = (data) => {
    currentPrice.value = data
    orderbook.value = data.orderbook_snapshot
    
    // Add to price history
    priceHistory.value.push({
      timestamp: data.timestamp,
      price: (data.bid + data.ask) / 2,
      volume: data.volume
    })
    
    // Keep only last 1000 points
    if (priceHistory.value.length > 1000) {
      priceHistory.value.shift()
    }
  }
  
  const fetchBrokers = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/brokers')
      brokers.value = response.data
    } catch (error) {
      console.error('Failed to fetch brokers:', error)
    }
  }
  
  const fetchMarketData = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/market-data')
      updateMarketData(response.data)
    } catch (error) {
      console.error('Failed to fetch market data:', error)
    }
  }
  
  const placeTrade = async (tradeData) => {
    try {
      const response = await axios.post('http://localhost:3001/api/trade', {
        ...tradeData,
        broker_id: selectedBroker.value
      })
      
      if (response.data.success) {
        // Update account and positions
        await updateAccountInfo()
        return { success: true, data: response.data }
      } else {
        return { success: false, error: response.data.error }
      }
    } catch (error) {
      console.error('Failed to place trade:', error)
      return { success: false, error: error.message }
    }
  }
  
  const updateAccountInfo = async () => {
    // This would typically fetch from backend
    // For now, we'll simulate account updates
    if (positions.value.length > 0) {
      const totalPnL = positions.value.reduce((sum, pos) => sum + pos.unrealized_pnl, 0)
      account.value.equity = account.value.balance + totalPnL
      account.value.margin_used = positions.value.reduce((sum, pos) => sum + pos.margin_required, 0)
      account.value.free_margin = account.value.equity - account.value.margin_used
    }
  }
  
  const setTimeframe = (tf) => {
    timeframe.value = tf
  }
  
  const setSelectedBroker = (brokerId) => {
    selectedBroker.value = brokerId
  }
  
  const setAccountBalance = (balance) => {
    account.value.balance = balance
    account.value.equity = balance
    account.value.free_margin = balance - account.value.margin_used
  }
  
  const addPosition = (position) => {
    positions.value.push({
      id: Date.now(),
      symbol: position.symbol,
      side: position.side,
      volume: position.amount,
      entry_price: position.price,
      current_price: position.price,
      unrealized_pnl: 0,
      margin_required: position.amount / account.value.leverage,
      timestamp: new Date()
    })
    updateAccountInfo()
  }
  
  const closePosition = (positionId) => {
    const index = positions.value.findIndex(p => p.id === positionId)
    if (index !== -1) {
      const position = positions.value[index]
      account.value.balance += position.unrealized_pnl
      positions.value.splice(index, 1)
      updateAccountInfo()
    }
  }
  
  const updatePositionPrices = () => {
    const midPrice = (currentPrice.value.bid + currentPrice.value.ask) / 2
    positions.value.forEach(position => {
      position.current_price = midPrice
      if (position.side === 'Buy') {
        position.unrealized_pnl = (midPrice - position.entry_price) * position.volume
      } else {
        position.unrealized_pnl = (position.entry_price - midPrice) * position.volume
      }
    })
    updateAccountInfo()
  }
  
  // Watch for price updates to update positions
  const unwatchPrice = computed(() => {
    updatePositionPrices()
    return currentPrice.value.timestamp
  })
  
  return {
    // State
    currentPrice,
    priceHistory,
    brokers,
    selectedBroker,
    timeframe,
    account,
    orderbook,
    marketStats,
    positions,
    pendingOrders,
    
    // Computed
    currentSpread,
    accountMarginLevel,
    selectedBrokerDetails,
    
    // Actions
    updateMarketData,
    fetchBrokers,
    fetchMarketData,
    placeTrade,
    updateAccountInfo,
    setTimeframe,
    setSelectedBroker,
    setAccountBalance,
    addPosition,
    closePosition,
    updatePositionPrices
  }
})