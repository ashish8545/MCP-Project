# MCP Database Server

This directory contains the MCP (Model Context Protocol) server application that provides database operations via HTTP endpoints.

## Contents

- **`http.ts`** - HTTP server implementation with Express.js
- **`stdio.ts`** - STDIO server implementation for direct communication
- **`package.json`** - Node.js dependencies and scripts
- **`tsconfig.json`** - TypeScript configuration
- **`Dockerfile`** - Production Docker image configuration
- **`Dockerfile.dev`** - Development Docker image with hot reloading
- **`docker-compose.mcp.yml`** - Production container orchestration
- **`docker-compose.mcp.dev.yml`** - Development container orchestration

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start HTTP server
npm run start:http

# Start STDIO server
npm run start:stdio
```

### Docker Management

```bash
# Production mode
./mcp-server.sh start          # Start server
./mcp-server.sh stop           # Stop server
./mcp-server.sh restart        # Restart server
./mcp-server.sh logs           # View logs
./mcp-server.sh status         # Show status

# Development mode
./mcp-server.sh start-dev      # Start development server
./mcp-server.sh stop-dev       # Stop development server
./mcp-server.sh logs-dev       # View development logs

# Help
./mcp-server.sh help           # Show all available commands
```

### Manual Docker Commands

```bash
# Production
docker-compose -f docker-compose.mcp.yml up -d

# Development
docker-compose -f docker-compose.mcp.dev.yml up --build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PG_HOST` | `postgres` | PostgreSQL host |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_DATABASE` | `mcp_database` | Database name |
| `PG_USER` | `postgres` | Database user |
| `PG_PASSWORD` | `your_password` | Database password |
| `PORT` | `3000` | Application port |

## API Endpoints

- **`GET /health`** - Health check endpoint
- **`POST /mcp`** - Handle MCP requests
- **`GET /mcp`** - Server-Sent Events (SSE)
- **`DELETE /mcp`** - Terminate session

## Available Tools

1. **queryDatabase** - Execute raw SQL queries
2. **insertRecord** - Insert records into tables
3. **getRecords** - Retrieve records from tables
