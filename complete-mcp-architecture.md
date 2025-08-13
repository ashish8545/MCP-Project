# Complete MCP Architecture with User Agent & LLM

## System Overview

This architecture creates a complete MCP ecosystem with:
1. **User Agent** - Hosts MCP client and provides user interface
2. **LLM Container** - Runs Ollama or similar LLM service
3. **MCP Database Server** - Your existing server with database tools
4. **PostgreSQL Database** - Your existing database

## Architecture Components

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                USER INTERFACE LAYER                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐          │
│  │                    User Agent                                 │          │
│  │                    (MCP Client + UI)                         │          │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │          │
│  │  │   Web UI        │  │   MCP Client    │  │   Session Mgmt  │ │          │
│  │  │   (React/Vue)   │  │   (MCP SDK)     │  │                 │ │          │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │          │
│  └─────────────────────────────────────────────────────────────────┘          │
│           │                                                                    │
│           │ MCP Protocol Communication                                         │
│           ▼                                                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              LLM LAYER                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐          │
│  │                    LLM Container                              │          │
│  │                    (Ollama/OpenAI)                           │          │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │          │
│  │  │   Model API     │  │   Inference     │  │   Model Mgmt    │ │          │
│  │  │   (HTTP/REST)   │  │   Engine        │  │                 │ │          │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │          │
│  └─────────────────────────────────────────────────────────────────┘          │
│           │                                                                    │
│           │ Tool Calls via MCP Protocol                                        │
│           ▼                                                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              MCP SERVER LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐          │
│  │                    MCP Database Server                        │          │
│  │                    (Your Existing Server)                     │          │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │          │
│  │  │ Tool Registry   │  │ Query Executor  │  │ Result Formatter │ │          │
│  │  │                 │  │                 │  │                 │ │          │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │          │
│  └─────────────────────────────────────────────────────────────────┘          │
│           │                                                                    │
│           │ Execute SQL Query                                                  │
│           ▼                                                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              DATABASE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐          │
│  │                    PostgreSQL Database                        │          │
│  │                    (Containerized)                           │          │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │          │
│  │  │   Employees     │  │    Projects     │  │ Employee_Projects│ │          │
│  │  │     Table       │  │     Table       │  │     Table       │ │          │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │          │
│  └─────────────────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. User Input
```
User types: "Show me all employees in Engineering department"
```

### 2. User Agent Processing
```javascript
// User Agent receives input and sends to LLM
{
  "role": "user",
  "content": "Show me all employees in Engineering department"
}
```

### 3. LLM Processing with MCP Tools
```javascript
// LLM receives user query and available tools
{
  "role": "assistant",
  "content": "I'll help you find employees in the Engineering department.",
  "tool_calls": [
    {
      "id": "call_123",
      "type": "function",
      "function": {
        "name": "queryDatabase",
        "arguments": {
          "query": "SELECT * FROM employees WHERE department = 'Engineering'"
        }
      }
    }
  ]
}
```

### 4. MCP Client Tool Execution
```javascript
// MCP Client executes tool call against MCP Server
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "queryDatabase",
    "arguments": {
      "query": "SELECT * FROM employees WHERE department = 'Engineering'"
    }
  },
  "id": 1
}
```

### 5. MCP Server Response
```javascript
// MCP Server returns results
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": JSON.stringify({
        "success": true,
        "data": [
          {
            "id": 1,
            "name": "John Doe",
            "email": "john.doe@company.com",
            "department": "Engineering",
            "salary": 75000.00
          },
          {
            "id": 4,
            "name": "Alice Brown",
            "email": "alice.brown@company.com",
            "department": "Engineering",
            "salary": 80000.00
          }
        ]
      })
    }]
  },
  "id": 1
}
```

### 6. LLM Response with Results
```javascript
// LLM formats results for user
{
  "role": "assistant",
  "content": "I found 2 employees in the Engineering department:\n\n1. John Doe - $75,000\n2. Alice Brown - $80,000\n\nWould you like to see more details about these employees or explore other departments?"
}
```

## Container Architecture

### 1. User Agent Container
```dockerfile
# user-agent/Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

**Features:**
- Web UI (React/Vue.js)
- MCP Client integration
- Session management
- Real-time chat interface

### 2. LLM Container (Ollama)
```dockerfile
# llm-container/Dockerfile
FROM ollama/ollama:latest

# Install additional models
RUN ollama pull llama2
RUN ollama pull codellama

EXPOSE 11434
CMD ["ollama", "serve"]
```

**Features:**
- Ollama server with multiple models
- HTTP API for model inference
- Model management
- Tool calling capabilities

### 3. MCP Database Server (Existing)
Your existing container with enhanced tool definitions.

### 4. PostgreSQL Database (Existing)
Your existing database container.

## Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  # User Agent with MCP Client
  user-agent:
    build: ./user-agent
    ports:
      - "3000:3000"
    environment:
      - MCP_SERVER_URL=http://mcp-db-server:3000
      - LLM_API_URL=http://llm-container:11434
    depends_on:
      - mcp-db-server
      - llm-container
    networks:
      - mcp-network

  # LLM Container (Ollama)
  llm-container:
    build: ./llm-container
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0
    networks:
      - mcp-network

  # MCP Database Server (Your existing)
  mcp-db-server:
    build: ./mcp-db-server
    ports:
      - "3001:3000"
    environment:
      - PG_HOST=postgres-db
      - PG_USER=postgres
      - PG_DATABASE=mcp_database
      - PG_PASSWORD=your_password
    depends_on:
      - postgres-db
    networks:
      - mcp-network

  # PostgreSQL Database (Your existing)
  postgres-db:
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=mcp_database
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres-db/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - mcp-network

volumes:
  postgres_data:
  ollama_data:

networks:
  mcp-network:
    driver: bridge
```

## Implementation Plan

### Phase 1: User Agent Setup
1. Create React/Vue.js application
2. Integrate MCP Client SDK
3. Build chat interface
4. Add session management

### Phase 2: LLM Container Setup
1. Set up Ollama container
2. Configure models (llama2, codellama)
3. Test LLM API endpoints
4. Verify tool calling capabilities

### Phase 3: MCP Integration
1. Connect User Agent to LLM
2. Configure LLM to use MCP tools
3. Test end-to-end flow
4. Add error handling

### Phase 4: Enhancement
1. Add authentication
2. Implement conversation history
3. Add result visualization
4. Performance optimization

## Key Benefits

1. **Complete MCP Ecosystem**: All components work together seamlessly
2. **Local LLM**: Ollama runs locally, no external API dependencies
3. **Scalable**: Easy to add more tools and models
4. **Secure**: All communication within Docker network
5. **Flexible**: Easy to switch LLM models or add new capabilities

## Next Steps

Would you like me to start implementing any specific component:
1. **User Agent** with MCP client and web UI
2. **LLM Container** with Ollama setup
3. **Enhanced MCP Server** with better tool definitions
4. **Docker Compose** configuration for all services

Which component would you like to tackle first?
