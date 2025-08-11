#!/bin/bash

# MCP Database Server Management Script
# Usage: ./mcp-server.sh [action]
# Actions: start, stop, restart, logs, start-dev, stop-dev, logs-dev, status, help

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

print_header() {
    echo -e "${BLUE}🔧 MCP Database Server Management${NC}"
    echo "=================================="
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Check if PostgreSQL container is running
check_postgres() {
    if ! docker ps --format "table {{.Names}}" | grep -q "mcp-postgres"; then
        print_error "PostgreSQL container is not running. Please start PostgreSQL first:"
        echo "  cd ../postgres-db && ./postgres.sh start"
        exit 1
    fi
}

# Start MCP server in production mode
start_production() {
    print_header
    echo "🚀 Starting MCP Database Server (Production Mode)..."
    
    check_docker
    check_postgres
    
    if docker ps --format "table {{.Names}}" | grep -q "mcp-db-server"; then
        print_info "MCP server container is already running"
    else
        print_info "Starting MCP server container..."
        if docker-compose -f docker-compose.mcp.yml up -d; then
            print_status "MCP server started successfully"
        else
            print_error "Failed to start MCP server"
            exit 1
        fi
    fi
    
    print_status "MCP Database Server is ready!"
    show_status
}

# Start MCP server in development mode
start_development() {
    print_header
    echo "🚀 Starting MCP Database Server (Development Mode)..."
    
    check_docker
    check_postgres
    
    if docker ps --format "table {{.Names}}" | grep -q "mcp-db-server-dev"; then
        print_info "MCP server development container is already running"
    else
        print_info "Starting MCP server container in development mode..."
        if docker-compose -f docker-compose.mcp.dev.yml up --build; then
            print_status "MCP server started successfully in development mode"
        else
            print_error "Failed to start MCP server in development mode"
            exit 1
        fi
    fi
    
    print_status "MCP Database Server (Development) is ready!"
    show_status
}

# Stop MCP server
stop_server() {
    print_header
    echo "🛑 Stopping MCP Database Server..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "mcp-db-server"; then
        print_info "Stopping MCP server container..."
        if docker-compose -f docker-compose.mcp.yml down; then
            print_status "MCP server container stopped"
        else
            print_error "Failed to stop MCP server container"
            exit 1
        fi
    else
        print_info "MCP server container is not running"
    fi
    
    print_status "MCP Database Server stopped successfully!"
}

# Stop MCP server development
stop_development() {
    print_header
    echo "🛑 Stopping MCP Database Server (Development)..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "mcp-db-server-dev"; then
        print_info "Stopping MCP server development container..."
        if docker-compose -f docker-compose.mcp.dev.yml down; then
            print_status "MCP server development container stopped"
        else
            print_error "Failed to stop MCP server development container"
            exit 1
        fi
    else
        print_info "MCP server development container is not running"
    fi
    
    print_status "MCP Database Server (Development) stopped successfully!"
}

# Restart MCP server
restart_server() {
    print_header
    echo "🔄 Restarting MCP Database Server..."
    
    check_docker
    
    print_info "Stopping MCP server..."
    if docker ps --format "table {{.Names}}" | grep -q "mcp-db-server"; then
        docker-compose -f docker-compose.mcp.yml down
        print_status "MCP server stopped"
    else
        print_info "MCP server was not running"
    fi
    
    print_info "Starting MCP server..."
    if docker-compose -f docker-compose.mcp.yml up -d; then
        print_status "MCP server started successfully"
    else
        print_error "Failed to start MCP server"
        exit 1
    fi
    
    print_status "MCP Database Server restarted successfully!"
    show_status
}

# Show logs
show_logs() {
    print_header
    echo "📋 MCP Database Server Logs"
    
    check_docker
    
    if ! docker ps --format "table {{.Names}}" | grep -q "mcp-db-server"; then
        print_info "MCP server container is not running"
        echo "To start the server: ./mcp-server.sh start"
        exit 1
    fi
    
    print_info "Showing MCP server logs (Press Ctrl+C to exit)"
    echo ""
    docker-compose -f docker-compose.mcp.yml logs -f
}

# Show development logs
show_dev_logs() {
    print_header
    echo "📋 MCP Database Server Logs (Development)"
    
    check_docker
    
    if ! docker ps --format "table {{.Names}}" | grep -q "mcp-db-server-dev"; then
        print_info "MCP server development container is not running"
        echo "To start the development server: ./mcp-server.sh start-dev"
        exit 1
    fi
    
    print_info "Showing MCP server development logs (Press Ctrl+C to exit)"
    echo ""
    docker-compose -f docker-compose.mcp.dev.yml logs -f
}

# Show status
show_status() {
    echo ""
    echo "📊 Container Status:"
    docker ps --filter "name=mcp-db-server" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No MCP server containers running"
    
    echo ""
    echo "🔗 Access Points:"
    echo "  - Health check: http://localhost:3000/health"
    echo "  - MCP endpoint: http://localhost:3000/mcp"
    
    echo ""
    echo "📝 Useful Commands:"
    echo "  - View logs: ./mcp-server.sh logs"
    echo "  - Stop server: ./mcp-server.sh stop"
    echo "  - Restart server: ./mcp-server.sh restart"
}

# Show help
show_help() {
    print_header
    echo "Usage: ./mcp-server.sh [action]"
    echo ""
    echo "Actions:"
    echo "  start       - Start MCP server in production mode"
    echo "  start-dev   - Start MCP server in development mode (with hot reloading)"
    echo "  stop        - Stop MCP server (production)"
    echo "  stop-dev    - Stop MCP server (development)"
    echo "  restart     - Restart MCP server (production)"
    echo "  logs        - View MCP server logs (production)"
    echo "  logs-dev    - View MCP server logs (development)"
    echo "  status      - Show container status and access points"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./mcp-server.sh start"
    echo "  ./mcp-server.sh start-dev"
    echo "  ./mcp-server.sh logs"
    echo "  ./mcp-server.sh stop"
}

# Main script logic
case "${1:-help}" in
    "start")
        start_production
        ;;
    "start-dev")
        start_development
        ;;
    "stop")
        stop_server
        ;;
    "stop-dev")
        stop_development
        ;;
    "restart")
        restart_server
        ;;
    "logs")
        show_logs
        ;;
    "logs-dev")
        show_dev_logs
        ;;
    "status")
        print_header
        show_status
        ;;
    "help"|*)
        show_help
        ;;
esac
