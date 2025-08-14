#!/bin/bash

# Helper script to start all MCP containers (PostgreSQL, MCP Server, LLM, User Agent)
set -e

echo "🚀 Starting all MCP containers..."

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

# Start LLM container
if docker ps --format "table {{.Names}}" | grep -q "llm-container"; then
    print_info "LLM container is already running"
else
    print_info "Starting LLM container..."
    docker-compose up -d llm-container
    
    # Wait for LLM service to be ready
    print_info "Waiting for LLM service to be ready..."
    sleep 15
fi

# Start User Agent container (depends on MCP server and LLM)
if docker ps --format "table {{.Names}}" | grep -q "user-agent"; then
    print_info "User Agent container is already running"
else
    print_info "Starting User Agent container..."
    docker-compose up -d user-agent
fi

print_status "All containers started successfully!"

echo ""
echo "📊 Container Status:"
docker ps | grep -E "(mcp|user-agent|llm-container)" || echo "No MCP containers running"

echo ""
echo "🔗 Access Points:"
echo "  - Health check: http://localhost:3001/health"
echo "  - MCP endpoint: http://localhost:3001/mcp"
echo "  - PostgreSQL: localhost:5432"
echo "  - LLM API: http://localhost:11434"
echo "  - User Agent: http://localhost:3002"

echo ""
echo "📝 Useful Commands:"
echo "  - View PostgreSQL logs: cd postgres-db && docker-compose logs -f postgres"
echo "  - View MCP logs: cd mcp-db-server && docker-compose -f docker-compose.mcp.yml logs -f"
echo "  - View LLM logs: docker-compose logs -f llm-container"
echo "  - View User Agent logs: docker-compose logs -f user-agent"
echo "  - Stop all containers: ./stop-containers.sh"
echo "  - Individual container management:"
echo "    - PostgreSQL: cd postgres-db && ./postgres.sh [start|stop|logs]"
echo "    - MCP Server: cd mcp-db-server && ./mcp-server.sh [start|stop|logs]"
echo "    - LLM: cd llm-container && ./llm.sh [start|stop|logs]"
echo "    - User Agent: cd user-agent && ./user-agent.sh [start|stop|logs]"
