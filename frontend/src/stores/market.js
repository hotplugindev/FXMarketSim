import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useMarketEngineStore } from './marketEngine'
import { useBrokerStore } from './brokerStore'

export const useMarketStore = defineStore('market', () => {
  // Get access to the market engine and broker stores
  const marketEngineStore = useMarketEngineStore()
  const brokerStore = useBrokerStore()
  
  // State
  const selectedSymbol = ref('EURUSD')
  const chartType = ref('line') // 'line' or 'candlestick'
  const timeframe = ref('1m')
  
  // Real-time market data derived from market engine
  const marketPrices = ref(new Map())
  const priceHistories = ref({})
  const lastCandleTimestamps = ref({})
  
  // User account and trading
  const account = ref({
    balance: 10000,
    equity: 10000,
    margin_used: 0,
    free_margin: 10000,
    leverage: 100
  })
  
  const positions = ref([])
  const pendingOrders = ref([])
  
  // Real-time update interval
  const updateInterval = ref(null)
  
  // Initialize price data structures for all symbols
  const initializePriceData = () => {
    const symbols = marketEngineStore.config.symbols
    
    symbols.forEach(symbol => {
      if (!priceHistories.value[symbol]) {
        priceHistories.value[symbol] = {
          '1m': [], '5m': [], '15m': [], '1h': [], '4h': [], '1d': []
        }
      }
      if (!lastCandleTimestamps.value[symbol]) {
        lastCandleTimestamps.value[symbol] = {}
      }
      if (!marketPrices.value.has(symbol)) {
        marketPrices.value.set(symbol, {
          bid: marketEngineStore.config.basePrices[symbol] || 1.0,
          ask: (marketEngineStore.config.basePrices[symbol] || 1.0) + 0.0002,
          timestamp: Date.now() / 1000,
          volume: 0
        })
      }
    })
  }
  
  // Computed
  const currentPrice = computed(() => {
    const price = marketPrices.value.get(selectedSymbol.value)
    if (price) return price
    
    // Fallback to base price if not found
    const basePrice = marketEngineStore.config.basePrices[selectedSymbol.value] || 1.0
    return {
      bid: basePrice - 0.0001,
      ask: basePrice + 0.0001,
      timestamp: Date.now() / 1000,
      volume: 0
    }
  })
  
  const priceHistory = computed(() => {
    const history = priceHistories.value[selectedSymbol.value]?.[timeframe.value] || []
    return history
  })
  
  const currentSpread = computed(() => {
    const price = currentPrice.value
    return price.ask - price.bid
  })
  
  const orderbook = computed(() => {
    const orderBook = marketEngineStore.getOrderBook(selectedSymbol.value)
    if (!orderBook) return { bids: [], asks: [] }
    
    return {
      bids: orderBook.getBids(10),
      asks: orderBook.getAsks(10)
    }
  })
  
  const marketStats = computed(() => {
    return marketEngineStore.marketStats
  })
  
  const brokers = computed(() => {
    return brokerStore.brokerList
  })
  
  const selectedBroker = computed(() => {
    return brokerStore.selectedBroker?.id || null
  })
  
  const accountMarginLevel = computed(() => {
    if (account.value.margin_used === 0) return Infinity
    return (account.value.equity / account.value.margin_used) * 100
  })
  
  // Actions
  const updateMarketData = () => {
    // Get current prices from market engine orderbooks
    marketEngineStore.config.symbols.forEach(symbol => {
      const orderBook = marketEngineStore.getOrderBook(symbol)
      if (orderBook) {
        const bid = orderBook.getBestBid() || marketEngineStore.config.basePrices[symbol] || 1.0
        const ask = orderBook.getBestAsk() || (bid + 0.0002)
        const volume = orderBook.getTotalVolume()
        
        marketPrices.value.set(symbol, {
          bid: bid,
          ask: ask,
          timestamp: Date.now() / 1000,
          volume: volume
        })
        
        // Update candles with real-time logic
        const midPrice = (bid + ask) / 2
        updateCandleData(symbol, bid, ask, volume, Date.now() / 1000)
      }
    })
    
    // Update positions with new prices
    updatePositionPrices()
  }
  
  const startRealTimeUpdates = () => {
    if (updateInterval.value) return
    
    updateInterval.value = setInterval(() => {
      updateMarketData()
    }, 1000) // Update every second
  }
  
  const stopRealTimeUpdates = () => {
    if (updateInterval.value) {
      clearInterval(updateInterval.value)
      updateInterval.value = null
    }
  }
  
  const placeTrade = async (tradeData) => {
    try {
      // Get selected broker
      const broker = brokerStore.selectedBroker
      if (!broker) {
        return { success: false, error: 'No broker selected' }
      }
      
      // Calculate required margin
      const price = currentPrice.value
      const entryPrice = tradeData.side === 'Buy' ? price.ask : price.bid
      const marginRequired = broker.getMarginRequirement(tradeData.symbol, tradeData.amount, account.value.leverage)
      
      // Check if enough margin available
      if (marginRequired > account.value.free_margin) {
        return { success: false, error: 'Insufficient margin' }
      }
      
      // Place order in market engine
      try {
        const orderId = await marketEngineStore.placeOrder(
          tradeData.symbol,
          tradeData.side,
          tradeData.amount,
          'user_trader', // User participant ID
          'Market',
          entryPrice
        )
        
        // Create position
        const position = {
          id: orderId,
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
      } catch (engineError) {
        console.error('Market engine order failed:', engineError)
        return { success: false, error: 'Order execution failed' }
      }
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
    
    // Keep user participant in sync
    const userParticipant = marketEngineStore.getUserParticipant()
    if (userParticipant) {
      userParticipant.balance = account.value.balance
      userParticipant.marginUsed = account.value.margin_used
      userParticipant.updateEquity()
    }
  }
  
  const setTimeframe = (tf) => {
    console.log('Setting timeframe to:', tf)
    timeframe.value = tf
  }
  
  const setSelectedBroker = (brokerId) => {
    brokerStore.selectBroker(brokerId)
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
    
    // Update user participant in market engine
    marketEngineStore.updateUserBalance(balance)
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
      const symbolPrice = marketPrices.value.get(position.symbol)
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
    
    // Ensure price history exists for this symbol
    if (!priceHistories.value[symbol]) {
      priceHistories.value[symbol] = {
        '1m': [], '5m': [], '15m': [], '1h': [], '4h': [], '1d': []
      }
    }
    if (!lastCandleTimestamps.value[symbol]) {
      lastCandleTimestamps.value[symbol] = {}
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
          volume: volume || 0
        }
        tfData.push(newCandle)
        
        // Keep only last 1000 candles for 1m, 500 for others
        const maxCandles = tf === '1m' ? 1000 : 500
        if (tfData.length > maxCandles) {
          tfData.shift()
        }
        
        lastCandleTimestamps.value[symbol][tf] = roundedTimestamp
      } else {
        // Update existing candle
        lastCandle.high = Math.max(lastCandle.high, midPrice)
        lastCandle.low = Math.min(lastCandle.low, midPrice)
        lastCandle.close = midPrice
        lastCandle.volume += volume || 0
      }
    })
  }
  
  const aggregateTimeframes = (symbol) => {
    // This function is now replaced by updateCandleData for real-time updates
    // Keeping for backward compatibility but functionality moved to updateCandleData
  }
  
  const generateHigherTimeframes = (symbol) => {
    const oneMinData = priceHistories.value[symbol]?.['1m'] || []
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
            volume: candles.reduce((sum, c) => sum + (c.volume || 0), 0)
          }
          aggregated.push(aggregatedCandle)
        }
      })
      
      // Sort by timestamp and store
      if (!priceHistories.value[symbol]) {
        priceHistories.value[symbol] = { '1m': [], '5m': [], '15m': [], '1h': [], '4h': [], '1d': [] }
      }
      priceHistories.value[symbol][tf] = aggregated.sort((a, b) => a.timestamp - b.timestamp)
    })
  }
  
  // Initialize market data when market engine is ready
  const initializeMarketData = () => {
    // Initialize brokers if needed
    if (brokerStore.brokerList.length === 0) {
      brokerStore.initializeDefaultBrokers()
    }
    
    // Initialize market engine if needed
    if (marketEngineStore.symbols.size === 0) {
      marketEngineStore.initializeMarket()
    }
    
    // Sync user account with market engine user participant
    const userParticipant = marketEngineStore.getUserParticipant()
    if (userParticipant) {
      account.value.balance = userParticipant.balance
      account.value.equity = userParticipant.equity
      account.value.leverage = userParticipant.leverage
      updateAccountInfo()
    }
    
    // Initialize price data structures
    initializePriceData()
    
    // Generate some initial historical data
    generateInitialHistory()
    
    // Start real-time updates
    startRealTimeUpdates()
  }
  
  const generateInitialHistory = () => {
    marketEngineStore.config.symbols.forEach(symbol => {
      const basePrice = marketEngineStore.config.basePrices[symbol] || 1.0
      const history = []
      let currentPrice = basePrice
      
      // Generate 100 historical 1-minute candles
      const now = Date.now()
      const minuteMs = 60 * 1000
      
      for (let i = 0; i < 100; i++) {
        const candleTime = now - (100 - i) * minuteMs
        const alignedTime = Math.floor(candleTime / minuteMs) * minuteMs
        const timestamp = Math.floor(alignedTime / 1000)
        
        // Create realistic price movement
        const variation = (Math.random() - 0.5) * 0.0010
        const open = currentPrice
        const volatility = symbol === 'USDJPY' ? 0.05 : 0.0005
        
        const high = open + Math.random() * volatility
        const low = open - Math.random() * volatility
        const close = open + variation
        
        currentPrice = close
        
        const candle = {
          timestamp: timestamp,
          open: Number(open.toFixed(symbol === 'USDJPY' ? 3 : 5)),
          high: Number(Math.max(open, high, close).toFixed(symbol === 'USDJPY' ? 3 : 5)),
          low: Number(Math.min(open, low, close).toFixed(symbol === 'USDJPY' ? 3 : 5)),
          close: Number(close.toFixed(symbol === 'USDJPY' ? 3 : 5)),
          volume: Math.floor(Math.random() * 1000000) + 50000
        }
        
        history.push(candle)
      }
      
      priceHistories.value[symbol]['1m'] = history
      generateHigherTimeframes(symbol)
    })
  }
  
  // Watch for market engine changes
  watch(() => marketEngineStore.isRunning, (isRunning) => {
    if (isRunning) {
      startRealTimeUpdates()
    } else {
      stopRealTimeUpdates()
    }
  })
  
  // Cleanup on component unmount
  const cleanup = () => {
    stopRealTimeUpdates()
  }
  
  return {
    // State
    selectedSymbol,
    chartType,
    timeframe,
    account,
    positions,
    pendingOrders,
    priceHistories,
    lastCandleTimestamps,
    
    // Computed
    currentPrice,
    priceHistory,
    currentSpread,
    orderbook,
    marketStats,
    brokers,
    selectedBroker,
    accountMarginLevel,
    
    // Actions
    updateMarketData,
    updateCandleData,
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
    generateHigherTimeframes,
    initializeMarketData,
    startRealTimeUpdates,
    stopRealTimeUpdates,
    cleanup,
    
    // Access to stores
    marketEngineStore,
    brokerStore
  }
})