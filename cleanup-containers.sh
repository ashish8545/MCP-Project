#!/bin/bash

# Cleanup script to remove any existing MCP-related containers
set -e

echo "🧹 Cleaning up existing MCP containers..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Stop and remove containers from main docker-compose
print_info "Stopping main docker-compose services..."
docker-compose down --remove-orphans 2>/dev/null || true

# Stop and remove containers from individual docker-compose files
print_info "Stopping individual service containers..."
cd postgres-db && docker-compose down --remove-orphans 2>/dev/null || true && cd ..
cd mcp-db-server && docker-compose -f docker-compose.mcp.yml down --remove-orphans 2>/dev/null || true && cd ..

# Remove any orphaned containers
print_info "Removing any orphaned containers..."
docker container prune -f 2>/dev/null || true

# Remove any conflicting containers by name
for container in mcp-postgres mcp-db-server llm-container user-agent mcpproject-postgres-db-1 mcpproject-mcp-db-server-1; do
    if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
        print_info "Removing container: $container"
        docker rm -f "$container" 2>/dev/null || true
    fi
done

print_status "Cleanup completed!"

echo ""
echo "📊 Remaining containers:"
docker ps -a | grep -E "(mcp|postgres|llm|user-agent)" || echo "No MCP-related containers found"

echo ""
echo "🚀 You can now run './start-containers.sh' to start fresh containers."
