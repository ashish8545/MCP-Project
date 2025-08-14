import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
app.use(cors());
app.use(express.json());

// Static assets (public)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir));

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
const LLM_API_URL = process.env.LLM_API_URL || 'http://localhost:11434';

// MCP Service Interface - Easy to swap implementations later
interface MCPService {
  initializeSession(sessionId: string): Promise<any>;
  callTool(toolName: string, toolArguments: any, sessionId?: string): Promise<any>;
  listTools(sessionId?: string): Promise<any>;
}

// Current HTTP-based MCP implementation
class HTTPMCPService implements MCPService {
  async initializeSession(sessionId: string): Promise<any> {
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'mcp-session-id': sessionId
    };

    const initRequest = {
      jsonrpc: '2.0',
      id: '1',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'user-agent', version: '1.0.0' }
      }
    };

    try {
      const response = await axios.post(MCP_SERVER_URL, initRequest, { 
        headers, responseType: 'text'
      });
      
      return this.parseResponse(response.data);
    } catch (error: any) {
      console.error('MCP initialization failed:', error.message);
      throw error;
    }
  }

  async callTool(toolName: string, toolArguments: any, sessionId?: string): Promise<any> {
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };
    
    if (sessionId) {
      headers['mcp-session-id'] = sessionId;
    }

    const request = {
      jsonrpc: '2.0',
      id: '1',
      method: 'tools/call',
      params: { name: toolName, arguments: toolArguments }
    };

    try {
      const response = await axios.post(MCP_SERVER_URL, request, { 
        headers, responseType: 'text'
      });
      
      return this.parseResponse(response.data);
    } catch (error: any) {
      console.error('MCP tool call failed:', error.message);
      throw error;
    }
  }

  async listTools(sessionId?: string): Promise<any> {
    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };
    
    if (sessionId) {
      headers['mcp-session-id'] = sessionId;
    }

    const request = {
      jsonrpc: '2.0',
      id: '1',
      method: 'tools/list'
    };

    try {
      const response = await axios.post(MCP_SERVER_URL, request, { 
        headers, responseType: 'text'
      });
      
      return this.parseResponse(response.data);
    } catch (error: any) {
      console.error('MCP list tools failed:', error.message);
      throw error;
    }
  }

  private parseResponse(data: string): any {
    if (data.includes('data: ')) {
      const lines = data.split('\n');
      const jsonLines = lines
        .filter((line: string) => line.startsWith('data: '))
        .map((line: string) => line.substring(6))
        .filter((data: string) => data.trim() !== '');
      
      if (jsonLines.length > 0) {
        return JSON.parse(jsonLines[jsonLines.length - 1]);
      }
    } else {
      return JSON.parse(data);
    }
  }
}

// MCP Service Factory - Easy to swap implementations
class MCPServiceFactory {
  private static instance: MCPService;

  static getService(): MCPService {
    if (!this.instance) {
      // TODO: Later, this can be easily changed to use MCP Client
      // this.instance = new MCPClientService();
      this.instance = new HTTPMCPService();
    }
    return this.instance;
  }

  static setService(service: MCPService) {
    this.instance = service;
  }
}

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'user-agent' });
});

