<template>
  <div class="broker-selector">
    <h3>Broker Selection</h3>
    
    <div class="broker-form">
      <div class="form-group">
        <label>Select Broker:</label>
        <select v-model="selectedBroker" @change="updateBroker" class="form-control">
          <option
            v-for="broker in availableBrokers"
            :key="broker.id"
            :value="broker.id"
          >
            {{ broker.name }}
          </option>
        </select>
      </div>
      
      <div v-if="currentBroker" class="broker-details">
        <div class="detail-item">
          <span class="label">Type:</span>
          <span class="value">{{ currentBroker.brokerType }}</span>
        </div>
        <div class="detail-item">
          <span class="label">Spread:</span>
          <span class="value">{{ (currentBroker.spread * 10000).toFixed(1) }} pips</span>
        </div>
        <div class="detail-item">
          <span class="label">Commission:</span>
          <span class="value">${{ currentBroker.commission.toFixed(2) }}</span>
        </div>
        <div class="detail-item">
          <span class="label">Max Leverage:</span>
          <span class="value">1:{{ currentBroker.maxLeverage }}</span>
        </div>
        <div class="detail-item">
          <span class="label">Execution Model:</span>
          <span class="value">{{ currentBroker.executionModel }}</span>
        </div>
        <div class="detail-item">
          <span class="label">Available Symbols:</span>
          <span class="value">{{ currentBroker.availableSymbols?.length || 0 }} pairs</span>
        </div>
      </div>
    </div>

    <div class="broker-info">
      <h4>Broker Types Explained</h4>
      <div class="info-sections">
        <div class="info-item">
          <div class="info-header">
            <span class="type-name">Direct Access</span>
            <span class="type-badge direct-access">DA</span>
          </div>
          <p class="info-description">
            Direct access to the liquidity pool with minimal spreads and fastest execution.
          </p>
        </div>
        
        <div class="info-item">
          <div class="info-header">
            <span class="type-name">ECN Broker</span>
            <span class="type-badge ecn">ECN</span>
          </div>
          <p class="info-description">
            Electronic Communication Network with multiple liquidity providers and commission-based pricing.
          </p>
        </div>
        
        <div class="info-item">
          <div class="info-header">
            <span class="type-name">Market Maker</span>
            <span class="type-badge market-maker">MM</span>
          </div>
          <p class="info-description">
            Creates own prices with wider spreads but no commission. May have requotes during volatility.
          </p>
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
const selectedBroker = ref(brokerStore.selectedBrokerId)

const currentBroker = computed(() => {
  return brokerStore.selectedBroker
})

const availableBrokers = computed(() => {
  return brokerStore.brokerList
})

const updateBroker = () => {
  brokerStore.selectBroker(selectedBroker.value)
}

// Watch for changes in the store
watch(() => brokerStore.selectedBrokerId, (newBrokerId) => {
  selectedBroker.value = newBrokerId
})
</script>

<style scoped>
.broker-selector {
  background: #2d2d2d;
  border-radius: 8px;
  padding: 1.5rem;
  border: 1px solid #444;
  height: fit-content;
}

.broker-selector h3 {
  margin: 0 0 1.5rem 0;
  color: #00ff88;
  font-size: 1.3rem;
}

.broker-form {
  margin-bottom: 1.5rem;
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

.broker-details {
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  padding: 1rem;
  margin-top: 0.75rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.detail-item:last-child {
  margin-bottom: 0;
}

.label {
  color: #888;
  font-size: 0.95rem;
}

.value {
  color: #fff;
  font-weight: 600;
  font-size: 0.95rem;
}

.broker-info h4 {
  margin: 0 0 1rem 0;
  color: #ccc;
  font-size: 1rem;
  border-bottom: 1px solid #444;
  padding-bottom: 0.5rem;
}

.info-sections {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info-item {
  background: #1a1a1a;
  border: 1px solid #555;
  border-radius: 6px;
  padding: 1rem;
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.type-name {
  color: #fff;
  font-weight: 600;
  font-size: 1rem;
}

.type-badge {
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.type-badge.direct-access {
  background: rgba(0, 255, 136, 0.3);
  color: #00ff88;
}

.type-badge.ecn {
  background: rgba(78, 205, 196, 0.3);
  color: #4ecdc4;
}

.type-badge.market-maker {
  background: rgba(255, 107, 107, 0.3);
  color: #ff6b6b;
}

.info-description {
  color: #ccc;
  font-size: 0.9rem;
  line-height: 1.4;
  margin: 0;
}

@media (max-width: 768px) {
  .info-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
}
</style>