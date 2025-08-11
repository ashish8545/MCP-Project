#!/bin/bash

# PostgreSQL Database Management Script
# Usage: ./postgres.sh [action]
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
    echo -e "${BLUE}🐘 PostgreSQL Database Management${NC}"
    echo "====================================="
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Start PostgreSQL in production mode
start_production() {
    print_header
    echo "🐘 Starting PostgreSQL Database (Production Mode)..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "mcp-postgres"; then
        print_info "PostgreSQL container is already running"
    else
        print_info "Starting PostgreSQL container..."
        if docker-compose up -d; then
            print_status "PostgreSQL started successfully"
            
            # Wait for PostgreSQL to be ready
            print_info "Waiting for PostgreSQL to be ready..."
            sleep 10
            
            # Check if PostgreSQL is healthy
            if docker-compose ps | grep -q "healthy"; then
                print_status "PostgreSQL is healthy and ready"
            else
                print_info "PostgreSQL is starting up..."
            fi
        else
            print_error "Failed to start PostgreSQL"
            exit 1
        fi
    fi
    
    print_status "PostgreSQL Database is ready!"
    show_status
}

# Start PostgreSQL in development mode
start_development() {
    print_header
    echo "🐘 Starting PostgreSQL Database (Development Mode)..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "mcp-postgres-dev"; then
        print_info "PostgreSQL development container is already running"
    else
        print_info "Starting PostgreSQL container in development mode..."
        if docker-compose -f docker-compose.dev.yml up -d; then
            print_status "PostgreSQL started successfully in development mode"
            
            # Wait for PostgreSQL to be ready
            print_info "Waiting for PostgreSQL to be ready..."
            sleep 10
            
            # Check if PostgreSQL is healthy
            if docker-compose -f docker-compose.dev.yml ps | grep -q "healthy"; then
                print_status "PostgreSQL is healthy and ready"
            else
                print_info "PostgreSQL is starting up..."
            fi
        else
            print_error "Failed to start PostgreSQL in development mode"
            exit 1
        fi
    fi
    
    print_status "PostgreSQL Database (Development) is ready!"
    show_status
}

# Stop PostgreSQL
stop_database() {
    print_header
    echo "🛑 Stopping PostgreSQL Database..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "mcp-postgres"; then
        print_info "Stopping PostgreSQL container..."
        if docker-compose down; then
            print_status "PostgreSQL container stopped"
        else
            print_error "Failed to stop PostgreSQL container"
            exit 1
        fi
    else
        print_info "PostgreSQL container is not running"
    fi
    
    print_status "PostgreSQL Database stopped successfully!"
}

# Stop PostgreSQL development
stop_development() {
    print_header
    echo "🛑 Stopping PostgreSQL Database (Development)..."
    
    check_docker
    
    if docker ps --format "table {{.Names}}" | grep -q "mcp-postgres-dev"; then
        print_info "Stopping PostgreSQL development container..."
        if docker-compose -f docker-compose.dev.yml down; then
            print_status "PostgreSQL development container stopped"
        else
            print_error "Failed to stop PostgreSQL development container"
            exit 1
        fi
    else
        print_info "PostgreSQL development container is not running"
    fi
    
    print_status "PostgreSQL Database (Development) stopped successfully!"
}

# Restart PostgreSQL
restart_database() {
    print_header
    echo "🔄 Restarting PostgreSQL Database..."
    
    check_docker
    
    print_info "Stopping PostgreSQL..."
    if docker ps --format "table {{.Names}}" | grep -q "mcp-postgres"; then
        docker-compose down
        print_status "PostgreSQL stopped"
    else
        print_info "PostgreSQL was not running"
    fi
    
    print_info "Starting PostgreSQL..."
    if docker-compose up -d; then
        print_status "PostgreSQL started successfully"
        
        # Wait for PostgreSQL to be ready
        print_info "Waiting for PostgreSQL to be ready..."
        sleep 10
        
        # Check if PostgreSQL is healthy
        if docker-compose ps | grep -q "healthy"; then
            print_status "PostgreSQL is healthy and ready"
        else
            print_info "PostgreSQL is starting up..."
        fi
    else
        print_error "Failed to start PostgreSQL"
        exit 1
    fi
    
    print_status "PostgreSQL Database restarted successfully!"
    show_status
}

# Show logs
show_logs() {
    print_header
    echo "📋 PostgreSQL Database Logs"
    
    check_docker
    
    if ! docker ps --format "table {{.Names}}" | grep -q "mcp-postgres"; then
        print_info "PostgreSQL container is not running"
        echo "To start the database: ./postgres.sh start"
        exit 1
    fi
    
    print_info "Showing PostgreSQL logs (Press Ctrl+C to exit)"
    echo ""
    docker-compose logs -f postgres
}

# Show development logs
show_dev_logs() {
    print_header
    echo "📋 PostgreSQL Database Logs (Development)"
    
    check_docker
    
    if ! docker ps --format "table {{.Names}}" | grep -q "mcp-postgres-dev"; then
        print_info "PostgreSQL development container is not running"
        echo "To start the development database: ./postgres.sh start-dev"
        exit 1
    fi
    
    print_info "Showing PostgreSQL development logs (Press Ctrl+C to exit)"
    echo ""
    docker-compose -f docker-compose.dev.yml logs -f postgres
}

# Show status
show_status() {
    echo ""
    echo "📊 Container Status:"
    docker ps --filter "name=mcp-postgres" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No PostgreSQL containers running"
    
    echo ""
    echo "🔗 Connection Details:"
    echo "  - Host: localhost"
    echo "  - Port: 5432"
    echo "  - Database: mcp_database"
    echo "  - Username: postgres"
    echo "  - Password: your_password"
    
    echo ""
    echo "📝 Useful Commands:"
    echo "  - View logs: ./postgres.sh logs"
    echo "  - Stop database: ./postgres.sh stop"
    echo "  - Restart database: ./postgres.sh restart"
    echo "  - Connect with psql: docker exec -it mcp-postgres psql -U postgres -d mcp_database"
}

# Show help
show_help() {
    print_header
    echo "Usage: ./postgres.sh [action]"
    echo ""
    echo "Actions:"
    echo "  start       - Start PostgreSQL in production mode"
    echo "  start-dev   - Start PostgreSQL in development mode"
    echo "  stop        - Stop PostgreSQL (production)"
    echo "  stop-dev    - Stop PostgreSQL (development)"
    echo "  restart     - Restart PostgreSQL (production)"
    echo "  logs        - View PostgreSQL logs (production)"
    echo "  logs-dev    - View PostgreSQL logs (development)"
    echo "  status      - Show container status and connection details"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./postgres.sh start"
    echo "  ./postgres.sh start-dev"
    echo "  ./postgres.sh logs"
    echo "  ./postgres.sh stop"
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
        stop_database
        ;;
    "stop-dev")
        stop_development
        ;;
    "restart")
        restart_database
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
