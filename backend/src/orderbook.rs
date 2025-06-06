use std::collections::BTreeMap;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use ordered_float::OrderedFloat;

use crate::market::Trade;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBook {
    pub symbol: String,
    pub bids: BTreeMap<OrderedFloat<f64>, Vec<Order>>, // Price -> Orders (highest first)
    pub asks: BTreeMap<OrderedFloat<f64>, Vec<Order>>, // Price -> Orders (lowest first)
    pub last_trade_price: f64,
    pub total_volume: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub symbol: String,
    pub side: OrderSide,
    pub amount: f64,
    pub price: f64,
    pub timestamp: DateTime<Utc>,
    pub participant_id: String,
    pub order_type: OrderType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderType {
    Market,
    Limit,
    Stop,
    StopLimit,
}

impl OrderBook {
    pub fn new(symbol: String) -> Self {
        Self {
            symbol,
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            last_trade_price: 1.0,
            total_volume: 0.0,
        }
    }

    pub fn add_order(&mut self, order: Order) -> Option<Vec<Trade>> {
        match order.order_type {
            OrderType::Market => self.process_market_order(order),
            OrderType::Limit => self.process_limit_order(order),
            OrderType::Stop => self.process_stop_order(order),
            OrderType::StopLimit => self.process_stop_limit_order(order),
        }
    }

    fn process_market_order(&mut self, order: Order) -> Option<Vec<Trade>> {
        let mut trades = Vec::new();
        let mut remaining_amount = order.amount;

        match order.side {
            OrderSide::Buy => {
                // Match against asks (sell orders)
                let mut asks_to_remove = Vec::new();
                
                for (price, orders) in self.asks.iter_mut() {
                    if remaining_amount <= 0.0 {
                        break;
                    }

                    let mut orders_to_remove = Vec::new();
                    
                    for (i, ask_order) in orders.iter_mut().enumerate() {
                        if remaining_amount <= 0.0 {
                            break;
                        }

                        let trade_amount = remaining_amount.min(ask_order.amount);
                        
                        let trade = Trade {
                            id: Uuid::new_v4(),
                            symbol: self.symbol.clone(),
                            buyer_id: order.participant_id.clone(),
                            seller_id: ask_order.participant_id.clone(),
                            price: price.into_inner(),
                            volume: trade_amount,
                            timestamp: Utc::now(),
                            trade_type: crate::market::TradeType::Market,
                        };

                        trades.push(trade);
                        remaining_amount -= trade_amount;
                        ask_order.amount -= trade_amount;
                        self.last_trade_price = price.into_inner();
                        self.total_volume += trade_amount;

                        if ask_order.amount <= 0.0 {
                            orders_to_remove.push(i);
                        }
                    }

                    // Remove filled orders
                    for &i in orders_to_remove.iter().rev() {
                        orders.remove(i);
                    }

                    if orders.is_empty() {
                        asks_to_remove.push(*price);
                    }
                }

                // Remove empty price levels
                for price in asks_to_remove {
                    self.asks.remove(&price);
                }
            }
            OrderSide::Sell => {
                // Match against bids (buy orders)
                let mut bids_to_remove = Vec::new();
                
                for (price, orders) in self.bids.iter_mut().rev() {
                    if remaining_amount <= 0.0 {
                        break;
                    }

                    let mut orders_to_remove = Vec::new();
                    
                    for (i, bid_order) in orders.iter_mut().enumerate() {
                        if remaining_amount <= 0.0 {
                            break;
                        }

                        let trade_amount = remaining_amount.min(bid_order.amount);
                        
                        let trade = Trade {
                            id: Uuid::new_v4(),
                            symbol: self.symbol.clone(),
                            buyer_id: bid_order.participant_id.clone(),
                            seller_id: order.participant_id.clone(),
                            price: price.into_inner(),
                            volume: trade_amount,
                            timestamp: Utc::now(),
                            trade_type: crate::market::TradeType::Market,
                        };

                        trades.push(trade);
                        remaining_amount -= trade_amount;
                        bid_order.amount -= trade_amount;
                        self.last_trade_price = price.into_inner();
                        self.total_volume += trade_amount;

                        if bid_order.amount <= 0.0 {
                            orders_to_remove.push(i);
                        }
                    }

                    // Remove filled orders
                    for &i in orders_to_remove.iter().rev() {
                        orders.remove(i);
                    }

                    if orders.is_empty() {
                        bids_to_remove.push(*price);
                    }
                }

                // Remove empty price levels
                for price in bids_to_remove {
                    self.bids.remove(&price);
                }
            }
        }

        if !trades.is_empty() {
            Some(trades)
        } else {
            None
        }
    }

    fn process_limit_order(&mut self, order: Order) -> Option<Vec<Trade>> {
        // First try to match immediately
        let mut trades = Vec::new();
        let mut remaining_order = order.clone();

        match order.side {
            OrderSide::Buy => {
                // Check if we can match against existing asks
                if let Some(best_ask) = self.get_best_ask() {
                    if order.price >= best_ask {
                        // Convert to market order for immediate execution
                        let market_order = Order {
                            id: remaining_order.id,
                            symbol: remaining_order.symbol.clone(),
                            side: remaining_order.side.clone(),
                            amount: remaining_order.amount,
                            price: remaining_order.price,
                            timestamp: remaining_order.timestamp,
                            participant_id: remaining_order.participant_id.clone(),
                            order_type: OrderType::Market,
                        };
                        if let Some(market_trades) = self.process_market_order(market_order) {
                            trades.extend(market_trades);
                            remaining_order.amount -= trades.iter().map(|t| t.volume).sum::<f64>();
                        }
                    }
                }

                // Add remaining amount to orderbook
                if remaining_order.amount > 0.0 {
                    let price_key = OrderedFloat(remaining_order.price);
                    self.bids.entry(price_key).or_insert_with(Vec::new).push(remaining_order);
                }
            }
            OrderSide::Sell => {
                // Check if we can match against existing bids
                if let Some(best_bid) = self.get_best_bid() {
                    if order.price <= best_bid {
                        // Convert to market order for immediate execution
                        let market_order = Order {
                            id: remaining_order.id,
                            symbol: remaining_order.symbol.clone(),
                            side: remaining_order.side.clone(),
                            amount: remaining_order.amount,
                            price: remaining_order.price,
                            timestamp: remaining_order.timestamp,
                            participant_id: remaining_order.participant_id.clone(),
                            order_type: OrderType::Market,
                        };
                        if let Some(market_trades) = self.process_market_order(market_order) {
                            trades.extend(market_trades);
                            remaining_order.amount -= trades.iter().map(|t| t.volume).sum::<f64>();
                        }
                    }
                }

                // Add remaining amount to orderbook
                if remaining_order.amount > 0.0 {
                    let price_key = OrderedFloat(remaining_order.price);
                    self.asks.entry(price_key).or_insert_with(Vec::new).push(remaining_order);
                }
            }
        }

        if !trades.is_empty() {
            Some(trades)
        } else {
            None
        }
    }

    fn process_stop_order(&mut self, order: Order) -> Option<Vec<Trade>> {
        // Stop orders become market orders when price condition is met
        let should_trigger = match order.side {
            OrderSide::Buy => self.last_trade_price >= order.price,
            OrderSide::Sell => self.last_trade_price <= order.price,
        };

        if should_trigger {
            let market_order = Order {
                order_type: OrderType::Market,
                ..order
            };
            self.process_market_order(market_order)
        } else {
            // Store stop order for later trigger (simplified implementation)
            None
        }
    }

    fn process_stop_limit_order(&mut self, order: Order) -> Option<Vec<Trade>> {
        // Stop-limit orders become limit orders when price condition is met
        let should_trigger = match order.side {
            OrderSide::Buy => self.last_trade_price >= order.price,
            OrderSide::Sell => self.last_trade_price <= order.price,
        };

        if should_trigger {
            let limit_order = Order {
                order_type: OrderType::Limit,
                ..order
            };
            self.process_limit_order(limit_order)
        } else {
            // Store stop-limit order for later trigger (simplified implementation)
            None
        }
    }

    pub fn get_best_bid(&self) -> Option<f64> {
        self.bids.keys().last().map(|k| k.into_inner())
    }

    pub fn get_best_ask(&self) -> Option<f64> {
        self.asks.keys().next().map(|k| k.into_inner())
    }

    pub fn get_spread(&self) -> Option<f64> {
        match (self.get_best_bid(), self.get_best_ask()) {
            (Some(bid), Some(ask)) => Some(ask - bid),
            _ => None,
        }
    }

    pub fn get_bids(&self, depth: usize) -> Vec<(f64, f64)> {
        let mut result = Vec::new();
        
        for (price, orders) in self.bids.iter().rev().take(depth) {
            let total_volume: f64 = orders.iter().map(|o| o.amount).sum();
            result.push((price.into_inner(), total_volume));
        }
        
        result
    }

    pub fn get_asks(&self, depth: usize) -> Vec<(f64, f64)> {
        let mut result = Vec::new();
        
        for (price, orders) in self.asks.iter().take(depth) {
            let total_volume: f64 = orders.iter().map(|o| o.amount).sum();
            result.push((price.into_inner(), total_volume));
        }
        
        result
    }

    pub fn get_total_volume(&self) -> f64 {
        self.total_volume
    }

    pub fn get_order_count(&self) -> usize {
        let bid_orders: usize = self.bids.values().map(|orders| orders.len()).sum();
        let ask_orders: usize = self.asks.values().map(|orders| orders.len()).sum();
        bid_orders + ask_orders
    }

    pub fn remove_order(&mut self, order_id: &Uuid) -> bool {
        // Remove from bids
        for (price, orders) in self.bids.iter_mut() {
            if let Some(pos) = orders.iter().position(|o| &o.id == order_id) {
                orders.remove(pos);
                if orders.is_empty() {
                    let price_to_remove = *price;
                    self.bids.remove(&price_to_remove);
                }
                return true;
            }
        }

        // Remove from asks
        for (price, orders) in self.asks.iter_mut() {
            if let Some(pos) = orders.iter().position(|o| &o.id == order_id) {
                orders.remove(pos);
                if orders.is_empty() {
                    let price_to_remove = *price;
                    self.asks.remove(&price_to_remove);
                }
                return true;
            }
        }

        false
    }

    pub fn clear(&mut self) {
        self.bids.clear();
        self.asks.clear();
        self.total_volume = 0.0;
    }
}