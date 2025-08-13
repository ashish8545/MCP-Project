import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

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
  res.setHeader('Content-Type', 'text/html');
  res.send(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Database Assistant</title>
    <style>
      * { box-sizing: border-box; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
        margin: 0; 
        padding: 0; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #24292f;
        min-height: 100vh;
      }
      
      .container { 
        max-width: 800px; 
        margin: 0 auto; 
        padding: 2rem; 
        display: flex;
        flex-direction: column;
        gap: 2rem;
        min-height: 100vh;
      }
      
      .header { 
        text-align: center;
        color: white;
        margin-bottom: 2rem;
      }
      .header h1 { 
        margin: 0; 
        font-size: 3rem; 
        font-weight: 700; 
        text-shadow: 0 2px 4px rgba(0,0,0,0.3);
      }
      .header p { 
        margin: 1rem 0 0 0; 
        opacity: 0.9; 
        font-size: 1.2rem;
        font-weight: 300;
      }
      
      .input-panel { 
        background: white; 
        padding: 2rem; 
        border-radius: 16px; 
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        backdrop-filter: blur(10px);
      }
      
      .input-panel h2 { 
        margin: 0 0 1.5rem 0; 
        color: #24292f; 
        font-size: 1.5rem; 
        font-weight: 600;
        text-align: center;
      }
      
      textarea { 
        width: 100%; 
        font-family: inherit;
        border: 2px solid #e1e4e8; 
        border-radius: 12px; 
        padding: 1rem; 
        font-size: 16px;
        transition: all 0.3s ease;
        background: #fafbfc;
        resize: vertical;
        min-height: 120px;
        margin-bottom: 1rem;
      }
      textarea:focus { 
        outline: none; 
        border-color: #667eea; 
        background: white;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      
      .controls { 
        display: flex; 
        gap: 1rem; 
        align-items: center; 
        margin-bottom: 1rem;
        flex-wrap: wrap;
      }
      
      select { 
        padding: 0.75rem 1rem;
        border: 2px solid #e1e4e8;
        border-radius: 8px;
        font-size: 14px;
        background: white;
        color: #24292f;
        cursor: pointer;
        transition: border-color 0.3s ease;
      }
      select:focus { 
        outline: none; 
        border-color: #667eea;
      }
      
      button { 
        padding: 0.75rem 2rem; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
        color: white; 
        border: none; 
        border-radius: 8px; 
        cursor: pointer; 
        font-weight: 600;
        font-size: 16px;
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        flex: 1;
        min-width: 150px;
      }
      button:hover { 
        transform: translateY(-2px); 
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }
      button:disabled { 
        background: #6a737d; 
        cursor: not-allowed; 
        transform: none; 
        box-shadow: none;
      }
      
      .status { 
        padding: 1rem; 
        border-radius: 8px; 
        margin: 1rem 0; 
        font-size: 14px;
        border-left: 4px solid;
        display: none;
      }
      .status.show { display: block; }
      .status.success { 
        background: #dafbe1; 
        color: #116329; 
        border-left-color: #1a7f37;
      }
      .status.error { 
        background: #ffebe9; 
        color: #cf222e; 
        border-left-color: #cf222e;
      }
      .status.info { 
        background: #ddf4ff; 
        color: #0969da; 
        border-left-color: #0969da;
      }
      
      .results-panel { 
        background: white; 
        padding: 2rem; 
        border-radius: 16px; 
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        backdrop-filter: blur(10px);
        display: none;
      }
      .results-panel.show { display: block; }
      
      .results-panel h2 { 
        margin: 0 0 1.5rem 0; 
        color: #24292f; 
        font-size: 1.5rem; 
        font-weight: 600;
        text-align: center;
      }
      
      .result-content { 
        background: #f8f9fa; 
        padding: 1.5rem; 
        border-radius: 12px; 
        border: 1px solid #e1e4e8; 
        font-size: 16px;
        line-height: 1.6;
        color: #24292f;
        white-space: pre-wrap;
        word-break: break-word;
        min-height: 100px;
      }
      
      .loading {
        display: inline-block;
        width: 20px;
        height: 20px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #667eea;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 10px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .fade-in {
        animation: fadeIn 0.5s ease;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @media (max-width: 768px) {
        .container {
          padding: 1rem;
        }
        .header h1 {
          font-size: 2rem;
        }
        .controls {
          flex-direction: column;
        }
        button {
          width: 100%;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🤖 AI Database Assistant</h1>
        <p>Ask questions about your data in plain English</p>
      </div>
      
      <div class="input-panel fade-in">
        <h2>💬 What would you like to know?</h2>
        <textarea 
          id="user-prompt" 
          placeholder="Example: Show me all employees in the Engineering department who earn more than 70000, or tell me how many projects are currently active..."
        ></textarea>
        
        <div class="controls">
          <select id="model-select">
            <option value="llama2">Llama2</option>
            <option value="codellama">CodeLlama</option>
            <option value="mistral">Mistral</option>
          </select>
          <button id="submit-btn" onclick="submitQuery()">🚀 Ask AI</button>
        </div>
        
        <div id="status" class="status"></div>
      </div>
      
      <div id="results-panel" class="results-panel">
        <h2>📊 Answer</h2>
        <div id="result-content" class="result-content">
          Your answer will appear here...
        </div>
      </div>
    </div>

    <script>
      async function submitQuery() {
        const prompt = document.getElementById('user-prompt').value.trim();
        const model = document.getElementById('model-select').value;
        const submitBtn = document.getElementById('submit-btn');
        const statusEl = document.getElementById('status');
        const resultsPanel = document.getElementById('results-panel');
        const resultContent = document.getElementById('result-content');
        
        if (!prompt) {
          showStatus('Please enter a question', 'error');
          return;
        }
        
        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading"></span>Processing...';
        showStatus('🤖 Generating SQL and fetching data...', 'info');
        resultsPanel.classList.remove('show');
        
        try {
          // Step 1: Generate SQL from natural language
          const sqlResponse = await fetch('/api/llm/generate-sql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: prompt, model: model })
          });
          
          const sqlData = await sqlResponse.json();
          
          if (!sqlData.success) {
            throw new Error('Failed to generate SQL: ' + sqlData.error);
          }
          
          showStatus('🔄 Executing query...', 'info');
          
          // Step 2: Execute the generated SQL
          const mcpResponse = await fetch('/api/mcp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: '1',
              method: 'tools/call',
              params: {
                name: 'queryDatabase',
                arguments: { query: sqlData.sql }
              }
            })
          });
          
          const mcpData = await mcpResponse.json();
          
          if (mcpData.error) {
            throw new Error('Database query failed: ' + mcpData.error.message);
          }
          
          showStatus('📝 Generating natural language response...', 'info');
          
          // Step 3: Convert results to natural language
          const nlResponse = await fetch('/api/llm/explain-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query: prompt,
              results: mcpData.result.content,
              model: model
            })
          });
          
          const nlData = await nlResponse.json();
          
          if (!nlData.success) {
            throw new Error('Failed to generate explanation: ' + nlData.error);
          }
          
          // Display results
          resultContent.textContent = nlData.explanation;
          resultsPanel.classList.add('show');
          showStatus('✅ Answer generated successfully!', 'success');
          
        } catch (error) {
          console.error('Error:', error);
          showStatus('❌ Error: ' + error.message, 'error');
          resultContent.textContent = 'Sorry, I encountered an error while processing your request. Please try again.';
          resultsPanel.classList.add('show');
        } finally {
          // Reset button
          submitBtn.disabled = false;
          submitBtn.textContent = '🚀 Ask AI';
        }
      }
      
      function showStatus(message, type) {
        const statusEl = document.getElementById('status');
        statusEl.textContent = message;
        statusEl.className = 'status ' + type + ' show';
      }
      
      // Allow Enter key to submit
      document.getElementById('user-prompt').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
          submitQuery();
        }
      });
    </script>
  </body>
  </html>
  `);
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

VERY IMPORTANT: The user asked: "${query}"
- If they asked for "more than 50k", answer about employees with salary > 50000
- If they asked for "less than 50k", answer about employees with salary < 50000
- If they asked for "above 50k", answer about employees with salary > 50000
- If they asked for "below 50k", answer about employees with salary < 50000

DO NOT mention:
- Database queries, SQL, or technical details
- JSON objects, data structures, or internal workings
- How you processed or retrieved the data
- Technical terms like "success field", "data field", etc.
- Confidentiality or privacy policies

DO:
- Answer the user's question directly and naturally
- Use conversational language
- Focus on what the user actually wants to know
- Be helpful and informative
- If there's no data, explain what that means in simple terms
- Make sure your answer matches the user's original question exactly

Example good response: "There are no employees with a salary below 50K in the company."
Example bad response: "The database query returned a JSON object with an empty array, indicating no employees have salaries below 50K."

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


