<template>
  <div class="market-configuration">
    <header class="config-header">
      <h2>Market Configuration</h2>
      <div class="config-actions">
        <button @click="exportConfiguration" class="btn btn-export">Export Config</button>
        <button @click="importConfiguration" class="btn btn-import">Import Config</button>
        <button @click="resetToDefaults" class="btn btn-reset">Reset to Defaults</button>
        <button @click="applyConfiguration" class="btn btn-apply">Apply & Restart Market</button>
      </div>
    </header>

    <div class="config-content">
      <!-- Market Overview -->
      <div class="config-section">
        <h3>Market Overview</h3>
        <div class="overview-stats">
          <div class="stat-card">
            <div class="stat-label">Total Participants</div>
            <div class="stat-value">{{ marketEngineStore.totalParticipants.toLocaleString() }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Active Participants</div>
            <div class="stat-value">
              {{ marketEngineStore.activeParticipantCount.toLocaleString() }}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Symbols</div>
            <div class="stat-value">{{ marketEngineStore.config.symbols.length }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Brokers</div>
            <div class="stat-value">{{ brokerStore.brokerList.length }}</div>
          </div>
        </div>
      </div>

      <!-- Simulation Settings -->
      <div class="config-section">
        <h3>Simulation Settings</h3>
        <div class="form-grid">
          <div class="form-group">
            <label>Update Frequency (ms)</label>
            <input
              v-model.number="localConfig.updateFrequency"
              type="number"
              min="10"
              max="10000"
              step="10"
              class="form-control"
            />
          </div>
          <div class="form-group">
            <label>Max Trades Per Update</label>
            <input
              v-model.number="localConfig.maxTradesPerUpdate"
              type="number"
              min="10"
              max="10000"
              step="10"
              class="form-control"
            />
          </div>
          <div class="form-group">
            <label>Simulation Speed</label>
            <select v-model.number="marketEngineStore.simulationSpeed" class="form-control">
              <option :value="0.1">0.1x (Very Slow)</option>
              <option :value="0.5">0.5x (Slow)</option>
              <option :value="1">1x (Normal)</option>
              <option :value="2">2x (Fast)</option>
              <option :value="5">5x (Very Fast)</option>
              <option :value="10">10x (Ultra Fast)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Market Status</label>
            <div class="toggle-control">
              <button
                @click="toggleMarket"
                :class="['btn', marketEngineStore.isRunning ? 'btn-stop' : 'btn-start']"
              >
                {{ marketEngineStore.isRunning ? 'Stop Market' : 'Start Market' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Participant Configuration -->
      <div class="config-section">
        <h3>Participant Configuration</h3>
        <div class="participant-config">
          <div v-for="(type, key) in ParticipantType" :key="key" class="participant-type-config">
            <div class="type-header">
              <h4>{{ formatParticipantType(type) }}</h4>
              <div class="type-badge" :class="type.toLowerCase()">{{ type }}</div>
            </div>

            <div class="type-controls">
              <div class="form-group">
                <label>Count</label>
                <input
                  v-model.number="localConfig.participantCounts[type]"
                  type="number"
                  min="0"
                  max="100000"
                  step="10"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label>Min Balance ($)</label>
                <input
                  v-model.number="localConfig.balanceRanges[type].min"
                  type="number"
                  min="100"
                  step="1000"
                  class="form-control"
                />
              </div>

              <div class="form-group">
                <label>Max Balance ($)</label>
                <input
                  v-model.number="localConfig.balanceRanges[type].max"
                  type="number"
                  min="1000"
                  step="10000"
                  class="form-control"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Symbol Configuration -->
      <div class="config-section">
        <h3>Symbol Configuration</h3>
        <div class="symbol-config">
          <div class="symbol-list">
            <div v-for="(symbol, index) in localConfig.symbols" :key="index" class="symbol-item">
              <input
                v-model="localConfig.symbols[index]"
                type="text"
                class="form-control symbol-input"
                placeholder="EURUSD"
              />
              <input
                v-model.number="localConfig.basePrices[symbol]"
                type="number"
                step="0.00001"
                class="form-control price-input"
                placeholder="1.0950"
              />
              <button
                @click="removeSymbol(index)"
                class="btn btn-remove"
                :disabled="localConfig.symbols.length <= 1"
              >
                Remove
              </button>
            </div>
          </div>

          <button @click="addSymbol" class="btn btn-add">Add Symbol</button>
        </div>
      </div>

      <!-- Broker Configuration -->
      <div class="config-section">
        <h3>Broker Configuration</h3>
        <div class="broker-config">
          <div class="broker-list">
            <div v-for="broker in brokerStore.brokerList" :key="broker.id" class="broker-item">
              <div class="broker-header">
                <h4>{{ broker.name }}</h4>
                <div class="broker-type-badge" :class="broker.brokerType.toLowerCase()">
                  {{ broker.brokerType }}
                </div>
                <button
                  @click="removeBroker(broker.id)"
                  class="btn btn-remove"
                  :disabled="brokerStore.brokerList.length <= 1"
                >
                  Remove
                </button>
              </div>

              <div class="broker-controls">
                <div class="form-group">
                  <label>Name</label>
                  <input
                    :value="broker.name"
                    @input="updateBroker(broker.id, { name: $event.target.value })"
                    type="text"
                    class="form-control"
                  />
                </div>

                <div class="form-group">
                  <label>Type</label>
                  <select
                    :value="broker.brokerType"
                    @change="updateBroker(broker.id, { brokerType: $event.target.value })"
                    class="form-control"
                  >
                    <option v-for="type in BrokerType" :key="type" :value="type">
                      {{ type }}
                    </option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Spread</label>
                  <input
                    :value="broker.spread"
                    @input="updateBroker(broker.id, { spread: parseFloat($event.target.value) })"
                    type="number"
                    step="0.00001"
                    min="0"
                    class="form-control"
                  />
                </div>

                <div class="form-group">
                  <label>Commission ($)</label>
                  <input
                    :value="broker.commission"
                    @input="
                      updateBroker(broker.id, { commission: parseFloat($event.target.value) })
                    "
                    type="number"
                    step="0.1"
                    min="0"
                    class="form-control"
                  />
                </div>

                <div class="form-group">
                  <label>Max Leverage</label>
                  <input
                    :value="broker.maxLeverage"
                    @input="updateBroker(broker.id, { maxLeverage: parseInt($event.target.value) })"
                    type="number"
                    min="1"
                    max="1000"
                    class="form-control"
                  />
                </div>

                <div class="form-group">
                  <label>Slippage Factor</label>
                  <input
                    :value="broker.slippageFactor"
                    @input="
                      updateBroker(broker.id, { slippageFactor: parseFloat($event.target.value) })
                    "
                    type="number"
                    step="0.0001"
                    min="0"
                    max="0.01"
                    class="form-control"
                  />
                </div>

                <div class="form-group">
                  <label>Requote Probability</label>
                  <input
                    :value="broker.requoteProbability"
                    @input="
                      updateBroker(broker.id, {
                        requoteProbability: parseFloat($event.target.value),
                      })
                    "
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    class="form-control"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="add-broker-section">
            <h4>Add New Broker</h4>
            <div class="new-broker-form">
              <div class="form-group">
                <label>Broker Type</label>
                <select v-model="newBroker.type" class="form-control">
                  <option v-for="type in BrokerType" :key="type" :value="type">
                    {{ type }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Name</label>
                <input
                  v-model="newBroker.name"
                  type="text"
                  class="form-control"
                  placeholder="Broker Name"
                />
              </div>
              <button @click="addBroker" class="btn btn-add">Add Broker</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Advanced Settings -->
      <div class="config-section">
        <h3>Advanced Settings</h3>
        <div class="advanced-settings">
          <div class="form-group">
            <label>
              <input v-model="localConfig.enableVolumeTracking" type="checkbox" />
              Enable Volume Tracking
            </label>
          </div>

          <div class="form-group">
            <label>
              <input v-model="localConfig.enableLatencySimulation" type="checkbox" />
              Enable Latency Simulation
            </label>
          </div>

          <div class="form-group">
            <label>
              <input v-model="localConfig.enableNewsEvents" type="checkbox" />
              Enable News Events
            </label>
          </div>

          <div class="form-group">
            <label>Market Volatility Multiplier</label>
            <input
              v-model.number="localConfig.volatilityMultiplier"
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              class="form-control"
            />
          </div>

          <div class="form-group">
            <label>Liquidity Depth</label>
            <input
              v-model.number="localConfig.liquidityDepth"
              type="number"
              step="0.1"
              min="0.1"
              max="5"
              class="form-control"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Import/Export Modal -->
    <div v-if="showConfigModal" class="modal-overlay" @click="closeConfigModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h3>{{ modalType === 'export' ? 'Export Configuration' : 'Import Configuration' }}</h3>
          <button @click="closeConfigModal" class="btn-close">×</button>
        </div>

        <div class="modal-body">
          <textarea
            v-model="configText"
            class="config-textarea"
            :placeholder="
              modalType === 'export'
                ? 'Configuration will appear here...'
                : 'Paste configuration JSON here...'
            "
            :readonly="modalType === 'export'"
          ></textarea>
        </div>

        <div class="modal-footer">
          <button @click="closeConfigModal" class="btn btn-cancel">Cancel</button>
          <button v-if="modalType === 'export'" @click="copyToClipboard" class="btn btn-copy">
            Copy to Clipboard
          </button>
          <button v-if="modalType === 'import'" @click="importFromText" class="btn btn-import">
            Import
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import { useMarketEngineStore, ParticipantType } from '../stores/marketEngine'
import { useBrokerStore, BrokerType } from '../stores/brokerStore'

const marketEngineStore = useMarketEngineStore()
const brokerStore = useBrokerStore()

// Local configuration state
const localConfig = reactive({
  updateFrequency: 100,
  maxTradesPerUpdate: 1000,
  participantCounts: { ...marketEngineStore.config.participantCounts },
  balanceRanges: JSON.parse(JSON.stringify(marketEngineStore.config.balanceRanges)),
  symbols: [...marketEngineStore.config.symbols],
  basePrices: { ...marketEngineStore.config.basePrices },
  enableVolumeTracking: true,
  enableLatencySimulation: false,
  enableNewsEvents: false,
  volatilityMultiplier: 1.0,
  liquidityDepth: 1.0,
})

// New broker form
const newBroker = reactive({
  type: BrokerType.ECN,
  name: '',
})

// Modal state
const showConfigModal = ref(false)
const modalType = ref('export') // 'export' or 'import'
const configText = ref('')

// Watch for changes in market engine config
watch(
  () => marketEngineStore.config,
  (newConfig) => {
    Object.assign(localConfig, {
      participantCounts: { ...newConfig.participantCounts },
      balanceRanges: JSON.parse(JSON.stringify(newConfig.balanceRanges)),
      symbols: [...newConfig.symbols],
      basePrices: { ...newConfig.basePrices },
      updateFrequency: newConfig.updateFrequency,
      maxTradesPerUpdate: newConfig.maxTradesPerUpdate,
    })
  },
  { deep: true },
)

const formatParticipantType = (type) => {
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

const toggleMarket = () => {
  if (marketEngineStore.isRunning) {
    marketEngineStore.stopSimulation()
  } else {
    marketEngineStore.startSimulation()
  }
}

const addSymbol = () => {
  const newSymbol = `CUSTOM${localConfig.symbols.length + 1}`
  localConfig.symbols.push(newSymbol)
  localConfig.basePrices[newSymbol] = 1.0
}

const removeSymbol = (index) => {
  if (localConfig.symbols.length > 1) {
    const symbol = localConfig.symbols[index]
    localConfig.symbols.splice(index, 1)
    delete localConfig.basePrices[symbol]
  }
}

const addBroker = () => {
  if (newBroker.name.trim()) {
    const template = brokerStore.brokerTemplates[newBroker.type]
    brokerStore.createBroker({
      name: newBroker.name,
      brokerType: newBroker.type,
      spread: template.spread,
      commission: template.commission,
    })

    newBroker.name = ''
  }
}

const removeBroker = (brokerId) => {
  if (brokerStore.brokerList.length > 1) {
    brokerStore.deleteBroker(brokerId)
  }
}

const updateBroker = (brokerId, updates) => {
  brokerStore.updateBroker(brokerId, updates)
}

const applyConfiguration = () => {
  // Stop market if running
  const wasRunning = marketEngineStore.isRunning
  if (wasRunning) {
    marketEngineStore.stopSimulation()
  }

  // Update market engine config
  marketEngineStore.updateConfig(localConfig)

  // Reinitialize market with new config
  marketEngineStore.initializeMarket()

  // Restart if it was running
  if (wasRunning) {
    setTimeout(() => {
      marketEngineStore.startSimulation()
    }, 1000)
  }

  console.log('Configuration applied and market reinitialized')
}

const exportConfiguration = () => {
  const config = {
    market: {
      ...localConfig,
      currentParticipants: marketEngineStore.participants.size,
      currentSymbols: Array.from(marketEngineStore.symbols.keys()),
    },
    brokers: brokerStore.exportBrokerConfig(),
    timestamp: new Date().toISOString(),
  }

  configText.value = JSON.stringify(config, null, 2)
  modalType.value = 'export'
  showConfigModal.value = true
}

const importConfiguration = () => {
  configText.value = ''
  modalType.value = 'import'
  showConfigModal.value = true
}

const importFromText = () => {
  try {
    const config = JSON.parse(configText.value)

    // Validate config structure
    if (!config.market || !config.brokers) {
      throw new Error('Invalid configuration format')
    }

    // Import market config
    Object.assign(localConfig, config.market)

    // Import broker config
    brokerStore.importBrokerConfig(config.brokers)

    // Apply the configuration
    applyConfiguration()

    closeConfigModal()
    console.log('Configuration imported successfully')
  } catch (error) {
    console.error('Failed to import configuration:', error)
    alert('Failed to import configuration: ' + error.message)
  }
}

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(configText.value)
    console.log('Configuration copied to clipboard')
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = configText.value
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }
}

const closeConfigModal = () => {
  showConfigModal.value = false
  configText.value = ''
}

const resetToDefaults = () => {
  if (
    confirm(
      'Are you sure you want to reset all settings to defaults? This will clear all current configuration.',
    )
  ) {
    // Reset market config to defaults
    Object.assign(localConfig, {
      updateFrequency: 100,
      maxTradesPerUpdate: 1000,
      participantCounts: {
        [ParticipantType.BANK]: 500,
        [ParticipantType.TRADER]: 5000,
        [ParticipantType.HEDGE_FUND]: 100,
        [ParticipantType.CORPORATION]: 200,
        [ParticipantType.GOVERNMENT]: 50,
        [ParticipantType.RETAIL_TRADER]: 10000,
      },
      balanceRanges: {
        [ParticipantType.BANK]: { min: 10000000, max: 1000000000 },
        [ParticipantType.TRADER]: { min: 100000, max: 10000000 },
        [ParticipantType.HEDGE_FUND]: { min: 50000000, max: 500000000 },
        [ParticipantType.CORPORATION]: { min: 1000000, max: 100000000 },
        [ParticipantType.GOVERNMENT]: { min: 100000000, max: 1000000000 },
        [ParticipantType.RETAIL_TRADER]: { min: 1000, max: 100000 },
      },
      symbols: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD'],
      basePrices: {
        EURUSD: 1.095,
        GBPUSD: 1.265,
        USDJPY: 150.25,
        USDCHF: 0.875,
        AUDUSD: 0.645,
        USDCAD: 1.365,
      },
      enableVolumeTracking: true,
      enableLatencySimulation: false,
      enableNewsEvents: false,
      volatilityMultiplier: 1.0,
      liquidityDepth: 1.0,
    })

    // Reset brokers to defaults
    brokerStore.resetToDefaults()

    console.log('Reset to default configuration')
  }
}

onMounted(() => {
  // Initialize default brokers if none exist
  if (brokerStore.brokerList.length === 0) {
    brokerStore.initializeDefaultBrokers()
  }
})
</script>

<style scoped>
.market-configuration {
  background: #1a1a1a;
  min-height: 100vh;
  color: #ffffff;
  overflow-y: auto;
}

.config-header {
  background: #2d2d2d;
  padding: 1.5rem;
  border-bottom: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.config-header h2 {
  margin: 0;
  color: #00ff88;
  font-size: 1.8rem;
}

.config-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.config-content {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.config-section {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  border: 1px solid #444;
}

.config-section h3 {
  margin: 0 0 1.5rem 0;
  color: #00ff88;
  font-size: 1.4rem;
  border-bottom: 1px solid #444;
  padding-bottom: 0.75rem;
}

/* Overview Stats */
.overview-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  padding: 1rem;
  text-align: center;
}

.stat-label {
  color: #888;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.stat-value {
  color: #00ff88;
  font-size: 1.8rem;
  font-weight: 600;
}

/* Form Elements */
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  color: #ccc;
  font-size: 0.95rem;
  font-weight: 500;
}

.form-control {
  padding: 0.75rem;
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-size: 0.95rem;
}

.form-control:focus {
  outline: none;
  border-color: #00ff88;
}

.toggle-control {
  display: flex;
  align-items: center;
}

/* Buttons */
.btn {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-export {
  background: #4ecdc4;
  color: #000;
}

.btn-export:hover {
  background: #26a69a;
}

.btn-import {
  background: #ffd93d;
  color: #000;
}

.btn-import:hover {
  background: #ffcc02;
}

.btn-reset {
  background: #ff6b6b;
  color: #fff;
}

.btn-reset:hover {
  background: #ff5252;
}

.btn-apply {
  background: #00ff88;
  color: #000;
}

.btn-apply:hover {
  background: #00cc6a;
}

.btn-start {
  background: #00ff88;
  color: #000;
}

.btn-start:hover {
  background: #00cc6a;
}

.btn-stop {
  background: #ff6b6b;
  color: #fff;
}

.btn-stop:hover {
  background: #ff5252;
}

.btn-add {
  background: #4ecdc4;
  color: #000;
}

.btn-add:hover {
  background: #26a69a;
}

.btn-remove {
  background: #ff6b6b;
  color: #fff;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
}

.btn-remove:hover:not(:disabled) {
  background: #ff5252;
}

.btn-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Participant Configuration */
.participant-config {
  display: grid;
  gap: 1.5rem;
}

.participant-type-config {
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  padding: 1.25rem;
}

.type-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.type-header h4 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.type-badge {
  padding: 0.3rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.type-badge.bank {
  background: rgba(0, 255, 136, 0.3);
  color: #00ff88;
}

.type-badge.trader {
  background: rgba(78, 205, 196, 0.3);
  color: #4ecdc4;
}

.type-badge.hedgefund {
  background: rgba(255, 217, 61, 0.3);
  color: #ffd93d;
}

.type-badge.corporation {
  background: rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
}

.type-badge.government {
  background: rgba(156, 39, 176, 0.3);
  color: #9c27b0;
}

.type-badge.retailtrader {
  background: rgba(255, 152, 0, 0.3);
  color: #ff9800;
}

.type-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

/* Symbol Configuration */
.symbol-config {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.symbol-list {
  display: grid;
  gap: 0.75rem;
}

.symbol-item {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.75rem;
  align-items: center;
}

.symbol-input {
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
}

.price-input {
  font-family: 'Courier New', monospace;
}

/* Broker Configuration */
.broker-config {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.broker-list {
  display: grid;
  gap: 1.5rem;
}

.broker-item {
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  padding: 1.25rem;
}

.broker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.broker-header h4 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.broker-type-badge {
  padding: 0.3rem 0.75rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.broker-type-badge.directaccess {
  background: rgba(0, 255, 136, 0.3);
  color: #00ff88;
}

.broker-type-badge.ecn {
  background: rgba(78, 205, 196, 0.3);
  color: #4ecdc4;
}

.broker-type-badge.marketmaker {
  background: rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
}

.broker-type-badge.stp {
  background: rgba(255, 217, 61, 0.3);
  color: #ffd93d;
}

.broker-type-badge.hybrid {
  background: rgba(156, 39, 176, 0.3);
  color: #9c27b0;
}

.broker-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.add-broker-section {
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  padding: 1.25rem;
}

.add-broker-section h4 {
  margin: 0 0 1rem 0;
  color: #00ff88;
}

.new-broker-form {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 1rem;
  align-items: end;
}

/* Advanced Settings */
.advanced-settings {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.advanced-settings .form-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.advanced-settings input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: #00ff88;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: #2d2d2d;
  border-radius: 8px;
  border: 1px solid #444;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #444;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  color: #00ff88;
}

.btn-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.btn-close:hover {
  background: #444;
}

.modal-body {
  padding: 1.5rem;
  flex: 1;
  overflow: hidden;
}

.config-textarea {
  width: 100%;
  height: 300px;
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  color: #fff;
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  padding: 1rem;
  resize: none;
}

.config-textarea:focus {
  outline: none;
  border-color: #00ff88;
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #444;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-cancel {
  background: #666;
  color: #fff;
}

.btn-cancel:hover {
  background: #777;
}

.btn-copy {
  background: #4ecdc4;
  color: #000;
}

.btn-copy:hover {
  background: #26a69a;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .config-content {
    padding: 1.5rem;
  }

  .broker-controls {
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }

  .new-broker-form {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .config-header {
    flex-direction: column;
    align-items: stretch;
  }

  .config-actions {
    justify-content: center;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .type-controls {
    grid-template-columns: 1fr;
  }

  .symbol-item {
    grid-template-columns: 1fr;
  }

  .broker-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .broker-controls {
    grid-template-columns: 1fr;
  }

  .advanced-settings {
    grid-template-columns: 1fr;
  }

  .modal-content {
    width: 95%;
    margin: 1rem;
  }

  .modal-footer {
    flex-direction: column;
  }
}
</style>
