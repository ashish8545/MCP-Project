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

# Stop User Agent container first (depends on others)
if docker ps --format "table {{.Names}}" | grep -q "user-agent"; then
    print_info "Stopping User Agent container..."
    docker-compose down user-agent 2>/dev/null || docker stop user-agent 2>/dev/null || true
    print_status "User Agent container stopped"
else
    print_info "User Agent container is not running"
fi

# Stop LLM container
if docker ps --format "table {{.Names}}" | grep -q "llm-container"; then
    print_info "Stopping LLM container..."
    docker-compose down llm-container 2>/dev/null || docker stop llm-container 2>/dev/null || true
    print_status "LLM container stopped"
else
    print_info "LLM container is not running"
fi

# Stop MCP server container
if docker ps --format "table {{.Names}}" | grep -q "mcp-db-server"; then
    print_info "Stopping MCP server container..."
    cd mcp-db-server && docker-compose -f docker-compose.mcp.yml down && cd ..
    print_status "MCP server container stopped"
else
    print_info "MCP server container is not running"
fi

# Stop PostgreSQL container last
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
docker ps --filter "name=mcp" --filter "name=user-agent" --filter "name=llm-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No MCP containers running"
