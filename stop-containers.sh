#!/bin/bash

# Helper script to stop MCP Database Server containers
set -e

echo "🛑 Stopping MCP Database Server containers..."

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

# Stop MCP server container
if docker ps --format "table {{.Names}}" | grep -q "mcp-db-server"; then
    print_info "Stopping MCP server container..."
    cd mcp-db-server && docker-compose -f docker-compose.mcp.yml down && cd ..
    print_status "MCP server container stopped"
else
    print_info "MCP server container is not running"
fi

# Stop PostgreSQL container
if docker ps --format "table {{.Names}}" | grep -q "mcp-postgres"; then
    print_info "Stopping PostgreSQL container..."
    cd postgres-db && docker-compose down && cd ..
    print_status "PostgreSQL container stopped"
else
    print_info "PostgreSQL container is not running"
fi

print_status "All containers stopped successfully!"

echo ""
echo "📊 Remaining containers:"
docker ps --filter "name=mcp" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No MCP containers running"
