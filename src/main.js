import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Mount the app immediately - initialization will be handled in App.vue
app.mount('#app')

console.log('FX Market Simulation application started')