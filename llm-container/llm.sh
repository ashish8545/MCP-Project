#!/bin/bash

# LLM Container Management Script
# Usage: ./llm.sh [action]
# Actions: start, stop, restart, logs, status, models, help

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
    echo -e "${BLUE}🤖 LLM Container Management${NC}"
    echo "============================"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Start LLM container
start_production() {
    print_header
    echo "🤖 Starting LLM Container..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "llm-container"; then
        print_info "LLM container is already running"
    else
        print_info "Starting LLM container..."
        cd .. && docker-compose up -d llm-container && cd llm-container
        
        print_info "Waiting for LLM service to be ready..."
        sleep 15
        
        # Check if container is running
        if docker ps --format "table {{.Names}}" | grep -q "llm-container"; then
            print_status "LLM container started successfully"
        else
            print_error "Failed to start LLM container"
            exit 1
        fi
    fi
    
    show_status
}

# Stop LLM container
stop_production() {
    print_header
    echo "🛑 Stopping LLM Container..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "llm-container"; then
        print_info "Stopping LLM container..."
        cd .. && docker-compose down llm-container && cd llm-container
        print_status "LLM container stopped successfully"
    else
        print_info "LLM container is not running"
    fi
}

# Restart LLM container
restart_production() {
    print_header
    echo "🔄 Restarting LLM Container..."
    
    stop_production
    sleep 2
    start_production
}

# Show logs
show_logs() {
    print_header
    echo "📋 LLM Container Logs..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "llm-container"; then
        print_info "Showing LLM container logs (Press Ctrl+C to exit)..."
        cd .. && docker-compose logs -f llm-container
    else
        print_error "LLM container is not running"
        exit 1
    fi
}

# Show container status
show_status() {
    echo ""
    echo "📊 LLM Container Status:"
    
    if docker ps --format "table {{.Names}}" | grep -q "llm-container"; then
        docker ps --filter "name=llm-container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo "🔗 LLM API Access:"
        echo "  - Ollama API: http://localhost:11434"
        echo "  - Health check: curl http://localhost:11434/api/tags"
    else
        echo "❌ LLM container is not running"
    fi
}

# Show available models
show_models() {
    print_header
    echo "📚 Available Models..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "llm-container"; then
        print_info "Fetching available models..."
        curl -s http://localhost:11434/api/tags 2>/dev/null | grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"//' || echo "No models found or API not accessible"
    else
        print_error "LLM container is not running. Please start it first with: ./llm.sh start"
        exit 1
    fi
}

# Show help
show_help() {
    print_header
    echo "Available actions:"
    echo "  start    - Start the LLM container"
    echo "  stop     - Stop the LLM container"
    echo "  restart  - Restart the LLM container"
    echo "  logs     - Show container logs (real-time)"
    echo "  status   - Show container status and access info"
    echo "  models   - List available models"
    echo "  help     - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./llm.sh start"
    echo "  ./llm.sh logs"
    echo "  ./llm.sh models"
    echo ""
    echo "Note: This script manages the LLM container using docker-compose"
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
    "models")
        show_models
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