#!/bin/bash

# FX Market Simulation Startup Script
# This script starts both the backend and frontend servers

echo "🚀 Starting FX Market Simulation..."

# Function to kill background processes on exit
cleanup() {
    echo "🛑 Shutting down servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

# Set up cleanup on script exit
trap cleanup EXIT INT TERM

# Check if Rust and Node.js are installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo not found. Please install Rust from https://rustup.rs/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Node.js/npm not found. Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Start backend server
echo "🔧 Starting Rust backend server..."
cd backend
cargo run &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend server
echo "🎨 Starting Vue.js frontend server..."
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ FX Market Simulation is running!"
echo ""
echo "📊 Backend API: http://localhost:3001"
echo "🌐 Frontend UI: http://localhost:5173"
echo "📡 WebSocket: ws://localhost:3001/ws"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for user to stop the script
wait