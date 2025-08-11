# MCP Database Server

A Model Context Protocol (MCP) server that provides database operations via HTTP endpoints, built with Node.js, TypeScript, and PostgreSQL.

## Project Structure

```
try1/
├── mcp-db-server/          # MCP Server Application
│   ├── http.ts             # HTTP server implementation
│   ├── stdio.ts            # STDIO server implementation
│   ├── package.json        # Node.js dependencies
│   ├── tsconfig.json       # TypeScript configuration
│   ├── Dockerfile          # Production Docker image
│   ├── Dockerfile.dev      # Development Docker image
│   ├── docker-compose.mcp.yml      # Production MCP container
│   ├── docker-compose.mcp.dev.yml  # Development MCP container
│   └── mcp-server.sh       # MCP server management script
├── postgres-db/            # PostgreSQL Database
│   ├── init.sql            # Database initialization script
│   ├── docker-compose.yml  # Production PostgreSQL container
│   ├── docker-compose.dev.yml # Development PostgreSQL container
│   └── postgres.sh         # PostgreSQL management script
├── start-containers.sh     # Helper script to start all containers
├── stop-containers.sh      # Helper script to stop all containers
├── test-docker.sh          # Test script for the entire setup
└── README.md               # This file
```

## Features

- **Database Operations**: Execute raw SQL queries, insert records, and retrieve data
- **HTTP Transport**: RESTful API endpoints for MCP communication
- **PostgreSQL Integration**: Full PostgreSQL database support
- **Health Checks**: Built-in health monitoring endpoints
- **Docker Ready**: Complete containerization with Docker and Docker Compose
- **Modular Structure**: Separated containers for easy management and scaling

## Quick Start with Docker

### Prerequisites

- Docker
- Docker Compose

### 1. Clone and Setup

```bash
git clone <repository-url>
cd try1
```

### 2. Configure Environment (Optional)

Each service has its own environment configuration. Copy the example files and modify as needed:

```bash
# Configure PostgreSQL
cd postgres-db
cp env.example .env
# Edit .env to customize database settings
cd ..

# Configure MCP Server
cd mcp-db-server
cp env.example .env
# Edit .env to customize server settings
cd ..
```

**Note**: Make sure the database credentials in both `.env` files match.

### 3. Start PostgreSQL Database

```bash
# Start PostgreSQL container
cd postgres-db
./postgres.sh start
cd ..
```

### 4. Start MCP Server

```bash
# Start MCP server container (connects to PostgreSQL)
cd mcp-db-server
./mcp-server.sh start
cd ..
```

### 5. Verify Installation

Check if the services are running:

```bash
# Check all service status
docker ps

# Test health endpoint
curl http://localhost:3000/health
```

### 6. Stop Services

```bash
# Stop MCP server
cd mcp-db-server
./mcp-server.sh stop
cd ..

# Stop PostgreSQL
cd postgres-db
./postgres.sh stop
cd ..
```

### 7. Helper Scripts (Optional)

For convenience, you can use the provided helper scripts:

```bash
# Start all containers
./start-containers.sh

# Stop all containers
./stop-containers.sh

# Test the setup
./test-docker.sh
```

## Manual Docker Build

If you prefer to build and run containers manually:

```bash
# Create the network for container communication
docker network create mcp-network

# Start PostgreSQL container
docker run -d \
  --name mcp-postgres \
  --network mcp-network \
  -e POSTGRES_DB=mcp_database \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

# Build MCP server image
cd mcp-db-server
docker build -t mcp-db-server .

# Run MCP server container
docker run -d \
  --name mcp-server \
  --network mcp-network \
  -p 3000:3000 \
  -e PG_HOST=mcp-postgres \
  -e PG_DATABASE=mcp_database \
  -e PG_USER=postgres \
  -e PG_PASSWORD=your_password \
  mcp-db-server
```

## API Endpoints

### Health Check
```
GET /health
```

### MCP Endpoints
```
POST /mcp    - Handle MCP requests
GET /mcp     - Server-Sent Events (SSE)
DELETE /mcp  - Terminate session
```

## Available Tools

The MCP server provides the following tools:

1. **queryDatabase** - Execute raw SQL queries
2. **insertRecord** - Insert records into tables
3. **getRecords** - Retrieve records from tables

## Database Schema

The application includes sample tables:

- **employees** - Employee information
- **projects** - Project details
- **employee_projects** - Employee-project relationships

Sample data is automatically loaded when the PostgreSQL container starts for the first time.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PG_HOST` | `localhost` | PostgreSQL host |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_DATABASE` | `mcp_database` | Database name |
| `PG_USER` | `postgres` | Database user |
| `PG_PASSWORD` | `your_password` | Database password |
| `PORT` | `3000` | Application port |

## Development

### Local Development

```bash
# Navigate to MCP server directory
cd mcp-db-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start HTTP server
npm run start:http

# Start STDIO server
npm run start:stdio
```

### Docker Development

```bash
# Start PostgreSQL for development
cd postgres-db
./postgres.sh start-dev
cd ..

# Start MCP server in development mode
cd mcp-db-server
./mcp-server.sh start-dev
cd ..
```

## Troubleshooting

### Common Issues

1. **Connection refused to PostgreSQL**
   - Ensure PostgreSQL container is running: `docker-compose ps`
   - Check logs: `docker-compose logs postgres`

2. **Port already in use**
   - Change the port in `.env` or `docker-compose.yml`
   - Stop conflicting services

3. **Permission denied**
   - The container runs as non-root user for security
   - Check file permissions if mounting volumes

### Logs

```bash
# View PostgreSQL logs
cd postgres-db
./postgres.sh logs
cd ..

# View MCP server logs
cd mcp-db-server
./mcp-server.sh logs
cd ..
```

## Security Considerations

- The application runs as a non-root user inside the container
- Database credentials should be changed in production
- Consider using Docker secrets for sensitive data
- The PostgreSQL container is only accessible within the Docker network

## Production Deployment

For production deployment:

1. Use strong passwords for database
2. Enable SSL/TLS for database connections
3. Use environment-specific configuration
4. Set up proper logging and monitoring
5. Configure backup strategies for PostgreSQL data

# MCP Server Management
cd mcp-db-server
./mcp-server.sh start          # Start production server
./mcp-server.sh start-dev      # Start development server
./mcp-server.sh logs           # View production logs
./mcp-server.sh logs-dev       # View development logs
./mcp-server.sh status         # Show status
./mcp-server.sh help           # Show all commands

# PostgreSQL Management
cd postgres-db
./postgres.sh start            # Start production database
./postgres.sh start-dev        # Start development database
./postgres.sh logs             # View production logs
./postgres.sh logs-dev         # View development logs
./postgres.sh status           # Show status
./postgres.sh help             # Show all commands

## License

ISC
