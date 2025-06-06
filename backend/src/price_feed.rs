use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use rand::Rng;
use chrono::{DateTime, Utc};

use crate::market::MarketEngine;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceFeed {
    pub prices: HashMap<String, PriceData>,
    pub historical_data: HashMap<String, Vec<Candle>>,
    pub last_update: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceData {
    pub symbol: String,
    pub bid: f64,
    pub ask: f64,
    pub last: f64,
    pub high_24h: f64,
    pub low_24h: f64,
    pub volume_24h: f64,
    pub timestamp: DateTime<Utc>,
    pub change_24h: f64,
    pub change_percent_24h: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Candle {
    pub timestamp: DateTime<Utc>,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

impl PriceFeed {
    pub fn new() -> Self {
        Self {
            prices: HashMap::new(),
            historical_data: HashMap::new(),
            last_update: Utc::now(),
        }
    }

    pub fn add_symbol(&mut self, symbol: &str, initial_price: f64) {
        let spread = self.calculate_spread(symbol);
        let price_data = PriceData {
            symbol: symbol.to_string(),
            bid: initial_price - spread / 2.0,
            ask: initial_price + spread / 2.0,
            last: initial_price,
            high_24h: initial_price,
            low_24h: initial_price,
            volume_24h: 0.0,
            timestamp: Utc::now(),
            change_24h: 0.0,
            change_percent_24h: 0.0,
        };

        self.prices.insert(symbol.to_string(), price_data);
        self.historical_data.insert(symbol.to_string(), Vec::new());
        
        // Initialize with some historical data
        self.generate_initial_history(symbol, initial_price);
    }

    fn calculate_spread(&self, symbol: &str) -> f64 {
        match symbol {
            "EURUSD" => 0.00015, // 1.5 pips
            "GBPUSD" => 0.00020, // 2.0 pips
            "USDJPY" => 0.015,   // 1.5 pips (for JPY pairs)
            "USDCHF" => 0.00018, // 1.8 pips
            "AUDUSD" => 0.00025, // 2.5 pips
            "USDCAD" => 0.00022, // 2.2 pips
            _ => 0.0002, // Default 2 pips
        }
    }

    fn generate_initial_history(&mut self, symbol: &str, base_price: f64) {
        let mut rng = rand::thread_rng();
        let mut current_price = base_price;
        let volatility = self.get_symbol_volatility(symbol);
        let history = self.historical_data.get_mut(symbol).unwrap();
        
        // Generate 1000 candles of historical data
        for i in 0..1000 {
            let timestamp = Utc::now() - chrono::Duration::seconds((1000 - i) * 60); // 1-minute candles
            
            let open = current_price;
            
            // Generate realistic price movement
            let price_change = rng.gen_range(-volatility..volatility);
            let close = open * (1.0 + price_change);
            
            let high = open.max(close) * (1.0 + rng.gen_range(0.0..volatility * 0.5));
            let low = open.min(close) * (1.0 - rng.gen_range(0.0..volatility * 0.5));
            let volume = rng.gen_range(1000.0..10000.0);
            
            let candle = Candle {
                timestamp,
                open,
                high,
                low,
                close,
                volume,
            };
            
            history.push(candle);
            current_price = close;
        }
    }

    fn get_symbol_volatility(&self, symbol: &str) -> f64 {
        match symbol {
            "EURUSD" => 0.0008, // 0.08% per minute
            "GBPUSD" => 0.0012, // 0.12% per minute
            "USDJPY" => 0.0010, // 0.10% per minute
            "USDCHF" => 0.0009, // 0.09% per minute
            "AUDUSD" => 0.0015, // 0.15% per minute
            "USDCAD" => 0.0011, // 0.11% per minute
            _ => 0.001, // Default 0.1% per minute
        }
    }

    pub fn update_from_market(&mut self, market: &MarketEngine) {
        for (symbol, orderbook) in &market.symbols {
            if let Some(price_data) = self.prices.get_mut(symbol) {
                // Update bid/ask from orderbook
                if let Some(best_bid) = orderbook.get_best_bid() {
                    price_data.bid = best_bid;
                }
                if let Some(best_ask) = orderbook.get_best_ask() {
                    price_data.ask = best_ask;
                }
                
                // Update last price from orderbook's last trade
                price_data.last = orderbook.last_trade_price;
                
                // Update volume
                price_data.volume_24h = orderbook.get_total_volume();
                
                // Update high/low
                if price_data.last > price_data.high_24h {
                    price_data.high_24h = price_data.last;
                }
                if price_data.last < price_data.low_24h {
                    price_data.low_24h = price_data.last;
                }
                
                price_data.timestamp = Utc::now();
                
                // Add market noise for realistic price movement
                self.add_market_noise(symbol);
            }
        }
        
        self.last_update = Utc::now();
    }

    fn add_market_noise(&mut self, symbol: &str) {
        let mut rng = rand::thread_rng();
        let volatility = self.get_symbol_volatility(symbol);
        let noise = rng.gen_range(-volatility * 0.1..volatility * 0.1);
        let spread = self.calculate_spread(symbol);
        
        if let Some(price_data) = self.prices.get_mut(symbol) {
            let old_price = price_data.last;
            price_data.last *= 1.0 + noise;
            
            // Update bid/ask with spread
            price_data.bid = price_data.last - spread / 2.0;
            price_data.ask = price_data.last + spread / 2.0;
            
            // Calculate 24h change
            if let Some(history) = self.historical_data.get(symbol) {
                if let Some(candle_24h_ago) = history.get(history.len().saturating_sub(1440)) { // 24 hours ago (1440 minutes)
                    price_data.change_24h = price_data.last - candle_24h_ago.close;
                    price_data.change_percent_24h = (price_data.change_24h / candle_24h_ago.close) * 100.0;
                }
            }
            
            let new_price = price_data.last;
            drop(price_data); // Explicitly drop the mutable borrow
            
            // Update historical data
            self.update_candle_data(symbol, old_price, new_price);
        }
    }

    fn update_candle_data(&mut self, symbol: &str, old_price: f64, new_price: f64) {
        if let Some(history) = self.historical_data.get_mut(symbol) {
            let now = Utc::now();
            
            // Get the current minute's candle or create a new one
            let current_minute = now.timestamp() / 60;
            
            if let Some(last_candle) = history.last_mut() {
                let last_minute = last_candle.timestamp.timestamp() / 60;
                
                if current_minute == last_minute {
                    // Update current candle
                    last_candle.close = new_price;
                    last_candle.high = last_candle.high.max(new_price);
                    last_candle.low = last_candle.low.min(new_price);
                    last_candle.volume += rand::thread_rng().gen_range(10.0..100.0);
                } else {
                    // Create new candle
                    let new_candle = Candle {
                        timestamp: now,
                        open: old_price,
                        high: new_price.max(old_price),
                        low: new_price.min(old_price),
                        close: new_price,
                        volume: rand::thread_rng().gen_range(100.0..1000.0),
                    };
                    
                    history.push(new_candle);
                    
                    // Keep only last 10000 candles
                    if history.len() > 10000 {
                        history.remove(0);
                    }
                }
            }
        }
    }

    pub fn get_current_price(&self, symbol: &str) -> PriceData {
        self.prices.get(symbol).cloned().unwrap_or_else(|| {
            PriceData {
                symbol: symbol.to_string(),
                bid: 1.0,
                ask: 1.0001,
                last: 1.0,
                high_24h: 1.0,
                low_24h: 1.0,
                volume_24h: 0.0,
                timestamp: Utc::now(),
                change_24h: 0.0,
                change_percent_24h: 0.0,
            }
        })
    }

    pub fn get_historical_data(&self, symbol: &str, timeframe: &str, limit: usize) -> Vec<Candle> {
        if let Some(history) = self.historical_data.get(symbol) {
            match timeframe {
                "1m" => history.iter().rev().take(limit).cloned().collect(),
                "5m" => self.aggregate_candles(history, 5, limit),
                "15m" => self.aggregate_candles(history, 15, limit),
                "1h" => self.aggregate_candles(history, 60, limit),
                "4h" => self.aggregate_candles(history, 240, limit),
                "1d" => self.aggregate_candles(history, 1440, limit),
                _ => history.iter().rev().take(limit).cloned().collect(),
            }
        } else {
            Vec::new()
        }
    }

    fn aggregate_candles(&self, candles: &[Candle], minutes: usize, limit: usize) -> Vec<Candle> {
        let mut aggregated = Vec::new();
        let mut current_group = Vec::new();
        let mut current_period_start = None;
        
        for candle in candles.iter().rev() {
            let period_start = (candle.timestamp.timestamp() / 60 / minutes as i64) * minutes as i64;
            
            if current_period_start.is_none() {
                current_period_start = Some(period_start);
            }
            
            if Some(period_start) == current_period_start {
                current_group.push(candle.clone());
            } else {
                if !current_group.is_empty() {
                    aggregated.push(self.create_aggregated_candle(&current_group, minutes));
                }
                current_group = vec![candle.clone()];
                current_period_start = Some(period_start);
                
                if aggregated.len() >= limit {
                    break;
                }
            }
        }
        
        if !current_group.is_empty() && aggregated.len() < limit {
            aggregated.push(self.create_aggregated_candle(&current_group, minutes));
        }
        
        aggregated
    }

    fn create_aggregated_candle(&self, candles: &[Candle], _minutes: usize) -> Candle {
        if candles.is_empty() {
            return Candle {
                timestamp: Utc::now(),
                open: 1.0,
                high: 1.0,
                low: 1.0,
                close: 1.0,
                volume: 0.0,
            };
        }
        
        let open = candles.first().unwrap().open;
        let close = candles.last().unwrap().close;
        let high = candles.iter().map(|c| c.high).fold(0.0, f64::max);
        let low = candles.iter().map(|c| c.low).fold(f64::INFINITY, f64::min);
        let volume = candles.iter().map(|c| c.volume).sum();
        let timestamp = candles.first().unwrap().timestamp;
        
        Candle {
            timestamp,
            open,
            high,
            low,
            close,
            volume,
        }
    }

    pub fn get_symbols(&self) -> Vec<String> {
        self.prices.keys().cloned().collect()
    }

    pub fn simulate_major_news_event(&mut self, symbol: &str, impact: f64) {
        let spread = self.calculate_spread(symbol);
        
        if let Some(price_data) = self.prices.get_mut(symbol) {
            let old_price = price_data.last;
            price_data.last *= 1.0 + impact;
            
            price_data.bid = price_data.last - spread / 2.0;
            price_data.ask = price_data.last + spread / 2.0;
            
            // Update high/low
            if price_data.last > price_data.high_24h {
                price_data.high_24h = price_data.last;
            }
            if price_data.last < price_data.low_24h {
                price_data.low_24h = price_data.last;
            }
            
            let new_price = price_data.last;
            drop(price_data); // Explicitly drop the mutable borrow
            
            self.update_candle_data(symbol, old_price, new_price);
        }
    }
}