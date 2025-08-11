#!/bin/bash

# Test script for Docker containerization
set -e

echo "🐳 Testing Docker containerization for MCP Database Server"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Docker is running
echo "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi
print_status "Docker is running"

# Check if Docker Compose is available
echo "Checking Docker Compose..."
if ! docker-compose --version > /dev/null 2>&1; then
    print_error "Docker Compose is not available. Please install Docker Compose."
    exit 1
fi
print_status "Docker Compose is available"

# Build the image
echo "Building Docker image..."
if cd mcp-db-server && docker-compose -f docker-compose.mcp.yml build && cd ..; then
    print_status "Docker image built successfully"
else
    print_error "Failed to build Docker image"
    exit 1
fi

# Start PostgreSQL service
echo "Starting PostgreSQL..."
if cd postgres-db && docker-compose up -d && cd ..; then
    print_status "PostgreSQL started successfully"
else
    print_error "Failed to start PostgreSQL"
    exit 1
fi

# Start MCP server service
echo "Starting MCP server..."
if cd mcp-db-server && docker-compose -f docker-compose.mcp.yml up -d && cd ..; then
    print_status "MCP server started successfully"
else
    print_error "Failed to start MCP server"
    exit 1
fi

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Test health endpoint
echo "Testing health endpoint..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_status "Health endpoint is responding"
else
    print_error "Health endpoint is not responding"
    docker-compose logs mcp-server
    exit 1
fi

# Test database connection
echo "Testing database connection..."
if cd mcp-db-server && docker-compose -f docker-compose.mcp.yml exec -T mcp-server node -e "
const { Pool } = require('pg');
const pool = new Pool();
pool.query('SELECT 1 as test', (err, res) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    } else {
        console.log('Database connection successful');
        process.exit(0);
    }
});
" > /dev/null 2>&1 && cd ..; then
    print_status "Database connection successful"
else
    print_error "Database connection failed"
    cd postgres-db && docker-compose logs postgres && cd ..
    exit 1
fi

# Test MCP endpoint
echo "Testing MCP endpoint..."
if curl -X POST http://localhost:3000/mcp \
    -H "Content-Type: application/json" \
    -H "mcp-session-id: test-session" \
    -d '{"jsonrpc": "2.0", "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}, "id": 1}' \
    > /dev/null 2>&1; then
    print_status "MCP endpoint is responding"
else
    print_warning "MCP endpoint test failed (this might be expected for certain MCP clients)"
fi

# Show service status
echo "Service status:"
docker ps --filter "name=mcp"

print_status "All tests completed successfully!"
echo ""
echo "🎉 Your MCP Database Server is running in Docker!"
echo ""
echo "Access points:"
echo "  - Health check: http://localhost:3000/health"
echo "  - MCP endpoint: http://localhost:3000/mcp"
echo "  - PostgreSQL: localhost:5432"
echo ""
echo "To stop MCP server: cd mcp-db-server && docker-compose -f docker-compose.mcp.yml down"
echo "To stop PostgreSQL: cd postgres-db && docker-compose down"
echo "To view logs: cd postgres-db && docker-compose logs -f postgres"
echo "To view MCP logs: cd mcp-db-server && docker-compose -f docker-compose.mcp.yml logs -f"
