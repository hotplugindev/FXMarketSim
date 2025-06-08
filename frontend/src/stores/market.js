import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

export const useMarketStore = defineStore('market', () => {
  // State
  const selectedSymbol = ref('EURUSD')
  const chartType = ref('line') // 'line' or 'candlestick'
  
  const marketPrices = ref({
    'EURUSD': { bid: 1.0950, ask: 1.0952, timestamp: Date.now(), volume: 0 },
    'GBPUSD': { bid: 1.2650, ask: 1.2652, timestamp: Date.now(), volume: 0 },
    'USDJPY': { bid: 149.85, ask: 149.87, timestamp: Date.now(), volume: 0 }
  })
  
  const priceHistories = ref({
    'EURUSD': { '1m': [], '5m': [], '15m': [], '1h': [], '4h': [], '1d': [] },
    'GBPUSD': { '1m': [], '5m': [], '15m': [], '1h': [], '4h': [], '1d': [] },
    'USDJPY': { '1m': [], '5m': [], '15m': [], '1h': [], '4h': [], '1d': [] }
  })
  
  const lastCandleTimestamps = ref({
    'EURUSD': {},
    'GBPUSD': {},
    'USDJPY': {}
  })
  
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
  const currentPrice = computed(() => {
    return marketPrices.value[selectedSymbol.value] || marketPrices.value['EURUSD']
  })
  
  const priceHistory = computed(() => {
    const history = priceHistories.value[selectedSymbol.value]?.[timeframe.value] || []
    console.log(`Getting price history for ${selectedSymbol.value} ${timeframe.value}:`, history.length, 'candles')
    return history
  })
  
  const currentSpread = computed(() => {
    const price = currentPrice.value
    return price.ask - price.bid
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
    // Update the specific symbol's price
    if (marketPrices.value[data.symbol]) {
      marketPrices.value[data.symbol] = {
        bid: data.bid,
        ask: data.ask,
        timestamp: data.timestamp,
        volume: data.volume
      }
    }
    
    if (data.orderbook_snapshot) {
      orderbook.value = data.orderbook_snapshot
    }
    
    // Initialize symbol data if needed
    if (!priceHistories.value[data.symbol]) {
      priceHistories.value[data.symbol] = { '1m': [], '5m': [], '15m': [], '1h': [], '4h': [], '1d': [] }
    }
    if (!lastCandleTimestamps.value[data.symbol]) {
      lastCandleTimestamps.value[data.symbol] = {}
    }
    
    // Update candles with real-time logic
    updateCandleData(data.symbol, data.bid, data.ask, data.volume, data.timestamp)
    
    // Update positions with new prices
    updatePositionPrices()
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
      // Fetch data for all symbols
      const symbols = ['EURUSD', 'GBPUSD', 'USDJPY']
      for (const symbol of symbols) {
        // Simulate market data for each symbol
        const basePrice = marketPrices.value[symbol]
        const variation = (Math.random() - 0.5) * 0.0010 // Small random variation
        const bid = basePrice.bid + variation
        const ask = bid + (symbol === 'USDJPY' ? 0.02 : 0.0002) // Different spreads
        
        updateMarketData({
          symbol: symbol,
          bid: bid,
          ask: ask,
          timestamp: Date.now() / 1000,
          volume: Math.floor(Math.random() * 1000000)
        })
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error)
    }
  }
  
  const placeTrade = async (tradeData) => {
    try {
      // Calculate required margin
      const price = currentPrice.value
      const entryPrice = tradeData.side === 'Buy' ? price.ask : price.bid
      const marginRequired = (tradeData.amount * entryPrice) / account.value.leverage
      
      // Check if enough margin available
      if (marginRequired > account.value.free_margin) {
        return { success: false, error: 'Insufficient margin' }
      }
      
      // Create position
      const position = {
        id: Date.now() + Math.random(),
        symbol: tradeData.symbol,
        side: tradeData.side,
        volume: tradeData.amount,
        entry_price: entryPrice,
        current_price: entryPrice,
        unrealized_pnl: 0,
        margin_required: marginRequired,
        timestamp: new Date().toISOString()
      }
      
      // Add position and update account
      positions.value.push(position)
      account.value.margin_used += marginRequired
      account.value.free_margin -= marginRequired
      
      updateAccountInfo()
      return { success: true, data: position }
    } catch (error) {
      console.error('Failed to place trade:', error)
      return { success: false, error: error.message }
    }
  }
  
  const updateAccountInfo = () => {
    const totalPnL = positions.value.reduce((sum, pos) => sum + pos.unrealized_pnl, 0)
    const totalMargin = positions.value.reduce((sum, pos) => sum + pos.margin_required, 0)
    
    account.value.equity = account.value.balance + totalPnL
    account.value.margin_used = totalMargin
    account.value.free_margin = account.value.equity - account.value.margin_used
  }
  
  const setTimeframe = (tf) => {
    console.log('Setting timeframe to:', tf)
    timeframe.value = tf
  }
  
  const setSelectedBroker = (brokerId) => {
    selectedBroker.value = brokerId
  }
  
  const setSelectedSymbol = (symbol) => {
    console.log('Setting selected symbol to:', symbol)
    selectedSymbol.value = symbol
  }
  
  const setChartType = (type) => {
    console.log('Setting chart type to:', type)
    chartType.value = type
  }
  
  const setAccountBalance = (balance) => {
    account.value.balance = balance
    account.value.equity = balance + positions.value.reduce((sum, pos) => sum + pos.unrealized_pnl, 0)
    account.value.free_margin = account.value.equity - account.value.margin_used
  }
  
  const addPosition = (position) => {
    const marginRequired = (position.amount * position.price) / account.value.leverage
    positions.value.push({
      id: Date.now() + Math.random(),
      symbol: position.symbol,
      side: position.side,
      volume: position.amount,
      entry_price: position.price,
      current_price: position.price,
      unrealized_pnl: 0,
      margin_required: marginRequired,
      timestamp: new Date().toISOString()
    })
    account.value.margin_used += marginRequired
    account.value.free_margin -= marginRequired
    updateAccountInfo()
  }
  
  const closePosition = (positionId) => {
    const index = positions.value.findIndex(p => p.id === positionId)
    if (index !== -1) {
      const position = positions.value[index]
      
      // Realize the P&L
      account.value.balance += position.unrealized_pnl
      
      // Free up the margin
      account.value.margin_used -= position.margin_required
      
      // Remove position
      positions.value.splice(index, 1)
      
      // Update account info
      updateAccountInfo()
    }
  }
  
  const updatePositionPrices = () => {
    positions.value.forEach(position => {
      const symbolPrice = marketPrices.value[position.symbol]
      if (symbolPrice) {
        const currentPrice = (symbolPrice.bid + symbolPrice.ask) / 2
        position.current_price = currentPrice
        
        // Calculate P&L
        const priceDiff = position.side === 'Buy' 
          ? currentPrice - position.entry_price 
          : position.entry_price - currentPrice
        
        // For USD/JPY, pip value is different
        const pipValue = position.symbol === 'USDJPY' ? 100 : 10000
        position.unrealized_pnl = priceDiff * position.volume * pipValue
      }
    })
    updateAccountInfo()
  }
  
  const updateCandleData = (symbol, bid, ask, volume, timestamp) => {
    const midPrice = (bid + ask) / 2
    const timeframes = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400
    }
    
    Object.entries(timeframes).forEach(([tf, seconds]) => {
      // Round timestamp to the timeframe interval
      const roundedTimestamp = Math.floor(timestamp / seconds) * seconds
      
      // Get the last candle for this timeframe
      const tfData = priceHistories.value[symbol][tf]
      let lastCandle = tfData[tfData.length - 1]
      
      if (!lastCandle || lastCandle.timestamp !== roundedTimestamp) {
        // Create new candle
        const newCandle = {
          timestamp: roundedTimestamp,
          open: midPrice,
          high: midPrice,
          low: midPrice,
          close: midPrice,
          volume: volume
        }
        tfData.push(newCandle)
        
        // Keep only last 1000 candles for 1m, 500 for others
        const maxCandles = tf === '1m' ? 1000 : 500
        if (tfData.length > maxCandles) {
          tfData.shift()
        }
        
        lastCandleTimestamps.value[symbol][tf] = roundedTimestamp
        console.log(`New ${tf} candle for ${symbol} at ${new Date(roundedTimestamp * 1000).toLocaleTimeString()}`)
      } else {
        // Update existing candle
        lastCandle.high = Math.max(lastCandle.high, midPrice)
        lastCandle.low = Math.min(lastCandle.low, midPrice)
        lastCandle.close = midPrice
        lastCandle.volume += volume
      }
    })
  }
  
  const aggregateTimeframes = (symbol) => {
    // This function is now replaced by updateCandleData for real-time updates
    // Keeping for backward compatibility but functionality moved to updateCandleData
  }
  
  const generateHigherTimeframes = (symbol) => {
    const oneMinData = priceHistories.value[symbol]['1m']
    if (oneMinData.length === 0) return
    
    const timeframes = {
      '5m': 300,
      '15m': 900,
      '1h': 3600,
      '4h': 14400,
      '1d': 86400
    }
    
    Object.entries(timeframes).forEach(([tf, seconds]) => {
      const aggregated = []
      
      // Group candles by time boundaries
      const groups = {}
      oneMinData.forEach(candle => {
        const boundary = Math.floor(candle.timestamp / seconds) * seconds
        if (!groups[boundary]) {
          groups[boundary] = []
        }
        groups[boundary].push(candle)
      })
      
      // Create aggregated candles
      Object.entries(groups).forEach(([timestamp, candles]) => {
        if (candles.length > 0) {
          const aggregatedCandle = {
            timestamp: parseInt(timestamp),
            open: candles[0].open,
            high: Math.max(...candles.map(c => c.high)),
            low: Math.min(...candles.map(c => c.low)),
            close: candles[candles.length - 1].close,
            volume: candles.reduce((sum, c) => sum + c.volume, 0)
          }
          aggregated.push(aggregatedCandle)
        }
      })
      
      // Sort by timestamp and store
      priceHistories.value[symbol][tf] = aggregated.sort((a, b) => a.timestamp - b.timestamp)
      console.log(`Generated ${aggregated.length} ${tf} candles for ${symbol}`)
    })
  }
  
  return {
    // State
    selectedSymbol,
    chartType,
    marketPrices,
    priceHistories,
    lastCandleTimestamps,
    brokers,
    selectedBroker,
    timeframe,
    account,
    orderbook,
    marketStats,
    positions,
    pendingOrders,
    
    // Computed
    currentPrice,
    priceHistory,
    currentSpread,
    accountMarginLevel,
    selectedBrokerDetails,
    
    // Actions
    updateMarketData,
    updateCandleData,
    fetchBrokers,
    fetchMarketData,
    placeTrade,
    updateAccountInfo,
    setTimeframe,
    setSelectedBroker,
    setSelectedSymbol,
    setChartType,
    setAccountBalance,
    addPosition,
    closePosition,
    updatePositionPrices,
    aggregateTimeframes,
    generateHigherTimeframes
  }
})