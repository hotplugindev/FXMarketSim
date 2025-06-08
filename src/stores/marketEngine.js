import { ref, reactive, computed } from 'vue'
import { defineStore } from 'pinia'

// Order Side Enum
export const OrderSide = {
  BUY: 'Buy',
  SELL: 'Sell'
}

// Order Type Enum
export const OrderType = {
  MARKET: 'Market',
  LIMIT: 'Limit',
  STOP: 'Stop',
  STOP_LIMIT: 'StopLimit'
}

// Participant Types
export const ParticipantType = {
  BANK: 'Bank',
  TRADER: 'Trader',
  HEDGE_FUND: 'HedgeFund',
  CORPORATION: 'Corporation',
  GOVERNMENT: 'Government',
  RETAIL_TRADER: 'RetailTrader'
}

// Trading Strategies
export const TradingStrategy = {
  CONSERVATIVE: 'Conservative',
  MODERATE: 'Moderate',
  AGGRESSIVE: 'Aggressive',
  HIGH_FREQUENCY: 'HighFrequency',
  ARBITRAGE: 'Arbitrage',
  TREND_FOLLOWING: 'TrendFollowing',
  MEAN_REVERSION: 'MeanReversion',
  MARKET_MAKING: 'MarketMaking'
}

// Broker Types
export const BrokerType = {
  DIRECT_ACCESS: 'DirectAccess',
  ECN: 'ECN',
  MARKET_MAKER: 'MarketMaker',
  STP: 'STP',
  HYBRID: 'Hybrid'
}

// Execution Models
export const ExecutionModel = {
  INSTANT_EXECUTION: 'InstantExecution',
  MARKET_EXECUTION: 'MarketExecution',
  REQUEST_EXECUTION: 'RequestExecution',
  EXCHANGE_EXECUTION: 'ExchangeExecution'
}

// Order Class
class Order {
  constructor(data) {
    this.id = data.id || this.generateId()
    this.symbol = data.symbol
    this.side = data.side
    this.amount = data.amount
    this.price = data.price
    this.timestamp = data.timestamp || Date.now()
    this.participantId = data.participantId
    this.orderType = data.orderType || OrderType.MARKET
  }

  generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9)
  }
}

// Trade Class
class Trade {
  constructor(data) {
    this.id = this.generateId()
    this.symbol = data.symbol
    this.buyerId = data.buyerId
    this.sellerId = data.sellerId
    this.price = data.price
    this.volume = data.volume
    this.timestamp = Date.now()
    this.tradeType = data.tradeType || 'Market'
  }

  generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9)
  }
}

// OrderBook Class
class OrderBook {
  constructor(symbol) {
    this.symbol = symbol
    this.bids = new Map() // price -> orders array
    this.asks = new Map() // price -> orders array
    this.lastTradePrice = 1.0
    this.totalVolume = 0
  }

  addOrder(order) {
    const trades = []
    
    switch (order.orderType) {
      case OrderType.MARKET:
        return this.processMarketOrder(order)
      case OrderType.LIMIT:
        return this.processLimitOrder(order)
      case OrderType.STOP:
        return this.processStopOrder(order)
      case OrderType.STOP_LIMIT:
        return this.processStopLimitOrder(order)
      default:
        return this.processMarketOrder(order)
    }
  }

