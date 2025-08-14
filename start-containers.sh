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

# Stop any existing containers to avoid conflicts
print_info "Stopping any existing containers to avoid conflicts..."
docker-compose down 2>/dev/null || true

# Start all services using the main docker-compose file
print_info "Starting all containers..."
docker-compose up -d

# Wait for services to be ready
print_info "Waiting for services to be ready..."
sleep 20

# Check if all containers are running
print_info "Checking container status..."

if docker-compose ps | grep -q "Up"; then
    print_status "All containers started successfully!"
else
    echo "❌ Some containers failed to start. Checking logs..."
    docker-compose logs --tail=10
    exit 1
fi

echo ""
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "🔗 Access Points:"
echo "  - Health check: http://localhost:3001/health"
echo "  - MCP endpoint: http://localhost:3001/mcp"
echo "  - PostgreSQL: localhost:5432"
echo "  - LLM API: http://localhost:11434"
echo "  - User Agent: http://localhost:3002"

echo ""
echo "📝 Useful Commands:"
echo "  - View all logs: docker-compose logs -f"
echo "  - View PostgreSQL logs: docker-compose logs -f postgres-db"
echo "  - View MCP logs: docker-compose logs -f mcp-db-server"
echo "  - View LLM logs: docker-compose logs -f llm-container"
echo "  - View User Agent logs: docker-compose logs -f user-agent"
echo "  - Stop all containers: ./stop-containers.sh"

echo ""
echo "🎉 All services are ready! Open http://localhost:3002 to start using the application."
