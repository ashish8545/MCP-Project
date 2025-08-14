# MCP Multi-Container Architecture

A complete Model Context Protocol (MCP) ecosystem with database operations, LLM integration, and a user-friendly web interface. Built with Node.js, TypeScript, PostgreSQL, Ollama, and Docker.

## Architecture Overview

This project implements a full-stack MCP architecture with four interconnected services:

- **PostgreSQL Database** - Data persistence layer
- **MCP Database Server** - Protocol server with database tools  
- **LLM Container** - Ollama-based language model service
- **User Agent** - Web interface and orchestration layer

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Agent    │───>│   MCP Server    │───>│  PostgreSQL DB  │    │  LLM Container  │
│   (Port 3002)   │    │   (Port 3001)   │    │   (Port 5432)   │    │  (Port 11434)   │
│                 │    │                 │    │                 │    │                 │
│ • Web UI        │    │ • Database Tools│    │ • Data Storage  │    │ • Ollama API    │
│ • MCP Client    │<───│ • HTTP/MCP API  │    │ • Sample Data   │    │ • Multiple LLMs │
│ • LLM Interface │    │ • Health Checks │    │ • Persistence   │    │ • SQL Generation│
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Project Structure

```
MCP Project/
├── user-agent/                # User Agent Service
│   ├── src/
│   │   └── index.ts           # Express server with MCP client
│   ├── public/                # Web UI assets
│   │   ├── index.html         # Main interface
│   │   ├── app.js             # Frontend JavaScript
│   │   └── styles.css         # Styling
│   ├── package.json           # Dependencies
│   ├── Dockerfile             # Container definition
│   └── user-agent.sh          # Management script
├── llm-container/             # LLM Service
│   ├── Dockerfile             # Ollama container setup
│   ├── init-models.sh         # Model initialization
│   └── llm.sh                 # Management script
├── mcp-db-server/             # MCP Database Server
│   ├── http.ts                # HTTP server implementation
│   ├── stdio.ts               # STDIO server implementation
│   ├── package.json           # Node.js dependencies
│   ├── tsconfig.json          # TypeScript configuration
│   ├── Dockerfile             # Production Docker image
│   ├── Dockerfile.dev         # Development Docker image
│   ├── docker-compose.mcp.yml # Production MCP container
│   ├── docker-compose.mcp.dev.yml # Development MCP container
│   └── mcp-server.sh          # MCP server management script
├── postgres-db/               # PostgreSQL Database
│   ├── init.sql               # Database initialization script
│   ├── docker-compose.yml     # Production PostgreSQL container
│   ├── docker-compose.dev.yml # Development PostgreSQL container
│   └── postgres.sh            # PostgreSQL management script
├── docker-compose.yml         # Main orchestration file
├── start-containers.sh        # Start all containers
├── stop-containers.sh         # Stop all containers
├── test-docker.sh             # Test script for the entire setup
└── README.md                  # This file
```

## Features

### Core Components
- **Database Operations**: Execute raw SQL queries, insert records, and retrieve data
- **LLM Integration**: Natural language to SQL conversion using Ollama
- **Web Interface**: User-friendly chat interface for database interactions
- **HTTP Transport**: RESTful API endpoints for MCP communication
- **PostgreSQL Integration**: Full PostgreSQL database support with sample data
- **Health Checks**: Built-in health monitoring across all services

### Advanced Features
- **Multi-Model Support**: Choose from llama2, codellama, mistral models
- **Real-time Communication**: WebSocket-like interactions via HTTP streaming
- **Container Orchestration**: Complete Docker Compose setup
- **Individual Service Management**: Dedicated scripts for each container
- **Development & Production Modes**: Separate configurations for different environments

## Quick Start with Docker

### Prerequisites

