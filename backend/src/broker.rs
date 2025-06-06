use serde::{Deserialize, Serialize};
use uuid::Uuid;
use rand::Rng;

use crate::orderbook::{Order, OrderSide};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BrokerType {
    DirectAccess,    // Direct access to liquidity pool
    ECN,            // Electronic Communication Network
    MarketMaker,    // Market maker broker
    STP,            // Straight Through Processing
    Hybrid,         // Combination of ECN and Market Maker
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Broker {
    pub id: String,
    pub name: String,
    pub broker_type: BrokerType,
    pub spread: f64,
    pub commission: f64,
    pub execution_model: ExecutionModel,
    pub liquidity_providers: Vec<LiquidityProvider>,
    pub slippage_factor: f64,
    pub requote_probability: f64,
    pub max_leverage: f64,
    pub min_trade_size: f64,
    pub max_trade_size: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExecutionModel {
    InstantExecution,
    MarketExecution,
    RequestExecution,
    ExchangeExecution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquidityProvider {
    pub name: String,
    pub tier: u8, // 1 = Tier 1 bank, 2 = Tier 2, etc.
    pub weight: f64, // Weight in price aggregation
    pub spread_markup: f64,
}

impl Broker {
    pub fn new(name: String, broker_type: BrokerType, spread: f64, commission: f64) -> Self {
        let execution_model = match broker_type {
            BrokerType::DirectAccess => ExecutionModel::ExchangeExecution,
            BrokerType::ECN => ExecutionModel::MarketExecution,
            BrokerType::MarketMaker => ExecutionModel::InstantExecution,
            BrokerType::STP => ExecutionModel::MarketExecution,
            BrokerType::Hybrid => ExecutionModel::RequestExecution,
        };

        let liquidity_providers = Self::generate_liquidity_providers(&broker_type);
        
        let (slippage_factor, requote_probability) = match broker_type {
            BrokerType::DirectAccess => (0.0001, 0.02), // Low slippage, low requotes
            BrokerType::ECN => (0.0002, 0.01), // Very low slippage and requotes
            BrokerType::MarketMaker => (0.0005, 0.15), // Higher slippage, more requotes
            BrokerType::STP => (0.0003, 0.05), // Medium slippage and requotes
            BrokerType::Hybrid => (0.0004, 0.08), // Variable slippage and requotes
        };

        let max_leverage = match broker_type {
            BrokerType::DirectAccess => 500.0,
            BrokerType::ECN => 200.0,
            BrokerType::MarketMaker => 100.0,
            BrokerType::STP => 300.0,
            BrokerType::Hybrid => 200.0,
        };

        Self {
            id: Uuid::new_v4().to_string(),
            name,
            broker_type,
            spread,
            commission,
            execution_model,
            liquidity_providers,
            slippage_factor,
            requote_probability,
            max_leverage,
            min_trade_size: 1000.0, // $1,000 minimum
            max_trade_size: 100_000_000.0, // $100M maximum
        }
    }

    fn generate_liquidity_providers(broker_type: &BrokerType) -> Vec<LiquidityProvider> {
        match broker_type {
            BrokerType::DirectAccess => vec![
                LiquidityProvider {
                    name: "Liquidity Pool Direct".to_string(),
                    tier: 0,
                    weight: 1.0,
                    spread_markup: 0.0,
                },
            ],
            BrokerType::ECN => vec![
                LiquidityProvider {
                    name: "Deutsche Bank".to_string(),
                    tier: 1,
                    weight: 0.25,
                    spread_markup: 0.00005,
                },
                LiquidityProvider {
                    name: "Citibank".to_string(),
                    tier: 1,
                    weight: 0.25,
                    spread_markup: 0.00008,
                },
                LiquidityProvider {
                    name: "JP Morgan".to_string(),
                    tier: 1,
                    weight: 0.25,
                    spread_markup: 0.00006,
                },
                LiquidityProvider {
                    name: "UBS".to_string(),
                    tier: 1,
                    weight: 0.25,
                    spread_markup: 0.00007,
                },
            ],
            BrokerType::MarketMaker => vec![
                LiquidityProvider {
                    name: "Internal Market Making".to_string(),
                    tier: 3,
                    weight: 1.0,
                    spread_markup: 0.0002,
                },
            ],
            BrokerType::STP => vec![
                LiquidityProvider {
                    name: "Bank Consortium".to_string(),
                    tier: 2,
                    weight: 0.6,
                    spread_markup: 0.00012,
                },
                LiquidityProvider {
                    name: "ECN Pool".to_string(),
                    tier: 1,
                    weight: 0.4,
                    spread_markup: 0.00008,
                },
            ],
            BrokerType::Hybrid => vec![
                LiquidityProvider {
                    name: "Tier 1 Banks".to_string(),
                    tier: 1,
                    weight: 0.7,
                    spread_markup: 0.00010,
                },
                LiquidityProvider {
                    name: "Internal MM".to_string(),
                    tier: 3,
                    weight: 0.3,
                    spread_markup: 0.00015,
                },
            ],
        }
    }

    pub fn process_order(&self, mut order: Order) -> Order {
        // Apply broker-specific processing
        order.price = self.adjust_price_for_execution(order.price, &order.side);
        
        // Apply slippage
        if self.should_apply_slippage() {
            order.price = self.apply_slippage(order.price, &order.side);
        }
        
        // Check for requotes
        if self.should_requote() {
            // In a real system, this would trigger a requote
            // For simulation, we'll just apply a small price adjustment
            let requote_adjustment = self.calculate_requote_adjustment();
            order.price *= 1.0 + requote_adjustment;
        }
        
        order
    }

    fn adjust_price_for_execution(&self, price: f64, side: &OrderSide) -> f64 {
        match self.broker_type {
            BrokerType::DirectAccess => price, // No adjustment
            BrokerType::ECN => {
                // Aggregate from multiple liquidity providers
                self.aggregate_liquidity_provider_prices(price, side)
            }
            BrokerType::MarketMaker => {
                // Apply spread markup
                match side {
                    OrderSide::Buy => price + self.spread / 2.0,
                    OrderSide::Sell => price - self.spread / 2.0,
                }
            }
            BrokerType::STP | BrokerType::Hybrid => {
                // Weighted average of liquidity providers
                self.aggregate_liquidity_provider_prices(price, side)
            }
        }
    }

    fn aggregate_liquidity_provider_prices(&self, base_price: f64, side: &OrderSide) -> f64 {
        let mut weighted_price = 0.0;
        let mut total_weight = 0.0;
        
        for provider in &self.liquidity_providers {
            let provider_price = match side {
                OrderSide::Buy => base_price + provider.spread_markup,
                OrderSide::Sell => base_price - provider.spread_markup,
            };
            
            weighted_price += provider_price * provider.weight;
            total_weight += provider.weight;
        }
        
        if total_weight > 0.0 {
            weighted_price / total_weight
        } else {
            base_price
        }
    }

    fn should_apply_slippage(&self) -> bool {
        let mut rng = rand::thread_rng();
        rng.gen_bool(0.3) // 30% chance of slippage
    }

    fn apply_slippage(&self, price: f64, side: &OrderSide) -> f64 {
        let mut rng = rand::thread_rng();
        let slippage = rng.gen_range(0.0..self.slippage_factor);
        
        match side {
            OrderSide::Buy => price + slippage,
            OrderSide::Sell => price - slippage,
        }
    }

    fn should_requote(&self) -> bool {
        let mut rng = rand::thread_rng();
        rng.gen_bool(self.requote_probability)
    }

    fn calculate_requote_adjustment(&self) -> f64 {
        let mut rng = rand::thread_rng();
        rng.gen_range(-0.0005..0.0005) // ±0.05% adjustment
    }

    pub fn calculate_commission(&self, volume: f64) -> f64 {
        match self.broker_type {
            BrokerType::ECN => self.commission * (volume / 100000.0), // Per lot
            BrokerType::DirectAccess => volume * 0.000001, // 0.0001% of volume
            _ => 0.0, // Spread-based brokers typically don't charge commission
        }
    }

    pub fn calculate_swap(&self, symbol: &str, side: &OrderSide, volume: f64) -> f64 {
        // Simplified swap calculation
        let base_swap_rate = match symbol {
            "EURUSD" => match side {
                OrderSide::Buy => -0.5,
                OrderSide::Sell => -2.1,
            },
            "GBPUSD" => match side {
                OrderSide::Buy => 0.8,
                OrderSide::Sell => -3.2,
            },
            "USDJPY" => match side {
                OrderSide::Buy => 2.1,
                OrderSide::Sell => -5.4,
            },
            _ => 0.0,
        };
        
        (base_swap_rate * volume) / 100000.0 // Per lot
    }

    pub fn get_effective_spread(&self, symbol: &str) -> f64 {
        let base_spread = match symbol {
            "EURUSD" => 0.00015,
            "GBPUSD" => 0.00020,
            "USDJPY" => 0.015,
            _ => 0.0002,
        };
        
        base_spread + self.spread
    }

    pub fn can_execute_order(&self, order: &Order) -> bool {
        // Check trade size limits
        if order.amount < self.min_trade_size || order.amount > self.max_trade_size {
            return false;
        }
        
        // Additional broker-specific checks
        match self.broker_type {
            BrokerType::MarketMaker => {
                // Market makers might reject orders during high volatility
                let mut rng = rand::thread_rng();
                !rng.gen_bool(0.05) // 5% rejection rate
            }
            _ => true,
        }
    }

    pub fn get_execution_speed_ms(&self) -> u64 {
        match self.execution_model {
            ExecutionModel::InstantExecution => rand::thread_rng().gen_range(1..10),
            ExecutionModel::MarketExecution => rand::thread_rng().gen_range(10..50),
            ExecutionModel::RequestExecution => rand::thread_rng().gen_range(100..500),
            ExecutionModel::ExchangeExecution => rand::thread_rng().gen_range(1..5),
        }
    }

    pub fn get_margin_requirement(&self, symbol: &str, volume: f64, leverage: f64) -> f64 {
        let effective_leverage = leverage.min(self.max_leverage);
        let notional_value = self.calculate_notional_value(symbol, volume);
        notional_value / effective_leverage
    }

    fn calculate_notional_value(&self, symbol: &str, volume: f64) -> f64 {
        // Simplified notional value calculation
        match symbol {
            "USDJPY" => volume * 100.0, // JPY pairs
            _ => volume, // USD-based pairs
        }
    }

    pub fn get_available_symbols(&self) -> Vec<String> {
        match self.broker_type {
            BrokerType::DirectAccess => vec![
                "EURUSD".to_string(),
                "GBPUSD".to_string(),
                "USDJPY".to_string(),
                "USDCHF".to_string(),
                "AUDUSD".to_string(),
                "USDCAD".to_string(),
                "NZDUSD".to_string(),
                "EURGBP".to_string(),
                "EURJPY".to_string(),
                "GBPJPY".to_string(),
            ],
            BrokerType::ECN => vec![
                "EURUSD".to_string(),
                "GBPUSD".to_string(),
                "USDJPY".to_string(),
                "USDCHF".to_string(),
                "AUDUSD".to_string(),
                "USDCAD".to_string(),
            ],
            _ => vec![
                "EURUSD".to_string(),
                "GBPUSD".to_string(),
                "USDJPY".to_string(),
            ],
        }
    }
}