use axum::{
    Json, Router,
    extract::{
        State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    response::{IntoResponse, Response},
    routing::{get, post},
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{Duration, interval};
use tower_http::cors::CorsLayer;
use tracing::info;

mod broker;
mod market;
mod orderbook;
mod participants;
mod price_feed;

use broker::{Broker, BrokerType};
use market::MarketEngine;
use orderbook::OrderSide;
use participants::Participant;
use price_feed::PriceFeed;

#[derive(Clone)]
struct AppState {
    market_engine: Arc<RwLock<MarketEngine>>,
    price_feed: Arc<RwLock<PriceFeed>>,
    brokers: Arc<RwLock<HashMap<String, Broker>>>,
}

#[derive(Serialize, Deserialize)]
struct TradeRequest {
    symbol: String,
    side: OrderSide,
    amount: f64,
    leverage: f64,
    broker_id: String,
}

#[derive(Serialize, Deserialize)]
struct MarketDataResponse {
    symbol: String,
    bid: f64,
    ask: f64,
    timestamp: i64,
    volume: f64,
    orderbook_snapshot: OrderBookSnapshot,
}

#[derive(Serialize, Deserialize)]
struct OrderBookSnapshot {
    bids: Vec<(f64, f64)>,
    asks: Vec<(f64, f64)>,
}

#[derive(Serialize, Deserialize)]
struct AccountBalance {
    balance: f64,
    equity: f64,
    margin_used: f64,
    free_margin: f64,
}

async fn get_market_data(State(state): State<AppState>) -> impl IntoResponse {
    let market = state.market_engine.read().await;
    let price_feed = state.price_feed.read().await;

    let current_price = price_feed.get_current_price("EURUSD");
    let orderbook = market.get_orderbook("EURUSD");

    let snapshot = OrderBookSnapshot {
        bids: orderbook.get_bids(10),
        asks: orderbook.get_asks(10),
    };

    let response = MarketDataResponse {
        symbol: "EURUSD".to_string(),
        bid: current_price.bid,
        ask: current_price.ask,
        timestamp: chrono::Utc::now().timestamp(),
        volume: orderbook.get_total_volume(),
        orderbook_snapshot: snapshot,
    };

    Json(response)
}

async fn place_trade(
    State(state): State<AppState>,
    Json(payload): Json<TradeRequest>,
) -> impl IntoResponse {
    let mut market = state.market_engine.write().await;
    let brokers = state.brokers.read().await;

    if let Some(broker) = brokers.get(&payload.broker_id) {
        match market
            .place_order(
                &payload.symbol,
                payload.side,
                payload.amount,
                broker.clone(),
            )
            .await
        {
            Ok(order_id) => Json(serde_json::json!({
                "success": true,
                "order_id": order_id,
                "message": "Trade placed successfully"
            })),
            Err(e) => Json(serde_json::json!({
                "success": false,
                "error": format!("Failed to place trade: {}", e)
            })),
        }
    } else {
        Json(serde_json::json!({
            "success": false,
            "error": "Invalid broker ID"
        }))
    }
}

async fn get_brokers(State(state): State<AppState>) -> impl IntoResponse {
    let brokers = state.brokers.read().await;
    let broker_list: Vec<_> = brokers
        .iter()
        .map(|(id, broker)| {
            serde_json::json!({
                "id": id,
                "name": broker.name,
                "broker_type": format!("{:?}", broker.broker_type),
                "spread": broker.spread,
                "commission": broker.commission
            })
        })
        .collect();

    Json(broker_list)
}

async fn websocket_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> Response {
    ws.on_upgrade(|socket| handle_websocket(socket, state))
}

async fn handle_websocket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    let state_clone = state.clone();
    let sender_task = tokio::spawn(async move {
        let mut interval = interval(Duration::from_millis(100));

        loop {
            interval.tick().await;

            let market = state_clone.market_engine.read().await;
            let price_feed = state_clone.price_feed.read().await;

            let current_price = price_feed.get_current_price("EURUSD");
            let orderbook = market.get_orderbook("EURUSD");

            let snapshot = OrderBookSnapshot {
                bids: orderbook.get_bids(5),
                asks: orderbook.get_asks(5),
            };

            let message = MarketDataResponse {
                symbol: "EURUSD".to_string(),
                bid: current_price.bid,
                ask: current_price.ask,
                timestamp: chrono::Utc::now().timestamp(),
                volume: orderbook.get_total_volume(),
                orderbook_snapshot: snapshot,
            };

            if let Ok(msg) = serde_json::to_string(&message) {
                if sender.send(Message::Text(msg)).await.is_err() {
                    break;
                }
            }
        }
    });

    let receiver_task = tokio::spawn(async move {
        while let Some(msg) = receiver.next().await {
            if let Ok(msg) = msg {
                if let Message::Text(text) = msg {
                    info!("Received WebSocket message: {}", text);
                }
            }
        }
    });

    tokio::select! {
        _ = sender_task => {},
        _ = receiver_task => {},
    }
}

async fn initialize_market() -> AppState {
    let mut market_engine = MarketEngine::new();
    let mut price_feed = PriceFeed::new();
    let mut brokers = HashMap::new();

    // Initialize market with major currency pairs
    market_engine.add_symbol("EURUSD".to_string());
    market_engine.add_symbol("GBPUSD".to_string());
    market_engine.add_symbol("USDJPY".to_string());

    // Initialize price feed
    price_feed.add_symbol("EURUSD", 1.0950);
    price_feed.add_symbol("GBPUSD", 1.2650);
    price_feed.add_symbol("USDJPY", 150.25);

    // Create different types of brokers
    brokers.insert(
        "direct_access".to_string(),
        Broker::new(
            "Direct Access".to_string(),
            BrokerType::DirectAccess,
            0.0001, // 0.1 pip spread
            0.0,    // No commission
        ),
    );

    brokers.insert(
        "ecn_broker".to_string(),
        Broker::new(
            "ECN Broker".to_string(),
            BrokerType::ECN,
            0.0, // No spread
            5.0, // $5 commission per lot
        ),
    );

    brokers.insert(
        "market_maker".to_string(),
        Broker::new(
            "Market Maker".to_string(),
            BrokerType::MarketMaker,
            0.0003, // 0.3 pip spread
            0.0,    // No commission
        ),
    );

    // Initialize thousands of market participants
    for i in 0..10000000 {
        let participant = Participant::new_random(format!("trader_{}", i));
        market_engine.add_participant(participant);
    }

    // Initialize hundreds of banks (market makers)
    for i in 0..500 {
        let bank = Participant::new_bank(format!("bank_{}", i));
        market_engine.add_participant(bank);
    }

    AppState {
        market_engine: Arc::new(RwLock::new(market_engine)),
        price_feed: Arc::new(RwLock::new(price_feed)),
        brokers: Arc::new(RwLock::new(brokers)),
    }
}

async fn run_market_simulation(state: AppState) {
    let mut interval = interval(Duration::from_millis(10));

    loop {
        interval.tick().await;

        let mut market = state.market_engine.write().await;
        let mut price_feed = state.price_feed.write().await;

        // Update market simulation
        market.update().await;

        // Update price feed based on market activity
        price_feed.update_from_market(&market);
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    info!("Initializing FX Market Simulation...");

    let state = initialize_market().await;

    // Start market simulation in background
    let simulation_state = state.clone();
    tokio::spawn(run_market_simulation(simulation_state));

    let app = Router::new()
        .route("/api/market-data", get(get_market_data))
        .route("/api/trade", post(place_trade))
        .route("/api/brokers", get(get_brokers))
        .route("/ws", get(websocket_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    info!("Starting server on http://localhost:3001");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    axum::serve(listener, app).await?;

    Ok(())
}