- Docker (20.10+)
- Docker Compose (2.0+)
- At least 8GB RAM (recommended for LLM models)
- 10GB disk space (for models and data)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd mcp-multi-container
```

### 2. Clean Up (First Time Only)

If you have any existing MCP containers, clean them up first:

```bash
./cleanup-containers.sh
```

### 3. Start All Services

Use the convenient startup script to launch the entire stack:

```bash
./start-containers.sh
```

This will start all containers together using Docker Compose with proper dependency handling.

### 4. Access the Application

Once all containers are running:

- **Web Interface**: http://localhost:3002
- **MCP Server Health**: http://localhost:3001/health
- **Ollama API**: http://localhost:11434
- **PostgreSQL**: localhost:5432

### 5. Using the Web Interface

1. Open http://localhost:3002 in your browser
2. Use natural language to query your database:
   - "Show me all employees"
   - "Which projects are currently active?"
   - "Who is working on project Alpha?"
3. The system will convert your requests to SQL and execute them

### 6. Stop All Services

```bash
./stop-containers.sh
```

## Individual Container Management

Each service can be managed independently using dedicated scripts:

### PostgreSQL Database
```bash
cd postgres-db
./postgres.sh start            # Start database
./postgres.sh stop             # Stop database
./postgres.sh logs             # View logs
./postgres.sh status           # Check status
./postgres.sh help             # Show all commands
```

### MCP Database Server
```bash
cd mcp-db-server
./mcp-server.sh start          # Start MCP server
./mcp-server.sh stop           # Stop MCP server
./mcp-server.sh logs           # View logs
./mcp-server.sh status         # Check status
./mcp-server.sh help           # Show all commands
```

### LLM Container
```bash
cd llm-container
./llm.sh start                 # Start Ollama
./llm.sh stop                  # Stop Ollama
./llm.sh logs                  # View logs
./llm.sh models                # List available models
./llm.sh status                # Check status
./llm.sh help                  # Show all commands
```

### User Agent
```bash
cd user-agent
./user-agent.sh start          # Start web interface
./user-agent.sh stop           # Stop web interface
./user-agent.sh logs           # View logs
./user-agent.sh status         # Check status
./user-agent.sh help           # Show all commands
```

## Configuration

### Environment Variables

The system uses several environment variables for configuration:

| Service       | Variable             | Default                         | Description          |
|---------------|----------------------|---------------------------------|----------------------|
| PostgreSQL    | `POSTGRES_DB`        | `mcp_database`                  | Database name        |
| PostgreSQL    | `POSTGRES_USER`      | `postgres`                      | Database user        |
| PostgreSQL    | `POSTGRES_PASSWORD`  | `your_password`                 | Database password    |
| MCP Server    | `PG_HOST`            | `postgres-db`                   | PostgreSQL host      |
| MCP Server    | `PG_PORT`            | `5432`                          | PostgreSQL port      |
| MCP Server    | `PORT`               | `3000`                          | Application port     |
| User Agent    | `MCP_SERVER_URL`     | `http://mcp-db-server:3000/mcp` | MCP endpoint         |
| User Agent    | `LLM_API_URL`        | `http://llm-container:11434`    | Ollama API           |
| User Agent    | `PORT`               | `3002`                          | Web interface port   |
| LLM Container | `OLLAMA_HOST`        | `0.0.0.0`                       | Ollama bind address  |

### Custom Configuration

1. Copy example environment files:
```bash
# PostgreSQL configuration
cd postgres-db && cp env.example .env

# MCP Server configuration  
cd ../mcp-db-server && cp env.example .env
```

2. Edit the `.env` files with your preferred settings
3. Restart the containers to apply changes

## API Endpoints

### User Agent (Port 3002)
- `GET /` - Web interface
- `POST /query` - Natural language database queries
- `GET /health` - Health check

### MCP Server (Port 3001)
- `GET /health` - Health check
- `POST /mcp` - MCP protocol requests
- `GET /mcp` - Server-Sent Events (SSE)
- `DELETE /mcp` - Terminate session

### LLM Container (Port 11434)
- `GET /api/tags` - List available models
- `POST /api/generate` - Generate completions
- `POST /api/chat` - Chat completions

## Available Tools

The MCP server provides these database tools:

1. **queryDatabase** - Execute raw SQL queries
2. **insertRecord** - Insert records into tables  
3. **getRecords** - Retrieve records from tables

## Sample Database Schema

The system includes pre-loaded sample data:

- **employees** - Employee information (id, name, email, department, hire_date)
- **projects** - Project details (id, name, description, status, start_date, end_date)
- **employee_projects** - Employee-project relationships (employee_id, project_id, role)

## Development

### Local Development Setup

1. **Start PostgreSQL**:
```bash
cd postgres-db && ./postgres.sh start-dev
```

2. **Start MCP Server in development mode**:
```bash
cd mcp-db-server && ./mcp-server.sh start-dev
```

3. **Start LLM Container**:
```bash
cd llm-container && ./llm.sh start
```

4. **Start User Agent in development mode**:
```bash
cd user-agent
npm install
npm run dev
```

### Testing the Setup

Use the provided test script to validate the entire stack:

```bash
./test-docker.sh
```

This script tests:
- Container health and connectivity
- Database operations
- MCP protocol communication
- LLM model availability

## Troubleshooting

### Common Issues

1. **Containers fail to start**
   - Check Docker memory allocation (increase to 8GB+)
   - Verify ports 3001, 3002, 5432, 11434 are available
   - Run `docker system prune` to clean up resources

2. **LLM models not working**
   - Models download automatically on first startup
   - Check available models: `cd llm-container && ./llm.sh models`
   - Increase timeout if models are still downloading

3. **User Agent can't connect to services**
   - Verify all containers are running: `docker ps`
   - Check container logs for errors
   - Ensure containers are on the same network

4. **Database connection issues**
   - Verify PostgreSQL is fully started before MCP server
   - Check database credentials in environment files
   - Allow extra time for PostgreSQL initialization

### Viewing Logs

Each service provides detailed logging:

```bash
# View all container logs
docker-compose logs -f

# View specific service logs
./start-containers.sh  # Shows helpful log commands
```

### Resource Requirements

- **Minimum**: 4GB RAM, 5GB disk space
- **Recommended**: 8GB RAM, 10GB disk space
- **For multiple models**: 16GB RAM, 20GB disk space

## Production Deployment

### Security Recommendations

1. **Change default passwords** in all `.env` files
2. **Enable SSL/TLS** for database connections
3. **Use Docker secrets** for sensitive data
4. **Configure firewall rules** to restrict access
5. **Set up proper logging** and monitoring
6. **Regular backup** of PostgreSQL data

### Production Checklist

- [ ] Update all default passwords
- [ ] Configure SSL certificates
- [ ] Set up log aggregation
- [ ] Configure container restart policies
- [ ] Set up monitoring and alerts
- [ ] Plan backup and recovery strategy
- [ ] Review and limit container permissions

## License

ISC