  processMarketOrder(order) {
    const trades = []
    let remainingAmount = order.amount

    if (order.side === OrderSide.BUY) {
      // Match against asks (sell orders)
      const sortedAsks = Array.from(this.asks.entries()).sort((a, b) => a[0] - b[0])
      
      for (const [price, orders] of sortedAsks) {
        if (remainingAmount <= 0) break
        
        for (let i = orders.length - 1; i >= 0; i--) {
          if (remainingAmount <= 0) break
          
          const askOrder = orders[i]
          const tradeAmount = Math.min(remainingAmount, askOrder.amount)
          
          const trade = new Trade({
            symbol: this.symbol,
            buyerId: order.participantId,
            sellerId: askOrder.participantId,
            price: price,
            volume: tradeAmount,
            tradeType: 'Market'
          })
          
          trades.push(trade)
          remainingAmount -= tradeAmount
          askOrder.amount -= tradeAmount
          this.lastTradePrice = price
          this.totalVolume += tradeAmount
          
          if (askOrder.amount <= 0) {
            orders.splice(i, 1)
          }
        }
        
        if (orders.length === 0) {
          this.asks.delete(price)
        }
      }
    } else {
      // Match against bids (buy orders)
      const sortedBids = Array.from(this.bids.entries()).sort((a, b) => b[0] - a[0])
      
      for (const [price, orders] of sortedBids) {
        if (remainingAmount <= 0) break
        
        for (let i = orders.length - 1; i >= 0; i--) {
          if (remainingAmount <= 0) break
          
          const bidOrder = orders[i]
          const tradeAmount = Math.min(remainingAmount, bidOrder.amount)
          
          const trade = new Trade({
            symbol: this.symbol,
            buyerId: bidOrder.participantId,
            sellerId: order.participantId,
            price: price,
            volume: tradeAmount,
            tradeType: 'Market'
          })
          
          trades.push(trade)
          remainingAmount -= tradeAmount
          bidOrder.amount -= tradeAmount
          this.lastTradePrice = price
          this.totalVolume += tradeAmount
          
          if (bidOrder.amount <= 0) {
            orders.splice(i, 1)
          }
        }
        
        if (orders.length === 0) {
          this.bids.delete(price)
        }
      }
    }

    return trades.length > 0 ? trades : null
  }

  processLimitOrder(order) {
    const trades = []
    let remainingOrder = { ...order }

    // First try to match immediately
    if (order.side === OrderSide.BUY) {
      const bestAsk = this.getBestAsk()
      if (bestAsk && order.price >= bestAsk) {
        const marketOrder = new Order({
          ...remainingOrder,
          orderType: OrderType.MARKET
        })
        const marketTrades = this.processMarketOrder(marketOrder)
        if (marketTrades) {
          trades.push(...marketTrades)
          const tradedVolume = marketTrades.reduce((sum, t) => sum + t.volume, 0)
          remainingOrder.amount -= tradedVolume
        }
      }
    } else {
      const bestBid = this.getBestBid()
      if (bestBid && order.price <= bestBid) {
        const marketOrder = new Order({
          ...remainingOrder,
          orderType: OrderType.MARKET
        })
        const marketTrades = this.processMarketOrder(marketOrder)
        if (marketTrades) {
          trades.push(...marketTrades)
          const tradedVolume = marketTrades.reduce((sum, t) => sum + t.volume, 0)
          remainingOrder.amount -= tradedVolume
        }
      }
    }

    // Add remaining amount to orderbook
    if (remainingOrder.amount > 0) {
      const bookSide = order.side === OrderSide.BUY ? this.bids : this.asks
      const price = order.price
      
      if (!bookSide.has(price)) {
        bookSide.set(price, [])
      }
      bookSide.get(price).push(remainingOrder)
    }

    return trades.length > 0 ? trades : null
  }

  processStopOrder(order) {
    const shouldTrigger = order.side === OrderSide.BUY 
      ? this.lastTradePrice >= order.price
      : this.lastTradePrice <= order.price

    if (shouldTrigger) {
      const marketOrder = new Order({
        ...order,
        orderType: OrderType.MARKET
      })
      return this.processMarketOrder(marketOrder)
    }
    return null
  }

  processStopLimitOrder(order) {
    const shouldTrigger = order.side === OrderSide.BUY 
      ? this.lastTradePrice >= order.price
      : this.lastTradePrice <= order.price

    if (shouldTrigger) {
      const limitOrder = new Order({
        ...order,
        orderType: OrderType.LIMIT
      })
      return this.processLimitOrder(limitOrder)
    }
    return null
  }

  getBestBid() {
    if (this.bids.size === 0) return null
    return Math.max(...this.bids.keys())
  }

