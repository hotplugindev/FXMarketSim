use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use rand::Rng;
use anyhow::Result;

use crate::orderbook::{OrderBook, Order, OrderSide};
use crate::participants::{Participant, ParticipantType};
use crate::broker::Broker;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketEngine {
    pub symbols: HashMap<String, OrderBook>,
    pub participants: HashMap<String, Participant>,
    pub active_orders: HashMap<Uuid, Order>,
    pub trade_history: Vec<Trade>,
    pub market_stats: MarketStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    pub id: Uuid,
    pub symbol: String,
    pub buyer_id: String,
    pub seller_id: String,
    pub price: f64,
    pub volume: f64,
    pub timestamp: DateTime<Utc>,
    pub trade_type: TradeType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TradeType {
    Market,
    Limit,
    Stop,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketStats {
    pub total_volume: f64,
    pub total_trades: u64,
    pub active_participants: u64,
    pub liquidity_index: f64,
    pub volatility: f64,
}

impl MarketEngine {
    pub fn new() -> Self {
        Self {
            symbols: HashMap::new(),
            participants: HashMap::new(),
            active_orders: HashMap::new(),
            trade_history: Vec::new(),
            market_stats: MarketStats {
                total_volume: 0.0,
                total_trades: 0,
                active_participants: 0,
                liquidity_index: 0.0,
                volatility: 0.0,
            },
        }
    }

    pub fn add_symbol(&mut self, symbol: String) {
        self.symbols.insert(symbol.clone(), OrderBook::new(symbol));
    }

    pub fn add_participant(&mut self, participant: Participant) {
        self.participants.insert(participant.id.clone(), participant);
        self.market_stats.active_participants = self.participants.len() as u64;
    }

    pub fn get_orderbook(&self, symbol: &str) -> &OrderBook {
        self.symbols.get(symbol).unwrap_or_else(|| panic!("Symbol {} not found", symbol))
    }

    pub async fn place_order(&mut self, symbol: &str, side: OrderSide, amount: f64, broker: Broker) -> Result<Uuid> {
        let order_id = Uuid::new_v4();
        let price = self.calculate_order_price(symbol, &side, &broker);
        
        let order = Order {
            id: order_id,
            symbol: symbol.to_string(),
            side,
            amount,
            price,
            timestamp: Utc::now(),
            participant_id: "user".to_string(),
            order_type: crate::orderbook::OrderType::Market,
        };

        // Apply broker-specific logic
        let adjusted_order = broker.process_order(order);
        
        // Get orderbook and try to match the order
        let orderbook = self.symbols.get_mut(symbol)
            .ok_or_else(|| anyhow::anyhow!("Symbol not found"))?;
        
        if let Some(trades) = orderbook.add_order(adjusted_order.clone()) {
            for trade in trades {
                self.execute_trade(trade);
            }
        }

        self.active_orders.insert(order_id, adjusted_order);
        Ok(order_id)
    }

    fn calculate_order_price(&self, symbol: &str, side: &OrderSide, broker: &Broker) -> f64 {
        let orderbook = self.get_orderbook(symbol);
        let base_price = match side {
            OrderSide::Buy => orderbook.get_best_ask().unwrap_or(1.0),
            OrderSide::Sell => orderbook.get_best_bid().unwrap_or(1.0),
        };

        // Apply broker spread
        match side {
            OrderSide::Buy => base_price + broker.spread / 2.0,
            OrderSide::Sell => base_price - broker.spread / 2.0,
        }
    }

    fn execute_trade(&mut self, trade: Trade) {
        self.trade_history.push(trade.clone());
        self.market_stats.total_trades += 1;
        self.market_stats.total_volume += trade.volume;
        
        // Update participant balances
        if let Some(buyer) = self.participants.get_mut(&trade.buyer_id) {
            buyer.balance -= trade.price * trade.volume;
        }
        if let Some(seller) = self.participants.get_mut(&trade.seller_id) {
            seller.balance += trade.price * trade.volume;
        }
    }

    pub async fn update(&mut self) {
        // Simulate market participant activity
        self.simulate_bank_activity().await;
        self.simulate_trader_activity().await;
        self.update_market_stats();
    }

    async fn simulate_bank_activity(&mut self) {
        let mut rng = rand::thread_rng();
        
        // Get bank participants
        let bank_ids: Vec<String> = self.participants
            .iter()
            .filter(|(_, p)| p.participant_type == ParticipantType::Bank)
            .map(|(id, _)| id.clone())
            .collect();

        // Banks trade with high frequency and volume
        for bank_id in bank_ids.iter().take(50) { // Process 50 banks per update
            if rng.gen_bool(0.1) { // 10% chance per update
                let symbol = self.get_random_symbol();
                let side = if rng.gen_bool(0.5) { OrderSide::Buy } else { OrderSide::Sell };
                let volume = rng.gen_range(100000.0..1000000.0); // Large volumes
                
                let price = self.get_market_price(&symbol, &side);
                let order = Order {
                    id: Uuid::new_v4(),
                    symbol: symbol.clone(),
                    side,
                    amount: volume,
                    price,
                    timestamp: Utc::now(),
                    participant_id: bank_id.clone(),
                    order_type: crate::orderbook::OrderType::Limit,
                };
                
                if let Some(orderbook) = self.symbols.get_mut(&symbol) {
                    if let Some(trades) = orderbook.add_order(order) {
                        for trade in trades {
                            self.execute_trade(trade);
                        }
                    }
                }
            }
        }
    }

    async fn simulate_trader_activity(&mut self) {
        let mut rng = rand::thread_rng();
        
        // Get regular trader participants
        let trader_ids: Vec<String> = self.participants
            .iter()
            .filter(|(_, p)| p.participant_type == ParticipantType::Trader)
            .map(|(id, _)| id.clone())
            .collect();

        // Traders trade with lower frequency but still significant volume
        for trader_id in trader_ids.iter().take(1000) { // Process 1000 traders per update
            if rng.gen_bool(0.01) { // 1% chance per update
                let symbol = self.get_random_symbol();
                let side = if rng.gen_bool(0.5) { OrderSide::Buy } else { OrderSide::Sell };
                let volume = rng.gen_range(1000.0..50000.0); // Smaller volumes
                
                let price = self.get_market_price(&symbol, &side);
                let order = Order {
                    id: Uuid::new_v4(),
                    symbol: symbol.clone(),
                    side,
                    amount: volume,
                    price,
                    timestamp: Utc::now(),
                    participant_id: trader_id.clone(),
                    order_type: crate::orderbook::OrderType::Market,
                };
                
                if let Some(orderbook) = self.symbols.get_mut(&symbol) {
                    if let Some(trades) = orderbook.add_order(order) {
                        for trade in trades {
                            self.execute_trade(trade);
                        }
                    }
                }
            }
        }
    }

    fn get_random_symbol(&self) -> String {
        let symbols: Vec<&String> = self.symbols.keys().collect();
        if symbols.is_empty() {
            "EURUSD".to_string()
        } else {
            let mut rng = rand::thread_rng();
            symbols[rng.gen_range(0..symbols.len())].clone()
        }
    }

    fn get_market_price(&self, symbol: &str, side: &OrderSide) -> f64 {
        let orderbook = self.get_orderbook(symbol);
        let mut rng = rand::thread_rng();
        
        match side {
            OrderSide::Buy => {
                let base_price = orderbook.get_best_ask().unwrap_or(1.0);
                base_price * (1.0 + rng.gen_range(-0.001..0.001)) // ±0.1% random variation
            }
            OrderSide::Sell => {
                let base_price = orderbook.get_best_bid().unwrap_or(1.0);
                base_price * (1.0 + rng.gen_range(-0.001..0.001)) // ±0.1% random variation
            }
        }
    }

    fn update_market_stats(&mut self) {
        // Calculate liquidity index based on orderbook depth
        let mut total_liquidity = 0.0;
        for orderbook in self.symbols.values() {
            total_liquidity += orderbook.get_total_volume();
        }
        self.market_stats.liquidity_index = total_liquidity / self.symbols.len() as f64;

        // Calculate volatility based on recent price movements
        if self.trade_history.len() > 100 {
            let recent_trades = &self.trade_history[self.trade_history.len() - 100..];
            let prices: Vec<f64> = recent_trades.iter().map(|t| t.price).collect();
            
            if prices.len() > 1 {
                let mean = prices.iter().sum::<f64>() / prices.len() as f64;
                let variance = prices.iter()
                    .map(|p| (p - mean).powi(2))
                    .sum::<f64>() / prices.len() as f64;
                self.market_stats.volatility = variance.sqrt();
            }
        }
    }

    pub fn get_recent_trades(&self, symbol: &str, limit: usize) -> Vec<&Trade> {
        self.trade_history
            .iter()
            .filter(|t| t.symbol == symbol)
            .rev()
            .take(limit)
            .collect()
    }

    pub fn get_participant_positions(&self, participant_id: &str) -> HashMap<String, f64> {
        let mut positions = HashMap::new();
        
        for trade in &self.trade_history {
            if trade.buyer_id == participant_id {
                *positions.entry(trade.symbol.clone()).or_insert(0.0) += trade.volume;
            } else if trade.seller_id == participant_id {
                *positions.entry(trade.symbol.clone()).or_insert(0.0) -= trade.volume;
            }
        }
        
        positions
    }
}