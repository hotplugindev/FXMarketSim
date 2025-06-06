use serde::{Deserialize, Serialize};
use rand::Rng;
use std::collections::HashMap;


#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ParticipantType {
    Bank,
    Trader,
    HedgeFund,
    Corporation,
    Government,
    RetailTrader,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Participant {
    pub id: String,
    pub name: String,
    pub participant_type: ParticipantType,
    pub balance: f64,
    pub equity: f64,
    pub margin_used: f64,
    pub leverage: f64,
    pub positions: HashMap<String, Position>,
    pub trading_strategy: TradingStrategy,
    pub risk_tolerance: f64,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub symbol: String,
    pub side: crate::orderbook::OrderSide,
    pub volume: f64,
    pub entry_price: f64,
    pub current_price: f64,
    pub unrealized_pnl: f64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TradingStrategy {
    Conservative,
    Moderate,
    Aggressive,
    HighFrequency,
    Arbitrage,
    TrendFollowing,
    MeanReversion,
    MarketMaking,
}

impl Participant {
    pub fn new(
        id: String,
        name: String,
        participant_type: ParticipantType,
        initial_balance: f64,
    ) -> Self {
        let leverage = match participant_type {
            ParticipantType::Bank => 50.0,
            ParticipantType::HedgeFund => 10.0,
            ParticipantType::Corporation => 5.0,
            ParticipantType::Government => 1.0,
            ParticipantType::Trader => 100.0,
            ParticipantType::RetailTrader => 30.0,
        };

        let trading_strategy = match participant_type {
            ParticipantType::Bank => TradingStrategy::MarketMaking,
            ParticipantType::HedgeFund => TradingStrategy::Aggressive,
            ParticipantType::Corporation => TradingStrategy::Conservative,
            ParticipantType::Government => TradingStrategy::Conservative,
            ParticipantType::Trader => TradingStrategy::HighFrequency,
            ParticipantType::RetailTrader => TradingStrategy::Moderate,
        };

        let risk_tolerance = match participant_type {
            ParticipantType::Bank => 0.3,
            ParticipantType::HedgeFund => 0.8,
            ParticipantType::Corporation => 0.2,
            ParticipantType::Government => 0.1,
            ParticipantType::Trader => 0.6,
            ParticipantType::RetailTrader => 0.4,
        };

        Self {
            id,
            name,
            participant_type,
            balance: initial_balance,
            equity: initial_balance,
            margin_used: 0.0,
            leverage,
            positions: HashMap::new(),
            trading_strategy,
            risk_tolerance,
            active: true,
        }
    }

    pub fn new_bank(id: String) -> Self {
        let mut rng = rand::thread_rng();
        let balance = rng.gen_range(10_000_000.0..1_000_000_000.0); // $10M - $1B
        Self::new(
            id.clone(),
            format!("Bank {}", id),
            ParticipantType::Bank,
            balance,
        )
    }

    pub fn new_trader(id: String) -> Self {
        let mut rng = rand::thread_rng();
        let balance = rng.gen_range(100_000.0..10_000_000.0); // $100K - $10M
        Self::new(
            id.clone(),
            format!("Trader {}", id),
            ParticipantType::Trader,
            balance,
        )
    }

    pub fn new_hedge_fund(id: String) -> Self {
        let mut rng = rand::thread_rng();
        let balance = rng.gen_range(50_000_000.0..500_000_000.0); // $50M - $500M
        Self::new(
            id.clone(),
            format!("HedgeFund {}", id),
            ParticipantType::HedgeFund,
            balance,
        )
    }

    pub fn new_retail_trader(id: String) -> Self {
        let mut rng = rand::thread_rng();
        let balance = rng.gen_range(1_000.0..100_000.0); // $1K - $100K
        Self::new(
            id.clone(),
            format!("RetailTrader {}", id),
            ParticipantType::RetailTrader,
            balance,
        )
    }

    pub fn new_random(id: String) -> Self {
        let mut rng = rand::thread_rng();
        let participant_types = [
            ParticipantType::Trader,
            ParticipantType::RetailTrader,
            ParticipantType::HedgeFund,
            ParticipantType::Corporation,
        ];
        
        let participant_type = participant_types[rng.gen_range(0..participant_types.len())].clone();
        
        match participant_type {
            ParticipantType::Trader => Self::new_trader(id),
            ParticipantType::RetailTrader => Self::new_retail_trader(id),
            ParticipantType::HedgeFund => Self::new_hedge_fund(id),
            ParticipantType::Corporation => {
                let balance = rng.gen_range(1_000_000.0..100_000_000.0);
                Self::new(id.clone(), format!("Corp {}", id), ParticipantType::Corporation, balance)
            }
            _ => Self::new_retail_trader(id),
        }
    }

    pub fn add_position(&mut self, position: Position) {
        self.positions.insert(position.symbol.clone(), position);
        self.update_equity();
    }

    pub fn close_position(&mut self, symbol: &str) -> Option<Position> {
        let position = self.positions.remove(symbol)?;
        self.balance += position.unrealized_pnl;
        self.update_equity();
        Some(position)
    }

    pub fn update_position_price(&mut self, symbol: &str, new_price: f64) {
        if let Some(position) = self.positions.get_mut(symbol) {
            position.current_price = new_price;
            position.unrealized_pnl = match position.side {
                crate::orderbook::OrderSide::Buy => {
                    (new_price - position.entry_price) * position.volume
                }
                crate::orderbook::OrderSide::Sell => {
                    (position.entry_price - new_price) * position.volume
                }
            };
        }
        self.update_equity();
    }

    pub fn update_equity(&mut self) {
        let unrealized_pnl: f64 = self.positions.values().map(|p| p.unrealized_pnl).sum();
        self.equity = self.balance + unrealized_pnl;
    }

    pub fn get_free_margin(&self) -> f64 {
        self.equity - self.margin_used
    }

    pub fn can_open_position(&self, required_margin: f64) -> bool {
        self.get_free_margin() >= required_margin && self.active
    }

    pub fn calculate_position_size(&self, _symbol: &str, price: f64, risk_percent: f64) -> f64 {
        let risk_amount = self.equity * risk_percent.min(self.risk_tolerance);
        let position_size = risk_amount / price;
        
        // Apply leverage
        position_size * self.leverage
    }

    pub fn should_trade(&self) -> bool {
        if !self.active {
            return false;
        }

        let mut rng = rand::thread_rng();
        
        match self.trading_strategy {
            TradingStrategy::HighFrequency => rng.gen_bool(0.1), // 10% chance per tick
            TradingStrategy::Aggressive => rng.gen_bool(0.05),   // 5% chance per tick
            TradingStrategy::Moderate => rng.gen_bool(0.02),     // 2% chance per tick
            TradingStrategy::Conservative => rng.gen_bool(0.01), // 1% chance per tick
            TradingStrategy::MarketMaking => rng.gen_bool(0.15), // 15% chance per tick
            TradingStrategy::Arbitrage => rng.gen_bool(0.08),    // 8% chance per tick
            TradingStrategy::TrendFollowing => rng.gen_bool(0.03), // 3% chance per tick
            TradingStrategy::MeanReversion => rng.gen_bool(0.04),  // 4% chance per tick
        }
    }

    pub fn get_preferred_symbols(&self) -> Vec<String> {
        match self.participant_type {
            ParticipantType::Bank => vec![
                "EURUSD".to_string(),
                "GBPUSD".to_string(),
                "USDJPY".to_string(),
                "USDCHF".to_string(),
                "AUDUSD".to_string(),
                "USDCAD".to_string(),
            ],
            ParticipantType::HedgeFund => vec![
                "EURUSD".to_string(),
                "GBPUSD".to_string(),
                "USDJPY".to_string(),
            ],
            ParticipantType::Corporation => vec![
                "EURUSD".to_string(),
                "USDJPY".to_string(),
            ],
            _ => vec!["EURUSD".to_string()],
        }
    }

    pub fn get_typical_trade_size(&self) -> f64 {
        let mut rng = rand::thread_rng();
        
        match self.participant_type {
            ParticipantType::Bank => rng.gen_range(1_000_000.0..10_000_000.0), // 1M - 10M
            ParticipantType::HedgeFund => rng.gen_range(100_000.0..1_000_000.0), // 100K - 1M
            ParticipantType::Trader => rng.gen_range(10_000.0..100_000.0), // 10K - 100K
            ParticipantType::Corporation => rng.gen_range(50_000.0..500_000.0), // 50K - 500K
            ParticipantType::Government => rng.gen_range(1_000_000.0..5_000_000.0), // 1M - 5M
            ParticipantType::RetailTrader => rng.gen_range(1_000.0..10_000.0), // 1K - 10K
        }
    }

    pub fn get_margin_requirement(&self, volume: f64, leverage: f64) -> f64 {
        volume / leverage
    }

    pub fn deactivate(&mut self) {
        self.active = false;
    }

    pub fn activate(&mut self) {
        self.active = true;
    }
}

impl Position {
    pub fn new(
        symbol: String,
        side: crate::orderbook::OrderSide,
        volume: f64,
        entry_price: f64,
    ) -> Self {
        Self {
            symbol,
            side,
            volume,
            entry_price,
            current_price: entry_price,
            unrealized_pnl: 0.0,
            timestamp: chrono::Utc::now(),
        }
    }

    pub fn update_price(&mut self, new_price: f64) {
        self.current_price = new_price;
        self.unrealized_pnl = match self.side {
            crate::orderbook::OrderSide::Buy => (new_price - self.entry_price) * self.volume,
            crate::orderbook::OrderSide::Sell => (self.entry_price - new_price) * self.volume,
        };
    }

    pub fn get_unrealized_pnl(&self) -> f64 {
        self.unrealized_pnl
    }

    pub fn get_return_percentage(&self) -> f64 {
        match self.side {
            crate::orderbook::OrderSide::Buy => {
                (self.current_price - self.entry_price) / self.entry_price * 100.0
            }
            crate::orderbook::OrderSide::Sell => {
                (self.entry_price - self.current_price) / self.entry_price * 100.0
            }
        }
    }
}