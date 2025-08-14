import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import pg from 'pg';
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';


// Create PostgreSQL pool
const { Pool } = pg;
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'mcp_database',
  password: process.env.PG_PASSWORD || 'your_password',
  port: parseInt(process.env.PG_PORT || '5432'),
});

// Create server instance
const server = new McpServer({
    name: "database-server",
    version: "1.0.0",
});

// Tool: Execute raw SQL query
server.registerTool("queryDatabase", {
  description: "Execute a SQL query on the database",
  inputSchema: {
    query: z.string().describe("SQL query to execute"),
    params: z.array(z.any()).optional().describe("Query parameters")
  }
}, async ({ query, params = [] }) => {
  try {
    const result = await pool.query(query, params);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: true, data: result.rows }, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: false, error: errorMessage }, null, 2)
      }]
    };
  }
});

// Tool: Insert record into table
server.registerTool("insertRecord", {
  description: "Insert a record into a table",
  inputSchema: {
    table: z.string().describe("Table name"),
    data: z.record(z.any()).describe("Data to insert")
  }
}, async ({ table, data }) => {
  try {
    const columns = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${table} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: true, data: result.rows[0] }, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: false, error: errorMessage }, null, 2)
      }]
    };
  }
});

// Tool: Get records from table
server.registerTool("getRecords", {
  description: "Get records from a table",
  inputSchema: {
    table: z.string().describe("Table name"),
    where: z.record(z.any()).optional().describe("Where conditions"),
    limit: z.number().optional().describe("Maximum number of records to return")
  }
}, async ({ table, where = {}, limit }) => {
  try {
    let query = `SELECT * FROM ${table}`;
    const values: any[] = [];
    const conditions: string[] = [];

    Object.entries(where).forEach(([key, value], index) => {
      conditions.push(`${key} = $${index + 1}`);
      values.push(value);
    });

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    if (limit) {
      query += ` LIMIT $${values.length + 1}`;
      values.push(limit);
    }

    const result = await pool.query(query, values);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: true, data: result.rows }, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ success: false, error: errorMessage }, null, 2)
      }]
    };
  }
});

// Start the server
async function main() {
    const port = parseInt(process.env.PORT || '3000');
    const app = express();
    
    // Store active transports
    const transports: Record<string, StreamableHTTPServerTransport> = {};
    
    // Middleware
    app.use(express.json());
    
    // MCP POST handler
    const mcpPostHandler = async (req: Request, res: Response) => {
        try {
            const sessionIdHeader = req.headers['mcp-session-id'];
            const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader || randomUUID();
            
            if (!transports[sessionId]) {
                transports[sessionId] = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => sessionId,
                });
                await server.connect(transports[sessionId]);
            }
            
            const transport = transports[sessionId];
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            console.error('Error handling MCP request:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32603,
                        message: 'Internal server error',
                    },
                    id: null,
                });
            }
        }
    };
    
    // MCP GET handler for SSE
    const mcpGetHandler = async (req: Request, res: Response) => {
        const sessionIdHeader = req.headers['mcp-session-id'];
        const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
        
        if (!sessionId || !transports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }
        
        const transport = transports[sessionId];
        await transport.handleRequest(req, res);
    };
    
    // MCP DELETE handler
    const mcpDeleteHandler = async (req: Request, res: Response) => {
        const sessionIdHeader = req.headers['mcp-session-id'];
        const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
        
        if (!sessionId || !transports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }
        
        try {
            const transport = transports[sessionId];
            await transport.handleRequest(req, res);
            delete transports[sessionId];
        } catch (error) {
            console.error('Error handling session termination:', error);
            if (!res.headersSent) {
                res.status(500).send('Error processing session termination');
            }
        }
    };
    
    // Routes
    app.post('/mcp', mcpPostHandler);
    app.get('/mcp', mcpGetHandler);
    app.delete('/mcp', mcpDeleteHandler);

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'ok', message: 'MCP Database Server is running' });
    });
    
    app.listen(port, () => {
        console.error(`MCP Database Server started on http://localhost:${port}`);
        console.error(`Health check: http://localhost:${port}/health`);
    });
    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.json({ status: 'ok', message: 'MCP Database Server is running' });
    });
    
    app.listen(port, () => {
        console.error(`MCP Database Server started on http://localhost:${port}`);
        console.error(`Health check: http://localhost:${port}/health`);
    });
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});