// Simplified Natural Language UI
app.get('/', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Proxy endpoint to MCP server
app.post('/api/mcp', async (req: Request, res: Response) => {
  try {
    const mcpService = MCPServiceFactory.getService();
    
    let sessionId = req.header('mcp-session-id');
    if (!sessionId) {
      // Generate a new session ID if none provided
      sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Initialize session if this is the first request
    if (req.body.method === 'tools/call') {
      try {
        await mcpService.initializeSession(sessionId);
      } catch (initError) {
        console.error('Session initialization failed:', initError);
        // Continue anyway, the server might already be initialized
      }
    }

    // Handle different MCP methods
    let result;
    switch (req.body.method) {
      case 'tools/call':
        result = await mcpService.callTool(
          req.body.params.name, 
          req.body.params.arguments, 
          sessionId
        );
        break;
      case 'tools/list':
        result = await mcpService.listTools(sessionId);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported MCP method' });
    }

    res.json(result);
  } catch (error: any) {
    console.error('MCP request failed:', error);
    res.status(500).json({ 
      error: 'MCP request failed', 
      detail: error.message 
    });
  }
});

// List available MCP tools
app.get('/api/mcp/tools', async (req: Request, res: Response) => {
  try {
    const mcpService = MCPServiceFactory.getService();
    const sessionId = req.header('mcp-session-id') || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize session first
    await mcpService.initializeSession(sessionId);
    
    // Get available tools
    const tools = await mcpService.listTools(sessionId);
    
    res.json({ success: true, tools, sessionId });
  } catch (error: any) {
    console.error('Failed to list tools:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to list tools', 
      detail: error.message 
    });
  }
});

// LLM integration endpoint
app.post('/api/llm/generate-sql', async (req: Request, res: Response) => {
  try {
    const { query, model = 'llama2' } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    // Create a prompt for SQL generation
    const prompt = `You are a SQL expert. Convert the following natural language query to SQL.

Database schema:
- employees table: id, name, email, department, salary, hire_date, created_at
- projects table: id, name, description, status, start_date, end_date, budget, created_at
- employee_projects table: employee_id, project_id, role, assigned_date

CRITICAL: Pay careful attention to the user's intent:
- "more than X" or "above X" means salary > X
- "less than X" or "below X" means salary < X
- "at least X" means salary >= X
- "up to X" means salary <= X

Natural language query: "${query}"

Generate only the SQL query without any explanation or markdown formatting. Return only the SQL statement:`;

    // Call Ollama API
    const ollamaResponse = await axios.post(`${LLM_API_URL}/api/generate`, {
      model: model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        max_tokens: 500
      }
    });

    if (ollamaResponse.data && ollamaResponse.data.response) {
      let sql = ollamaResponse.data.response.trim();
      
      // Clean up the response - remove markdown code blocks if present
      sql = sql.replace(/```sql\s*/gi, '').replace(/```\s*$/gi, '');
      
      // Basic validation - ensure it starts with SELECT, INSERT, UPDATE, DELETE
      if (!/^(SELECT|INSERT|UPDATE|DELETE|WITH)/i.test(sql)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Generated response does not appear to be valid SQL',
          rawResponse: sql
        });
      }

      return res.json({ success: true, sql: sql });
    } else {
      return res.status(500).json({ success: false, error: 'Invalid response from LLM' });
    }
  } catch (error: any) {
    console.error('LLM API error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({ 
        success: false, 
        error: `LLM API error: ${error.response.data?.error || error.message}` 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: `Failed to connect to LLM: ${error.message}` 
      });
    }
  }
});

// LLM endpoint to explain results in natural language
app.post('/api/llm/explain-results', async (req: Request, res: Response) => {
  try {
    const { query, results, model = 'llama2' } = req.body;
    
    if (!query || !results) {
      return res.status(400).json({ success: false, error: 'Query and results are required' });
    }

    // Parse the results to get the actual data
    let data;
    try {
      // Handle different possible result formats
      if (typeof results === 'string') {
        data = JSON.parse(results);
      } else {
        data = results;
      }
      
      // If data is already parsed and has a content property, extract it
      if (data && data.content) {
        try {
          data = JSON.parse(data.content);
        } catch (e) {
          // If content is not JSON, use it as is
          data = data.content;
        }
      }
      
      // If data is still a string, try to parse it again
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          // If it's not JSON, use the string as is
          data = { result: data };
        }
      }
      
    } catch (e: any) {
      console.error('Results parsing error:', e);
      console.error('Raw results:', results);
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid results format',
        debug: { rawResults: results, parseError: e.message }
      });
    }

    // Create a prompt for natural language explanation
    const prompt = `You are a helpful AI assistant. The user asked: "${query}"

Here are the results from the database query:
${JSON.stringify(data, null, 2)}

CRITICAL: First, carefully understand what the user is asking for. Pay attention to:
- Salary comparisons: "more than", "less than", "above", "below", "at least", "up to"
- Department filters: "in Engineering", "from Marketing", etc.
- Count vs. details: "how many" vs. "show me all"
- Time-based queries: "currently active", "recent hires", etc.

DO NOT mention:
- Database queries, SQL, or technical details
- JSON objects, data structures, or internal workings
- How you processed or retrieved the data
- Technical terms like "success field", "data field", etc.
- Confidentiality or privacy policies

DO:
- Answer the user's question directly and naturally
- Break lines for readability and use bullet points if needed
- Use conversational language
- Focus on what the user actually wants to know
- Be helpful and informative
- If there's no data, explain what that means in simple terms
- Make sure your answer matches the user's original question exactly

Provide a natural, conversational answer:`;

    // Call Ollama API
    const ollamaResponse = await axios.post(`${LLM_API_URL}/api/generate`, {
      model: model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1000
      }
    });

    if (ollamaResponse.data && ollamaResponse.data.response) {
      const explanation = ollamaResponse.data.response.trim();
      return res.json({ success: true, explanation: explanation });
    } else {
      return res.status(500).json({ success: false, error: 'Invalid response from LLM' });
    }
  } catch (error: any) {
    console.error('LLM explanation API error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({ 
        success: false, 
        error: `LLM API error: ${error.response.data?.error || error.message}` 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: `Failed to connect to LLM: ${error.message}` 
      });
    }
  }
});

const port = parseInt(process.env.PORT || '3002', 10);
app.listen(port, () => {
  console.log(`User Agent started on http://localhost:${port}`);
  console.log(`Proxying MCP to ${MCP_SERVER_URL}`);
});


