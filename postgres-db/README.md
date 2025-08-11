# PostgreSQL Database

This directory contains the PostgreSQL database configuration and initialization scripts for the MCP Database Server.

## Contents

- **`init.sql`** - Database initialization script with sample data
- **`docker-compose.yml`** - Production PostgreSQL container configuration
- **`docker-compose.dev.yml`** - Development PostgreSQL container configuration

## Database Schema

The initialization script creates the following tables:

### employees
- `id` - Primary key (SERIAL)
- `name` - Employee name (VARCHAR)
- `email` - Unique email address (VARCHAR)
- `department` - Department name (VARCHAR)
- `salary` - Salary amount (DECIMAL)
- `hire_date` - Date hired (DATE)
- `created_at` - Record creation timestamp (TIMESTAMP)

### projects
- `id` - Primary key (SERIAL)
- `name` - Project name (VARCHAR)
- `description` - Project description (TEXT)
- `status` - Project status (VARCHAR)
- `start_date` - Project start date (DATE)
- `end_date` - Project end date (DATE)
- `budget` - Project budget (DECIMAL)
- `created_at` - Record creation timestamp (TIMESTAMP)

### employee_projects
- `employee_id` - Foreign key to employees (INTEGER)
- `project_id` - Foreign key to projects (INTEGER)
- `role` - Employee role in project (VARCHAR)
- `assigned_date` - Assignment date (DATE)

## Quick Start

### Database Management

```bash
# Production mode
./postgres.sh start          # Start database
./postgres.sh stop           # Stop database
./postgres.sh restart        # Restart database
./postgres.sh logs           # View logs
./postgres.sh status         # Show status

# Development mode
./postgres.sh start-dev      # Start development database
./postgres.sh stop-dev       # Stop development database
./postgres.sh logs-dev       # View development logs

# Help
./postgres.sh help           # Show all available commands
```

### Manual Docker Commands

```bash
# Production
docker-compose up -d

# Development
docker-compose -f docker-compose.dev.yml up -d
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PG_DATABASE` | `mcp_database` | Database name |
| `PG_USER` | `postgres` | Database user |
| `PG_PASSWORD` | `your_password` | Database password |

## Connection Details

- **Host**: `localhost` (or container name `mcp-postgres` from other containers)
- **Port**: `5432`
- **Database**: `mcp_database`
- **Username**: `postgres`
- **Password**: `your_password` (configurable via environment)

## Sample Data

The initialization script automatically creates sample data including:
- 5 employees across different departments
- 3 projects in various states
- Employee-project assignments with roles

## Data Persistence

PostgreSQL data is persisted using Docker volumes:
- **Production**: `postgres_data`
- **Development**: `postgres_data_dev`

## Health Checks

The container includes health checks to ensure PostgreSQL is ready to accept connections before other services attempt to connect.
