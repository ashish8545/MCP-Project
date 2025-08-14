#!/bin/bash

# Helper script to stop all MCP containers
set -e

echo "🛑 Stopping all MCP containers..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running."
    exit 1
fi

# Stop all services using docker-compose
print_info "Stopping all containers..."
docker-compose down

print_status "All containers stopped successfully!"

echo ""
echo "📊 Remaining containers:"
docker ps | grep -E "(mcp|user-agent|llm-container)" || echo "No MCP containers running"