  getBestAsk() {
    if (this.asks.size === 0) return null
    return Math.min(...this.asks.keys())
  }

  getSpread() {
    const bid = this.getBestBid()
    const ask = this.getBestAsk()
    return (bid && ask) ? ask - bid : null
  }

  getBids(depth = 10) {
    const result = []
    const sortedBids = Array.from(this.bids.entries()).sort((a, b) => b[0] - a[0])
    
    for (const [price, orders] of sortedBids.slice(0, depth)) {
      const totalVolume = orders.reduce((sum, order) => sum + order.amount, 0)
      result.push([price, totalVolume])
    }
    
    return result
  }

  getAsks(depth = 10) {
    const result = []
    const sortedAsks = Array.from(this.asks.entries()).sort((a, b) => a[0] - b[0])
    
    for (const [price, orders] of sortedAsks.slice(0, depth)) {
      const totalVolume = orders.reduce((sum, order) => sum + order.amount, 0)
      result.push([price, totalVolume])
    }
    
    return result
  }

  getTotalVolume() {
    return this.totalVolume
  }

  clear() {
    this.bids.clear()
    this.asks.clear()
    this.totalVolume = 0
  }
}

// Position Class
class Position {
  constructor(data) {
    this.symbol = data.symbol
    this.side = data.side
    this.volume = data.volume
    this.entryPrice = data.entryPrice
    this.currentPrice = data.currentPrice || data.entryPrice
    this.unrealizedPnl = 0
    this.timestamp = Date.now()
  }

  updatePrice(newPrice) {
    this.currentPrice = newPrice
    this.unrealizedPnl = this.side === OrderSide.BUY
      ? (newPrice - this.entryPrice) * this.volume
      : (this.entryPrice - newPrice) * this.volume
  }

  getReturnPercentage() {
    return this.side === OrderSide.BUY
      ? (this.currentPrice - this.entryPrice) / this.entryPrice * 100
      : (this.entryPrice - this.currentPrice) / this.entryPrice * 100
  }
}

// Participant Class
class Participant {
  constructor(data) {
    this.id = data.id
    this.name = data.name
    this.participantType = data.participantType
    this.balance = data.balance
    this.equity = data.balance
    this.marginUsed = 0
    this.leverage = data.leverage || this.getDefaultLeverage()
    this.positions = new Map()
    this.tradingStrategy = data.tradingStrategy || this.getDefaultStrategy()
    this.riskTolerance = data.riskTolerance || this.getDefaultRiskTolerance()
    this.active = true
    this.lastTradeTime = 0
  }

  getDefaultLeverage() {
    switch (this.participantType) {
      case ParticipantType.BANK: return 50
      case ParticipantType.HEDGE_FUND: return 10
      case ParticipantType.CORPORATION: return 5
      case ParticipantType.GOVERNMENT: return 1
      case ParticipantType.TRADER: return 100
      case ParticipantType.RETAIL_TRADER: return 30
      default: return 50
    }
  }

  getDefaultStrategy() {
    switch (this.participantType) {
      case ParticipantType.BANK: return TradingStrategy.MARKET_MAKING
      case ParticipantType.HEDGE_FUND: return TradingStrategy.AGGRESSIVE
      case ParticipantType.CORPORATION: return TradingStrategy.CONSERVATIVE
      case ParticipantType.GOVERNMENT: return TradingStrategy.CONSERVATIVE
      case ParticipantType.TRADER: return TradingStrategy.HIGH_FREQUENCY
      case ParticipantType.RETAIL_TRADER: return TradingStrategy.MODERATE
      default: return TradingStrategy.MODERATE
    }
  }

  getDefaultRiskTolerance() {
    switch (this.participantType) {
      case ParticipantType.BANK: return 0.3
      case ParticipantType.HEDGE_FUND: return 0.8
      case ParticipantType.CORPORATION: return 0.2
      case ParticipantType.GOVERNMENT: return 0.1
      case ParticipantType.TRADER: return 0.6
      case ParticipantType.RETAIL_TRADER: return 0.4
      default: return 0.4
    }
  }

