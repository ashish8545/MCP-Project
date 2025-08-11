#!/bin/bash

# Helper script to start MCP Database Server containers
set -e

echo "🚀 Starting MCP Database Server containers..."

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
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if containers are already running
if docker ps --format "table {{.Names}}" | grep -q "mcp-postgres"; then
    print_info "PostgreSQL container is already running"
else
    print_info "Starting PostgreSQL container..."
    cd postgres-db && docker-compose up -d postgres && cd ..
    
    # Wait for PostgreSQL to be ready
    print_info "Waiting for PostgreSQL to be ready..."
    sleep 10
fi

if docker ps --format "table {{.Names}}" | grep -q "mcp-db-server"; then
    print_info "MCP server container is already running"
else
    print_info "Starting MCP server container..."
    cd mcp-db-server && docker-compose -f docker-compose.mcp.yml up -d && cd ..
fi

print_status "All containers started successfully!"

echo ""
echo "📊 Container Status:"
docker ps --filter "name=mcp" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "🔗 Access Points:"
echo "  - Health check: http://localhost:3000/health"
echo "  - MCP endpoint: http://localhost:3000/mcp"
echo "  - PostgreSQL: localhost:5432"

echo ""
echo "📝 Useful Commands:"
echo "  - View PostgreSQL logs: cd postgres-db && docker-compose logs -f postgres"
echo "  - View MCP logs: cd mcp-db-server && docker-compose -f docker-compose.mcp.yml logs -f"
echo "  - Stop MCP server: cd mcp-db-server && docker-compose -f docker-compose.mcp.yml down"
echo "  - Stop PostgreSQL: cd postgres-db && docker-compose down"
