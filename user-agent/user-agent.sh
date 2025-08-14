#!/bin/bash

# User Agent Container Management Script
# Usage: ./user-agent.sh [action]
# Actions: start, stop, restart, logs, status, help

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
    echo -e "${BLUE}🤖 User Agent Container Management${NC}"
    echo "==================================="
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Check if required dependencies are running
check_dependencies() {
    local missing_deps=()
    
    if ! docker ps --format "table {{.Names}}" | grep -q "mcp-db-server"; then
        missing_deps+=("MCP Database Server")
    fi
    
    if ! docker ps --format "table {{.Names}}" | grep -q "llm-container"; then
        missing_deps+=("LLM Container")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing required dependencies:"
        for dep in "${missing_deps[@]}"; do
            echo "  - $dep"
        done
        echo ""
        echo "Please start all dependencies first:"
        echo "  - MCP Server: cd ../mcp-db-server && ./mcp-server.sh start"
        echo "  - LLM Container: cd ../llm-container && ./llm.sh start"
        echo "  - Or start all: ../start-containers.sh"
        exit 1
    fi
}

# Start User Agent container
start_production() {
    print_header
    echo "🤖 Starting User Agent Container..."
    
    check_docker
    check_dependencies
    
    if docker ps --format "table {{.Names}}" | grep -q "user-agent"; then
        print_info "User Agent container is already running"
    else
        print_info "Starting User Agent container..."
        cd .. && docker-compose up -d user-agent && cd user-agent
        
        print_info "Waiting for User Agent service to be ready..."
        sleep 10
        
        # Check if container is running
        if docker ps --format "table {{.Names}}" | grep -q "user-agent"; then
            print_status "User Agent container started successfully"
        else
            print_error "Failed to start User Agent container"
            exit 1
        fi
    fi
    
    show_status
}

# Stop User Agent container
stop_production() {
    print_header
    echo "🛑 Stopping User Agent Container..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "user-agent"; then
        print_info "Stopping User Agent container..."
        cd .. && docker-compose down user-agent && cd user-agent
        print_status "User Agent container stopped successfully"
    else
        print_info "User Agent container is not running"
    fi
}

# Restart User Agent container
restart_production() {
    print_header
    echo "🔄 Restarting User Agent Container..."
    
    stop_production
    sleep 2
    start_production
}

# Show logs
show_logs() {
    print_header
    echo "📋 User Agent Container Logs..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "user-agent"; then
        print_info "Showing User Agent container logs (Press Ctrl+C to exit)..."
        cd .. && docker-compose logs -f user-agent
    else
        print_error "User Agent container is not running"
        exit 1
    fi
}

# Show container status
show_status() {
    echo ""
    echo "📊 User Agent Container Status:"
    
    if docker ps --format "table {{.Names}}" | grep -q "user-agent"; then
        docker ps --filter "name=user-agent" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo "🔗 User Agent Access:"
        echo "  - Web Interface: http://localhost:3002"
        echo "  - Health check: curl http://localhost:3002/health (if available)"
        echo ""
        echo "🔌 Connected Services:"
        echo "  - MCP Server: http://mcp-db-server:3000/mcp"
        echo "  - LLM API: http://llm-container:11434"
    else
        echo "❌ User Agent container is not running"
    fi
}

# Show help
show_help() {
    print_header
    echo "Available actions:"
    echo "  start    - Start the User Agent container"
    echo "  stop     - Stop the User Agent container"
    echo "  restart  - Restart the User Agent container"
    echo "  logs     - Show container logs (real-time)"
    echo "  status   - Show container status and access info"
    echo "  help     - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./user-agent.sh start"
    echo "  ./user-agent.sh logs"
    echo "  ./user-agent.sh status"
    echo ""
    echo "Dependencies:"
    echo "  - MCP Database Server (mcp-db-server)"
    echo "  - LLM Container (llm-container)"
    echo ""
    echo "Note: This script manages the User Agent container using docker-compose"
    echo "      from the parent directory's docker-compose.yml file."
}

# Main script logic
case "${1:-help}" in
    "start")
        start_production
        ;;
    "stop")
        stop_production
        ;;
    "restart")
        restart_production
        ;;
    "logs")
        show_logs
        ;;
    "status")
        print_header
        show_status
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        print_error "Unknown action: $1"
        echo ""
        show_help
        exit 1
        ;;
esac