  addPosition(position) {
    this.positions.set(position.symbol, position)
    this.updateEquity()
  }

  closePosition(symbol) {
    const position = this.positions.get(symbol)
    if (position) {
      this.balance += position.unrealizedPnl
      this.positions.delete(symbol)
      this.updateEquity()
      return position
    }
    return null
  }

  updatePositionPrice(symbol, newPrice) {
    const position = this.positions.get(symbol)
    if (position) {
      position.updatePrice(newPrice)
      this.updateEquity()
    }
  }

  updateEquity() {
    const unrealizedPnl = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.unrealizedPnl, 0)
    this.equity = this.balance + unrealizedPnl
  }

  getFreeMargin() {
    return this.equity - this.marginUsed
  }

  canOpenPosition(requiredMargin) {
    return this.getFreeMargin() >= requiredMargin && this.active
  }

  calculatePositionSize(symbol, price, riskPercent) {
    const riskAmount = this.equity * Math.min(riskPercent, this.riskTolerance)
    const positionSize = riskAmount / price
    return positionSize * this.leverage
  }

  shouldTrade() {
    if (!this.active) return false
    
    // Prevent too frequent trading
    const timeSinceLastTrade = Date.now() - this.lastTradeTime
    const minInterval = this.getMinTradingInterval()
    if (timeSinceLastTrade < minInterval) return false

    const probability = this.getTradingProbability()
    return Math.random() < probability
  }

  getMinTradingInterval() {
    switch (this.tradingStrategy) {
      case TradingStrategy.HIGH_FREQUENCY: return 100 // 100ms
      case TradingStrategy.MARKET_MAKING: return 500 // 500ms
      case TradingStrategy.AGGRESSIVE: return 2000 // 2s
      case TradingStrategy.ARBITRAGE: return 1000 // 1s
      case TradingStrategy.MODERATE: return 5000 // 5s
      case TradingStrategy.CONSERVATIVE: return 10000 // 10s
      case TradingStrategy.TREND_FOLLOWING: return 30000 // 30s
      case TradingStrategy.MEAN_REVERSION: return 15000 // 15s
      default: return 5000
    }
  }

  getTradingProbability() {
    switch (this.tradingStrategy) {
      case TradingStrategy.HIGH_FREQUENCY: return 0.1
      case TradingStrategy.MARKET_MAKING: return 0.15
      case TradingStrategy.AGGRESSIVE: return 0.05
      case TradingStrategy.ARBITRAGE: return 0.08
      case TradingStrategy.MODERATE: return 0.02
      case TradingStrategy.CONSERVATIVE: return 0.01
      case TradingStrategy.TREND_FOLLOWING: return 0.03
      case TradingStrategy.MEAN_REVERSION: return 0.04
      default: return 0.02
    }
  }

  getPreferredSymbols() {
    switch (this.participantType) {
      case ParticipantType.BANK:
        return ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD']
      case ParticipantType.HEDGE_FUND:
        return ['EURUSD', 'GBPUSD', 'USDJPY']
      case ParticipantType.CORPORATION:
        return ['EURUSD', 'USDJPY']
      default:
        return ['EURUSD']
    }
  }

  getTypicalTradeSize() {
    const multiplier = 1 + (Math.random() - 0.5) * 0.5 // ±25% variation
    
    switch (this.participantType) {
      case ParticipantType.BANK:
        return (1000000 + Math.random() * 9000000) * multiplier // 1M - 10M
      case ParticipantType.HEDGE_FUND:
        return (100000 + Math.random() * 900000) * multiplier // 100K - 1M
      case ParticipantType.TRADER:
        return (10000 + Math.random() * 90000) * multiplier // 10K - 100K
      case ParticipantType.CORPORATION:
        return (50000 + Math.random() * 450000) * multiplier // 50K - 500K
      case ParticipantType.GOVERNMENT:
        return (1000000 + Math.random() * 4000000) * multiplier // 1M - 5M
      case ParticipantType.RETAIL_TRADER:
        return (1000 + Math.random() * 9000) * multiplier // 1K - 10K
      default:
        return 10000 * multiplier
    }
  }
}

