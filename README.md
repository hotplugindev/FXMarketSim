# FX Market Simulation

A comprehensive forex market simulation webapp with real-time price feeds, multiple broker types, and thousands of simulated market participants.

## Features

### Backend (Rust)
- **Real-time Market Simulation**: Simulates a complete forex market with thousands of participants
- **Multiple Participant Types**: Banks, hedge funds, retail traders, corporations
- **Liquidity Pool & Orderbook**: Full orderbook implementation with bid/ask spreads
- **Market Makers**: Hundreds of simulated banks trading with high volumes
- **Broker Types**: Direct Access, ECN, Market Maker, STP, and Hybrid brokers
- **Real-time Price Feed**: WebSocket-based price updates every 100ms
- **REST API**: Complete API for trading operations and market data

### Frontend (Vue.js)
- **Real-time Trading Interface**: Buy/sell buttons with position sizing and leverage
- **Interactive Price Chart**: Real-time Chart.js integration with multiple timeframes
- **Account Management**: Balance setter, equity tracking, margin monitoring
- **Broker Selection**: Switch between different broker types with varying spreads
- **Order Book Visualization**: Live order book with bid/ask depth
- **Market Data Dashboard**: Comprehensive market statistics and price movements
- **Position Management**: Track open positions with real-time P&L

## Architecture

### Market Structure
```
Liquidity Pool (Core)
├── Market Makers (Banks) - High volume, market making
├── Institutional Traders - Medium to high volume
├── Retail Traders - Small to medium volume
└── User Trading - Via selected broker
```

### Broker Types
1. **Direct Access**: Direct to liquidity pool, minimal spreads
2. **ECN Broker**: Multiple liquidity providers, commission-based
3. **Market Maker**: Internal pricing, wider spreads, possible requotes
4. **STP**: Straight-through processing to liquidity providers
5. **Hybrid**: Combination of ECN and market making

## Installation & Setup

### Prerequisites
- Rust (latest stable)
- Node.js 18+
- npm

### Backend Setup
```bash
cd FXMarketSim/backend
cargo run
```
The backend will start on `http://localhost:3001`

### Frontend Setup
```bash
cd FXMarketSim/frontend
npm install
npm run dev
```
The frontend will start on `http://localhost:5173`

## Usage

The application has two main sections accessible via the top navigation:

### Trading Page (Main Interface)
- **Full-screen price chart**: Real-time candlestick chart with multiple timeframes
- **Trading sidebar**: Compact interface for account management and order placement
  - Account Information: Set balance, monitor equity and margin
  - Broker Selection: Choose between different broker types
  - Trading Interface: Place buy/sell orders with leverage control

### Market Analysis Page
- **Market Data Panel**: Comprehensive market statistics and price movements
- **Order Book**: Live bid/ask depth visualization with market liquidity

### Getting Started:
1. **Set Account Balance**: Use the account panel to set your starting capital
2. **Choose Broker**: Select from Direct Access, ECN, or Market Maker brokers
3. **Start Trading**: Use the large chart for analysis and sidebar for order placement
4. **Monitor Positions**: Track your trades with real-time P&L in the positions panel
5. **Analyze Market**: Switch to the Analysis tab for detailed market data and order book

## API Endpoints

### Market Data
- `GET /api/market-data` - Current market prices and orderbook snapshot
- `GET /api/brokers` - Available brokers and their specifications

### Trading
- `POST /api/trade` - Place a trade order

### WebSocket
- `WS /ws` - Real-time market data feed

## Configuration

### Market Participants
- **Banks**: 500 simulated institutions with $10M-$1B capital
- **Traders**: 10,000 participants with $100K-$10M capital
- **Update Frequency**: Market updates every 10ms, price feeds every 100ms

### Symbols Supported
- EUR/USD
- GBP/USD
- USD/JPY
- USD/CHF
- AUD/USD
- USD/CAD

## Technical Details

### Backend Technologies
- **Axum**: Web framework for REST API and WebSocket
- **Tokio**: Async runtime for high-performance concurrent processing
- **Serde**: JSON serialization for API communication
- **DashMap**: Thread-safe HashMap for concurrent market data
- **Ordered Float**: Precise decimal arithmetic for financial calculations

### Frontend Technologies
- **Vue 3**: Reactive frontend framework with Composition API
- **Pinia**: State management for market data and account information
- **Chart.js**: Real-time price charting with technical indicators
- **Axios**: HTTP client for API communication
- **WebSocket**: Real-time data streaming

### Market Simulation
- **Realistic Spreads**: Based on actual forex market spreads
- **Volume Simulation**: Proportional to real market volumes
- **Price Movement**: Random walk with volatility based on historical data
- **Slippage & Requotes**: Simulated based on broker type and market conditions

## Development

### Project Structure
```
FXMarketSim/
├── backend/
│   ├── src/
│   │   ├── main.rs           # Server setup and API routes
│   │   ├── market.rs         # Core market engine
│   │   ├── orderbook.rs      # Order matching engine
│   │   ├── participants.rs   # Market participant types
│   │   ├── price_feed.rs     # Real-time price generation
│   │   └── broker.rs         # Broker implementations
│   └── Cargo.toml
└── frontend/
    ├── src/
    │   ├── components/       # Vue components
    │   ├── stores/          # Pinia state management
    │   └── App.vue          # Main application
    └── package.json
```

### Running in Development

1. Start the backend:
```bash
cd backend && cargo run
```

2. Start the frontend:
```bash
cd frontend && npm run dev
```

3. Open your browser to `http://localhost:5173`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details