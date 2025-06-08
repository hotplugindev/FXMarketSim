import { ref, reactive, computed } from 'vue'
import { defineStore } from 'pinia'

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

// Liquidity Provider Class
class LiquidityProvider {
  constructor(data) {
    this.name = data.name
    this.tier = data.tier || 1 // 1 = Tier 1 bank, 2 = Tier 2, etc.
    this.weight = data.weight || 1.0 // Weight in price aggregation
    this.spreadMarkup = data.spreadMarkup || 0.00005
  }
}

// Broker Class
class Broker {
  constructor(data) {
    this.id = data.id || this.generateId()
    this.name = data.name
    this.brokerType = data.brokerType
    this.spread = data.spread || 0.0002
    this.commission = data.commission || 0
    this.executionModel = data.executionModel || this.getDefaultExecutionModel()
    this.liquidityProviders = data.liquidityProviders || this.generateLiquidityProviders()
    this.slippageFactor = data.slippageFactor || this.getDefaultSlippageFactor()
    this.requoteProbability = data.requoteProbability || this.getDefaultRequoteProbability()
    this.maxLeverage = data.maxLeverage || this.getDefaultMaxLeverage()
    this.minTradeSize = data.minTradeSize || 1000
    this.maxTradeSize = data.maxTradeSize || 100000000
    this.availableSymbols = data.availableSymbols || this.getDefaultSymbols()
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  getDefaultExecutionModel() {
    switch (this.brokerType) {
      case BrokerType.DIRECT_ACCESS:
        return ExecutionModel.EXCHANGE_EXECUTION
      case BrokerType.ECN:
        return ExecutionModel.MARKET_EXECUTION
      case BrokerType.MARKET_MAKER:
        return ExecutionModel.INSTANT_EXECUTION
      case BrokerType.STP:
        return ExecutionModel.MARKET_EXECUTION
      case BrokerType.HYBRID:
        return ExecutionModel.REQUEST_EXECUTION
      default:
        return ExecutionModel.MARKET_EXECUTION
    }
  }

  generateLiquidityProviders() {
    switch (this.brokerType) {
      case BrokerType.DIRECT_ACCESS:
        return [
          new LiquidityProvider({
            name: 'Liquidity Pool Direct',
            tier: 0,
            weight: 1.0,
            spreadMarkup: 0.0
          })
        ]

      case BrokerType.ECN:
        return [
          new LiquidityProvider({
            name: 'Deutsche Bank',
            tier: 1,
            weight: 0.25,
            spreadMarkup: 0.00005
          }),
          new LiquidityProvider({
            name: 'Citibank',
            tier: 1,
            weight: 0.25,
            spreadMarkup: 0.00008
          }),
          new LiquidityProvider({
            name: 'JP Morgan',
            tier: 1,
            weight: 0.25,
            spreadMarkup: 0.00006
          }),
          new LiquidityProvider({
            name: 'UBS',
            tier: 1,
            weight: 0.25,
            spreadMarkup: 0.00007
          })
        ]

      case BrokerType.MARKET_MAKER:
        return [
          new LiquidityProvider({
            name: 'Internal Market Making',
            tier: 3,
            weight: 1.0,
            spreadMarkup: 0.0002
          })
        ]

      case BrokerType.STP:
        return [
          new LiquidityProvider({
            name: 'Bank Consortium',
            tier: 2,
            weight: 0.6,
            spreadMarkup: 0.00012
          }),
          new LiquidityProvider({
            name: 'ECN Pool',
            tier: 1,
            weight: 0.4,
            spreadMarkup: 0.00008
          })
        ]

      case BrokerType.HYBRID:
        return [
          new LiquidityProvider({
            name: 'Tier 1 Banks',
            tier: 1,
            weight: 0.7,
            spreadMarkup: 0.00010
          }),
          new LiquidityProvider({
            name: 'Internal MM',
            tier: 3,
            weight: 0.3,
            spreadMarkup: 0.00015
          })
        ]

      default:
        return []
    }
  }

  getDefaultSlippageFactor() {
    switch (this.brokerType) {
      case BrokerType.DIRECT_ACCESS: return 0.0001
      case BrokerType.ECN: return 0.0002
      case BrokerType.MARKET_MAKER: return 0.0005
      case BrokerType.STP: return 0.0003
      case BrokerType.HYBRID: return 0.0004
      default: return 0.0002
    }
  }

  getDefaultRequoteProbability() {
    switch (this.brokerType) {
      case BrokerType.DIRECT_ACCESS: return 0.02
      case BrokerType.ECN: return 0.01
      case BrokerType.MARKET_MAKER: return 0.15
      case BrokerType.STP: return 0.05
      case BrokerType.HYBRID: return 0.08
      default: return 0.05
    }
  }

  getDefaultMaxLeverage() {
    switch (this.brokerType) {
      case BrokerType.DIRECT_ACCESS: return 500
      case BrokerType.ECN: return 200
      case BrokerType.MARKET_MAKER: return 100
      case BrokerType.STP: return 300
      case BrokerType.HYBRID: return 200
      default: return 100
    }
  }

  getDefaultSymbols() {
    switch (this.brokerType) {
      case BrokerType.DIRECT_ACCESS:
        return [
          'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 
          'AUDUSD', 'USDCAD', 'NZDUSD', 'EURGBP', 
          'EURJPY', 'GBPJPY'
        ]
      case BrokerType.ECN:
        return [
          'EURUSD', 'GBPUSD', 'USDJPY', 
          'USDCHF', 'AUDUSD', 'USDCAD'
        ]
      default:
        return ['EURUSD', 'GBPUSD', 'USDJPY']
    }
  }

  processOrder(order) {
    // Apply broker-specific processing
    const processedOrder = { ...order }
    
    // Adjust price for execution
    processedOrder.price = this.adjustPriceForExecution(order.price, order.side)
    
    // Apply slippage
    if (this.shouldApplySlippage()) {
      processedOrder.price = this.applySlippage(processedOrder.price, order.side)
    }
    
    // Check for requotes
    if (this.shouldRequote()) {
      const requoteAdjustment = this.calculateRequoteAdjustment()
      processedOrder.price *= (1 + requoteAdjustment)
    }
    
    return processedOrder
  }

  adjustPriceForExecution(price, side) {
    switch (this.brokerType) {
      case BrokerType.DIRECT_ACCESS:
        return price // No adjustment

      case BrokerType.ECN:
        return this.aggregateLiquidityProviderPrices(price, side)

      case BrokerType.MARKET_MAKER:
        return side === 'Buy' 
          ? price + this.spread / 2 
          : price - this.spread / 2

      case BrokerType.STP:
      case BrokerType.HYBRID:
        return this.aggregateLiquidityProviderPrices(price, side)

      default:
        return price
    }
  }

  aggregateLiquidityProviderPrices(basePrice, side) {
    let weightedPrice = 0
    let totalWeight = 0
    
    for (const provider of this.liquidityProviders) {
      const providerPrice = side === 'Buy'
        ? basePrice + provider.spreadMarkup
        : basePrice - provider.spreadMarkup
      
      weightedPrice += providerPrice * provider.weight
      totalWeight += provider.weight
    }
    
    return totalWeight > 0 ? weightedPrice / totalWeight : basePrice
  }

  shouldApplySlippage() {
    return Math.random() < 0.3 // 30% chance of slippage
  }

  applySlippage(price, side) {
    const slippage = Math.random() * this.slippageFactor
    return side === 'Buy' ? price + slippage : price - slippage
  }

  shouldRequote() {
    return Math.random() < this.requoteProbability
  }

  calculateRequoteAdjustment() {
    return (Math.random() - 0.5) * 0.001 // ±0.05% adjustment
  }

  calculateCommission(volume) {
    switch (this.brokerType) {
      case BrokerType.ECN:
        return this.commission * (volume / 100000) // Per lot
      case BrokerType.DIRECT_ACCESS:
        return volume * 0.000001 // 0.0001% of volume
      default:
        return 0 // Spread-based brokers typically don't charge commission
    }
  }

  calculateSwap(symbol, side, volume) {
    const baseSwapRates = {
      'EURUSD': { Buy: -0.5, Sell: -2.1 },
      'GBPUSD': { Buy: 0.8, Sell: -3.2 },
      'USDJPY': { Buy: 2.1, Sell: -5.4 },
      'USDCHF': { Buy: 1.2, Sell: -2.8 },
      'AUDUSD': { Buy: -1.5, Sell: -0.3 },
      'USDCAD': { Buy: 0.5, Sell: -1.8 }
    }
    
    const rates = baseSwapRates[symbol]
    if (!rates) return 0
    
    const baseSwapRate = rates[side] || 0
    return (baseSwapRate * volume) / 100000 // Per lot
  }

  getEffectiveSpread(symbol) {
    const baseSpread = this.getBaseSpread(symbol)
    return baseSpread + this.spread
  }

  getBaseSpread(symbol) {
    const baseSpreads = {
      'EURUSD': 0.00015,
      'GBPUSD': 0.00020,
      'USDJPY': 0.015,
      'USDCHF': 0.00018,
      'AUDUSD': 0.00025,
      'USDCAD': 0.00022
    }
    return baseSpreads[symbol] || 0.0002
  }

  canExecuteOrder(order) {
    // Check trade size limits
    if (order.amount < this.minTradeSize || order.amount > this.maxTradeSize) {
      return false
    }
    
    // Check symbol availability
    if (!this.availableSymbols.includes(order.symbol)) {
      return false
    }
    
    // Broker-specific checks
    switch (this.brokerType) {
      case BrokerType.MARKET_MAKER:
        // Market makers might reject orders during high volatility
        return Math.random() > 0.05 // 5% rejection rate
      default:
        return true
    }
  }

  getExecutionSpeedMs() {
    const baseSpeed = {
      [ExecutionModel.INSTANT_EXECUTION]: () => 1 + Math.random() * 9,
      [ExecutionModel.MARKET_EXECUTION]: () => 10 + Math.random() * 40,
      [ExecutionModel.REQUEST_EXECUTION]: () => 100 + Math.random() * 400,
      [ExecutionModel.EXCHANGE_EXECUTION]: () => 1 + Math.random() * 4
    }
    
    const speedFn = baseSpeed[this.executionModel]
    return speedFn ? Math.round(speedFn()) : 50
  }

  getMarginRequirement(symbol, volume, leverage) {
    const effectiveLeverage = Math.min(leverage, this.maxLeverage)
    const notionalValue = this.calculateNotionalValue(symbol, volume)
    return notionalValue / effectiveLeverage
  }

  calculateNotionalValue(symbol, volume) {
    // Simplified notional value calculation
    return symbol === 'USDJPY' ? volume * 100 : volume
  }
}

// Broker Store
export const useBrokerStore = defineStore('broker', () => {
  // State
  const brokers = ref(new Map())
  const selectedBrokerId = ref(null)
  
  // Broker configuration templates
  const brokerTemplates = reactive({
    [BrokerType.DIRECT_ACCESS]: {
      name: 'Direct Access Pro',
      spread: 0.0001,
      commission: 0,
      description: 'Direct access to liquidity pool with minimal spreads and fastest execution'
    },
    [BrokerType.ECN]: {
      name: 'ECN Elite',
      spread: 0.0,
      commission: 3.5,
      description: 'Electronic Communication Network with multiple liquidity providers'
    },
    [BrokerType.MARKET_MAKER]: {
      name: 'Market Maker Standard',
      spread: 0.0003,
      commission: 0,
      description: 'Creates own prices with wider spreads but no commission'
    },
    [BrokerType.STP]: {
      name: 'STP Professional',
      spread: 0.00015,
      commission: 0,
      description: 'Straight Through Processing with bank consortium'
    },
    [BrokerType.HYBRID]: {
      name: 'Hybrid Advanced',
      spread: 0.0002,
      commission: 1.5,
      description: 'Combination of ECN and Market Maker features'
    }
  })

  // Computed
  const selectedBroker = computed(() => {
    return selectedBrokerId.value ? brokers.value.get(selectedBrokerId.value) : null
  })

  const brokerList = computed(() => {
    return Array.from(brokers.value.values())
  })

  const availableBrokerTypes = computed(() => {
    return Object.values(BrokerType)
  })

  // Actions
  const createBroker = (brokerData) => {
    const broker = new Broker(brokerData)
    brokers.value.set(broker.id, broker)
    return broker
  }

  const deleteBroker = (brokerId) => {
    const deleted = brokers.value.delete(brokerId)
    if (selectedBrokerId.value === brokerId) {
      selectedBrokerId.value = null
    }
    return deleted
  }

  const updateBroker = (brokerId, updates) => {
    const broker = brokers.value.get(brokerId)
    if (broker) {
      Object.assign(broker, updates)
      
      // Regenerate dependent properties if broker type changed
      if (updates.brokerType && updates.brokerType !== broker.brokerType) {
        broker.executionModel = broker.getDefaultExecutionModel()
        broker.liquidityProviders = broker.generateLiquidityProviders()
        broker.slippageFactor = broker.getDefaultSlippageFactor()
        broker.requoteProbability = broker.getDefaultRequoteProbability()
        broker.maxLeverage = broker.getDefaultMaxLeverage()
        broker.availableSymbols = broker.getDefaultSymbols()
      }
      
      return true
    }
    return false
  }

  const selectBroker = (brokerId) => {
    if (brokers.value.has(brokerId)) {
      selectedBrokerId.value = brokerId
      return true
    }
    return false
  }

  const getBroker = (brokerId) => {
    return brokers.value.get(brokerId)
  }

  const initializeDefaultBrokers = () => {
    // Clear existing brokers
    brokers.value.clear()
    
    // Create default brokers
    Object.entries(BrokerType).forEach(([key, brokerType]) => {
      const template = brokerTemplates[brokerType]
      if (template) {
        const broker = createBroker({
          name: template.name,
          brokerType: brokerType,
          spread: template.spread,
          commission: template.commission
        })
        
        // Select first broker as default
        if (selectedBrokerId.value === null) {
          selectedBrokerId.value = broker.id
        }
      }
    })
    
    console.log(`Initialized ${brokers.value.size} default brokers`)
  }

  const processOrderWithBroker = (brokerId, order) => {
    const broker = brokers.value.get(brokerId)
    if (!broker) {
      throw new Error(`Broker ${brokerId} not found`)
    }
    
    if (!broker.canExecuteOrder(order)) {
      throw new Error(`Order cannot be executed by broker ${broker.name}`)
    }
    
    return broker.processOrder(order)
  }

  const calculateTradingCosts = (brokerId, symbol, side, volume, leverage = 100) => {
    const broker = brokers.value.get(brokerId)
    if (!broker) return null
    
    const commission = broker.calculateCommission(volume)
    const spread = broker.getEffectiveSpread(symbol)
    const swap = broker.calculateSwap(symbol, side, volume)
    const marginRequired = broker.getMarginRequirement(symbol, volume, leverage)
    
    return {
      commission,
      spread,
      swap,
      marginRequired,
      total: commission + Math.abs(swap)
    }
  }

  const getBrokerPerformanceMetrics = (brokerId) => {
    const broker = brokers.value.get(brokerId)
    if (!broker) return null
    
    return {
      executionSpeed: broker.getExecutionSpeedMs(),
      slippageFactor: broker.slippageFactor,
      requoteProbability: broker.requoteProbability,
      maxLeverage: broker.maxLeverage,
      symbolCount: broker.availableSymbols.length,
      liquidityProviders: broker.liquidityProviders.length
    }
  }

  const exportBrokerConfig = () => {
    const config = {}
    brokers.value.forEach((broker, id) => {
      config[id] = {
        id: broker.id,
        name: broker.name,
        brokerType: broker.brokerType,
        spread: broker.spread,
        commission: broker.commission,
        slippageFactor: broker.slippageFactor,
        requoteProbability: broker.requoteProbability,
        maxLeverage: broker.maxLeverage,
        minTradeSize: broker.minTradeSize,
        maxTradeSize: broker.maxTradeSize,
        availableSymbols: broker.availableSymbols
      }
    })
    return config
  }

  const importBrokerConfig = (config) => {
    brokers.value.clear()
    selectedBrokerId.value = null
    
    Object.values(config).forEach(brokerData => {
      const broker = createBroker(brokerData)
      if (selectedBrokerId.value === null) {
        selectedBrokerId.value = broker.id
      }
    })
  }

  const resetToDefaults = () => {
    initializeDefaultBrokers()
  }

  return {
    // State
    brokers,
    selectedBrokerId,
    brokerTemplates,

    // Computed
    selectedBroker,
    brokerList,
    availableBrokerTypes,

    // Actions
    createBroker,
    deleteBroker,
    updateBroker,
    selectBroker,
    getBroker,
    initializeDefaultBrokers,
    processOrderWithBroker,
    calculateTradingCosts,
    getBrokerPerformanceMetrics,
    exportBrokerConfig,
    importBrokerConfig,
    resetToDefaults,

    // Classes for external use
    Broker,
    LiquidityProvider,

    // Enums
    BrokerType,
    ExecutionModel
  }
})