// Market Engine Store
export const useMarketEngineStore = defineStore('marketEngine', () => {
  // State
  const symbols = ref(new Map())
  const participants = ref(new Map())
  const activeOrders = ref(new Map())
  const tradeHistory = ref([])
  const marketStats = ref({
    totalVolume: 0,
    totalTrades: 0,
    activeParticipants: 0,
    liquidityIndex: 0,
    volatility: 0
  })

  const isRunning = ref(false)
  const simulationSpeed = ref(1) // 1x speed
  const updateInterval = ref(null)

  // Market Configuration
  const config = reactive({
    participantCounts: {
      [ParticipantType.BANK]: 500,
      [ParticipantType.TRADER]: 5000,
      [ParticipantType.HEDGE_FUND]: 100,
      [ParticipantType.CORPORATION]: 200,
      [ParticipantType.GOVERNMENT]: 50,
      [ParticipantType.RETAIL_TRADER]: 10000
    },
    balanceRanges: {
      [ParticipantType.BANK]: { min: 10000000, max: 1000000000 },
      [ParticipantType.TRADER]: { min: 100000, max: 10000000 },
      [ParticipantType.HEDGE_FUND]: { min: 50000000, max: 500000000 },
      [ParticipantType.CORPORATION]: { min: 1000000, max: 100000000 },
      [ParticipantType.GOVERNMENT]: { min: 100000000, max: 1000000000 },
      [ParticipantType.RETAIL_TRADER]: { min: 1000, max: 100000 }
    },
    symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD'],
    basePrices: {
      'EURUSD': 1.0950,
      'GBPUSD': 1.2650,
      'USDJPY': 150.25,
      'USDCHF': 0.8750,
      'AUDUSD': 0.6450,
      'USDCAD': 1.3650
    },
    updateFrequency: 100, // milliseconds
    maxTradesPerUpdate: 1000
  })

  // Computed
  const totalParticipants = computed(() => {
    return Object.values(config.participantCounts).reduce((sum, count) => sum + count, 0)
  })

  const activeParticipantCount = computed(() => {
    return Array.from(participants.value.values()).filter(p => p.active).length
  })

  // Actions
  const addSymbol = (symbol) => {
    if (!symbols.value.has(symbol)) {
      symbols.value.set(symbol, new OrderBook(symbol))
    }
  }

  const addParticipant = (participant) => {
    participants.value.set(participant.id, participant)
    marketStats.value.activeParticipants = participants.value.size
  }

  const getOrderBook = (symbol) => {
    return symbols.value.get(symbol)
  }

  const placeOrder = async (symbol, side, amount, participantId, orderType = OrderType.MARKET, price = null) => {
    const orderbook = symbols.value.get(symbol)
    if (!orderbook) throw new Error(`Symbol ${symbol} not found`)

    const participant = participants.value.get(participantId)
    if (!participant) throw new Error(`Participant ${participantId} not found`)

    // Calculate price if not provided
    if (!price) {
      price = side === OrderSide.BUY ? orderbook.getBestAsk() || 1.0 : orderbook.getBestBid() || 1.0
    }

    const order = new Order({
      symbol,
      side,
      amount,
      price,
      participantId,
      orderType
    })

    const trades = orderbook.addOrder(order)
    
    if (trades) {
      for (const trade of trades) {
        executeTrade(trade)
      }
    }

    activeOrders.value.set(order.id, order)
    return order.id
  }

  const executeTrade = (trade) => {
    tradeHistory.value.push(trade)
    marketStats.value.totalTrades += 1
    marketStats.value.totalVolume += trade.volume

    // Update participant balances
    const buyer = participants.value.get(trade.buyerId)
    const seller = participants.value.get(trade.sellerId)

    if (buyer) {
      buyer.balance -= trade.price * trade.volume
      buyer.updateEquity()
    }
    if (seller) {
      seller.balance += trade.price * trade.volume
      seller.updateEquity()
    }

    // Keep trade history manageable
    if (tradeHistory.value.length > 10000) {
      tradeHistory.value = tradeHistory.value.slice(-5000)
    }
  }

  const simulateBankActivity = async () => {
    const banks = Array.from(participants.value.values())
      .filter(p => p.participantType === ParticipantType.BANK && p.active)

    const activeBanks = banks.slice(0, Math.min(50, banks.length))

    for (const bank of activeBanks) {
      if (bank.shouldTrade()) {
        const symbol = getRandomSymbol()
        const side = Math.random() < 0.5 ? OrderSide.BUY : OrderSide.SELL
        const volume = bank.getTypicalTradeSize()
        
        try {
          await placeOrder(symbol, side, volume, bank.id, OrderType.LIMIT, getMarketPrice(symbol, side))
          bank.lastTradeTime = Date.now()
        } catch (error) {
          console.warn('Bank trade failed:', error.message)
        }
      }
    }
  }

  const simulateTraderActivity = async () => {
    const traders = Array.from(participants.value.values())
      .filter(p => [ParticipantType.TRADER, ParticipantType.RETAIL_TRADER].includes(p.participantType) && p.active)

    const activeTraders = traders.slice(0, Math.min(200, traders.length))

    for (const trader of activeTraders) {
      if (trader.shouldTrade()) {
        const symbol = getRandomSymbol()
        const side = Math.random() < 0.5 ? OrderSide.BUY : OrderSide.SELL
        const volume = trader.getTypicalTradeSize()
        
        try {
          await placeOrder(symbol, side, volume, trader.id, OrderType.MARKET)
          trader.lastTradeTime = Date.now()
        } catch (error) {
          console.warn('Trader trade failed:', error.message)
        }
      }
    }
  }

  const getRandomSymbol = () => {
    const symbolArray = Array.from(symbols.value.keys())
    return symbolArray[Math.floor(Math.random() * symbolArray.length)]
  }

  const getMarketPrice = (symbol, side) => {
    const orderbook = symbols.value.get(symbol)
    if (!orderbook) return 1.0

    const basePrice = side === OrderSide.BUY 
      ? orderbook.getBestAsk() || config.basePrices[symbol] || 1.0
      : orderbook.getBestBid() || config.basePrices[symbol] || 1.0

    // Add small random variation
    const variation = (Math.random() - 0.5) * 0.001
    return basePrice * (1 + variation)
  }

  const updateMarketStats = () => {
    // Calculate liquidity index
    let totalLiquidity = 0
    for (const orderbook of symbols.value.values()) {
      totalLiquidity += orderbook.getTotalVolume()
    }
    marketStats.value.liquidityIndex = totalLiquidity / symbols.value.size

    // Calculate volatility from recent trades
    if (tradeHistory.value.length > 100) {
      const recentTrades = tradeHistory.value.slice(-100)
      const prices = recentTrades.map(t => t.price)
      
      if (prices.length > 1) {
        const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length
        marketStats.value.volatility = Math.sqrt(variance)
      }
    }

    marketStats.value.activeParticipants = activeParticipantCount.value
  }

  const initializeMarket = () => {
    console.log('Initializing market...')
    
    // Clear existing data
    symbols.value.clear()
    participants.value.clear()
    activeOrders.value.clear()
    tradeHistory.value.length = 0

    // Add symbols
    config.symbols.forEach(symbol => {
      addSymbol(symbol)
    })

    // Create user participant first
    const userParticipant = new Participant({
      id: 'user_trader',
      name: 'User Trader',
      participantType: ParticipantType.RETAIL_TRADER,
      balance: 10000, // Default user balance
      leverage: 100
    })
    addParticipant(userParticipant)

    // Generate market participants
    let participantCounter = 0
    
    Object.entries(config.participantCounts).forEach(([type, count]) => {
      const balanceRange = config.balanceRanges[type]
      
      for (let i = 0; i < count; i++) {
        const balance = balanceRange.min + Math.random() * (balanceRange.max - balanceRange.min)
        
        const participant = new Participant({
          id: `${type.toLowerCase()}_${participantCounter++}`,
          name: `${type} ${i + 1}`,
          participantType: type,
          balance: balance
        })
        
        addParticipant(participant)
      }
    })

    // Initialize some liquidity in orderbooks
    initializeLiquidity()

    console.log(`Market initialized with ${symbols.value.size} symbols and ${participants.value.size} participants`)
  }

  const initializeLiquidity = () => {
    // Add initial orders to create liquidity
    const banks = Array.from(participants.value.values())
      .filter(p => p.participantType === ParticipantType.BANK)
      .slice(0, 50)

    for (const symbol of config.symbols) {
      const basePrice = config.basePrices[symbol] || 1.0
      
      banks.forEach((bank, index) => {
        // Create bid orders
        const bidPrice = basePrice * (1 - (Math.random() * 0.002))
        const bidVolume = bank.getTypicalTradeSize() * 0.1
        
        placeOrder(symbol, OrderSide.BUY, bidVolume, bank.id, OrderType.LIMIT, bidPrice)
          .catch(() => {}) // Ignore errors during initialization
        
        // Create ask orders
        const askPrice = basePrice * (1 + (Math.random() * 0.002))
        const askVolume = bank.getTypicalTradeSize() * 0.1
        
        placeOrder(symbol, OrderSide.SELL, askVolume, bank.id, OrderType.LIMIT, askPrice)
          .catch(() => {}) // Ignore errors during initialization
      })
    }
  }

  const startSimulation = () => {
    if (isRunning.value) return

    isRunning.value = true
    
    const update = async () => {
      if (!isRunning.value) return

      try {
        await simulateBankActivity()
        await simulateTraderActivity()
        updateMarketStats()
      } catch (error) {
        console.error('Simulation update error:', error)
      }

      if (isRunning.value) {
        updateInterval.value = setTimeout(update, config.updateFrequency / simulationSpeed.value)
      }
    }

    update()
    console.log('Market simulation started')
  }

  const stopSimulation = () => {
    isRunning.value = false
    if (updateInterval.value) {
      clearTimeout(updateInterval.value)
      updateInterval.value = null
    }
    console.log('Market simulation stopped')
  }

  const resetMarket = () => {
    stopSimulation()
    initializeMarket()
  }

  const updateConfig = (newConfig) => {
    Object.assign(config, newConfig)
  }

  const getRecentTrades = (symbol, limit = 100) => {
    return tradeHistory.value
      .filter(t => t.symbol === symbol)
      .slice(-limit)
      .reverse()
  }

  const getParticipantPositions = (participantId) => {
    const participant = participants.value.get(participantId)
    return participant ? Array.from(participant.positions.values()) : []
  }

  const getUserParticipant = () => {
    return participants.value.get('user_trader')
  }

  const updateUserBalance = (newBalance) => {
    const userParticipant = getUserParticipant()
    if (userParticipant) {
      userParticipant.balance = newBalance
      userParticipant.updateEquity()
    }
  }

  return {
    // State
    symbols,
    participants,
    activeOrders,
    tradeHistory,
    marketStats,
    isRunning,
    simulationSpeed,
    config,

    // Computed
    totalParticipants,
    activeParticipantCount,

    // Actions
    addSymbol,
    addParticipant,
    getOrderBook,
    placeOrder,
    initializeMarket,
    startSimulation,
    stopSimulation,
    resetMarket,
    updateConfig,
    getRecentTrades,
    getParticipantPositions,
    getUserParticipant,
    updateUserBalance,
    getRandomSymbol,
    getMarketPrice,

    // Classes for external use
    Order,
    Trade,
    OrderBook,
    Position,
    Participant,
    
    // Enums
    OrderSide,
    OrderType,
    ParticipantType,
    TradingStrategy,
    BrokerType,
    ExecutionModel
  }
})