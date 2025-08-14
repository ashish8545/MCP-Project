import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import pg from 'pg';
import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import axios from 'axios';

// Create PostgreSQL pool
const { Pool } = pg;
const pool = new Pool({
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'mcp_database',
  password: process.env.PG_PASSWORD || 'your_password',
  port: parseInt(process.env.PG_PORT || '5432'),
});

const LLM_API_URL = process.env.LLM_API_URL || 'http://localhost:11434';

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

    // Alias for API path used by UI
    app.post('/api/mcp', mcpPostHandler);

    // Chat-style UI
    app.get('/', (_req: Request, res: Response) => {
        res.setHeader('Content-Type', 'text/html');
        res.send(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ember Data Companion</title>
    <style>
      * { box-sizing: border-box; }
      :root {
        --bg1: #ffecd2;
        --bg2: #fcb69f;
        --ink: #2b2b2b;
        --muted: #6b7280;
        --user: #ffd6a5;
        --assistant: #ffe6ee;
        --accent1: #ff7f50;
        --accent2: #ff9770;
        --ring: rgba(255, 151, 112, 0.35);
      }
      body {
        margin: 0;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
        color: var(--ink);
        background: linear-gradient(135deg, var(--bg1) 0%, var(--bg2) 100%);
        min-height: 100vh;
      }
      .app { min-height: 100vh; display: flex; align-items: stretch; justify-content: center; padding: 24px; }
      .card {
        width: 100%; max-width: 960px; background: rgba(255, 255, 255, 0.85);
        backdrop-filter: blur(10px); border-radius: 20px; box-shadow: 0 20px 60px rgba(255, 151, 112, 0.25);
        display: flex; flex-direction: column; overflow: hidden;
      }
      .header { padding: 20px 24px; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: space-between; background: linear-gradient(180deg, rgba(255,255,255,0.65), rgba(255,255,255,0)); }
      .title { font-size: 22px; font-weight: 800; letter-spacing: 0.3px; background: linear-gradient(90deg, #ff7f50, #ff9770, #ffaf87); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .subtitle { color: var(--muted); font-size: 13px; }
      .messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column-reverse; gap: 14px; background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.35)); }
      .bubble { max-width: 80%; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(0,0,0,0.05); line-height: 1.5; font-size: 15px; box-shadow: 0 8px 26px rgba(0,0,0,0.05); animation: fadeIn 0.35s ease; transition: transform 0.2s ease; white-space: pre-wrap; word-break: break-word; }
      .bubble.user { align-self: flex-end; background: var(--user); }
      .bubble.assistant { align-self: flex-start; background: var(--assistant); }
      .composer { border-top: 1px solid rgba(0,0,0,0.06); padding: 12px; background: rgba(255, 255, 255, 0.9); }
      .row { display: grid; grid-template-columns: 1fr 160px 56px; gap: 10px; align-items: center; }
      textarea { width: 100%; border: 2px solid rgba(0,0,0,0.07); border-radius: 12px; padding: 12px 12px 12px 14px; font-size: 15px; background: #fff7f2; transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease; resize: none; height: 52px; }
      textarea:focus { outline: none; border-color: var(--accent2); box-shadow: 0 0 0 4px var(--ring); background: #fff; }
      select { border: 2px solid rgba(0,0,0,0.07); border-radius: 12px; padding: 10px 12px; font-size: 14px; background: #fff; transition: border-color 0.25s ease, box-shadow 0.25s ease; }
      select:focus { outline: none; border-color: var(--accent2); box-shadow: 0 0 0 3px var(--ring); }
      button { height: 52px; border: none; border-radius: 12px; background: linear-gradient(135deg, var(--accent1), var(--accent2)); color: white; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease; box-shadow: 0 10px 24px rgba(255, 127, 80, 0.35); }
      button:hover { transform: translateY(-1px); box-shadow: 0 14px 34px rgba(255, 127, 80, 0.45); }
      button:active { transform: translateY(0); }
      button:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
      .send-icon { width: 22px; height: 22px; }
      .toast { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); background: rgba(0, 0, 0, 0.68); color: #fff; padding: 10px 14px; border-radius: 999px; font-size: 13px; opacity: 0; pointer-events: none; transition: opacity 0.3s ease, transform 0.3s ease; }
      .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @media (max-width: 768px) { .row { grid-template-columns: 1fr 120px 48px; } button { height: 48px; } textarea { height: 48px; } }
    </style>
  </head>
  <body>
    <div class="app">
      <div class="card">
        <div class="header">
          <div>
            <div class="title">Ember Data Companion</div>
            <div class="subtitle">Ask anything about your data in everyday language</div>
          </div>
          <div id="toast" class="toast">Thinking…</div>
        </div>
        <div id="messages" class="messages"></div>
        <div class="composer">
          <div class="row">
            <textarea id="user-prompt" placeholder="Ask about your employees, projects, budgets…"></textarea>
            <select id="model-select">
              <option value="llama2">Llama2</option>
              <option value="codellama">CodeLlama</option>
              <option value="mistral">Mistral</option>
            </select>
            <button id="submit-btn" onclick="submitQuery()" aria-label="Send">
              <svg class="send-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.4 20.6L21 12 3.4 3.4l3.2 7.8 7.2.8-7.2.8-3.2 7.8z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <script>
      const messagesEl = document.getElementById('messages');
      const toast = document.getElementById('toast');
      const submitBtn = document.getElementById('submit-btn');
      const promptEl = document.getElementById('user-prompt');

      function showToast(text) {
        toast.textContent = text;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 1800);
      }

      function addMessage(html, role) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble ' + role;
        bubble.innerText = html;
        messagesEl.prepend(bubble);
        return bubble;
      }

      function setLoading(isLoading) { submitBtn.disabled = isLoading; }

      async function submitQuery() {
        const prompt = promptEl.value.trim();
        const model = document.getElementById('model-select').value;
        if (!prompt) { showToast('Please enter a message'); return; }
        addMessage(prompt, 'user');
        promptEl.value = '';
        const thinking = addMessage('Thinking…', 'assistant');
        setLoading(true);
        showToast('Working on it…');
        try {
          const sqlResponse = await fetch('/api/llm/generate-sql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: prompt, model }) });
          const sqlData = await sqlResponse.json();
          if (!sqlData.success) throw new Error(sqlData.error || 'Could not understand your request');
          showToast('Getting the latest details…');
          const mcpResponse = await fetch('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'tools/call', params: { name: 'queryDatabase', arguments: { query: sqlData.sql } } }) });
          const mcpData = await mcpResponse.json();
          if (mcpData.error) throw new Error(mcpData.error.message || 'Something went wrong fetching data');
          showToast('Wrapping it up…');
          const nlResponse = await fetch('/api/llm/explain-results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: prompt, results: mcpData.result ? mcpData.result.content : mcpData.content, model }) });
          const nlData = await nlResponse.json();
          if (!nlData.success) throw new Error(nlData.error || 'Could not summarise the results');
          thinking.innerText = nlData.explanation;
        } catch (err) {
          console.error(err);
          thinking.innerText = 'Sorry, I hit a snag while putting that together. Please try again.';
          showToast('Something went wrong');
        } finally {
          setLoading(false);
        }
      }
      promptEl.addEventListener('keydown', function(e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitQuery(); } });
    </script>
  </body>
</html>
        `);
    });

    // LLM: Generate SQL
    app.post('/api/llm/generate-sql', async (req: Request, res: Response) => {
        try {
            const { query, model = 'llama2' } = req.body || {};
            if (!query) { res.status(400).json({ success: false, error: 'Query is required' }); return; }
            const prompt = 'You are a SQL expert. Convert the following natural language query to SQL.\n\n' +
              'Database schema:\n' +
              '- employees table: id, name, email, department, salary, hire_date, created_at\n' +
              '- projects table: id, name, description, status, start_date, end_date, budget, created_at\n' +
              '- employee_projects table: employee_id, project_id, role, assigned_date\n\n' +
              'CRITICAL: Pay careful attention to the user\'s intent:\n' +
              '- "more than X" or "above X" means salary > X\n' +
              '- "less than X" or "below X" means salary < X\n' +
              '- "at least X" means salary >= X\n' +
              '- "up to X" means salary <= X\n\n' +
              'Natural language query: "' + String(query).replace(/\"/g, '\\"') + '"\n\n' +
              'Generate only the SQL query without any explanation or markdown formatting. Return only the SQL statement:';
            const ollamaResponse = await axios.post(LLM_API_URL + '/api/generate', { model, prompt, stream: false, options: { temperature: 0.1, top_p: 0.9, max_tokens: 500 } });
            const body = ollamaResponse.data;
            if (body && body.response) {
                let sql = String(body.response).trim();
                sql = sql.replace(/```sql\s*/gi, '').replace(/```\s*$/gi, '');
                if (!/^(SELECT|INSERT|UPDATE|DELETE|WITH)/i.test(sql)) { res.status(400).json({ success: false, error: 'Generated response does not appear to be valid SQL', rawResponse: sql }); return; }
                res.json({ success: true, sql }); return;
            }
            res.status(500).json({ success: false, error: 'Invalid response from LLM' });
        } catch (error) {
            const anyErr: any = error;
            console.error('LLM API error:', anyErr?.message);
            if (anyErr?.response) { res.status(anyErr.response.status).json({ success: false, error: 'LLM API error: ' + (anyErr.response.data?.error || anyErr.message) }); return; }
            res.status(500).json({ success: false, error: 'Failed to connect to LLM: ' + (anyErr?.message || 'Unknown error') });
        }
    });

    // LLM: Explain results
    app.post('/api/llm/explain-results', async (req: Request, res: Response) => {
        try {
            const { query, results, model = 'llama2' } = req.body || {};
            if (!query || !results) { res.status(400).json({ success: false, error: 'Query and results are required' }); return; }
            let data: any;
            try {
                if (typeof results === 'string') { data = JSON.parse(results); } else { data = results; }
                if (data && (data as any).content) { try { data = JSON.parse((data as any).content); } catch (_) { data = (data as any).content; } }
                if (typeof data === 'string') { try { data = JSON.parse(data); } catch (_) { data = { result: data }; } }
            } catch (e: any) {
                console.error('Results parsing error:', e);
                res.status(400).json({ success: false, error: 'Invalid results format', debug: { rawResults: results, parseError: e.message } });
                return;
            }
            const prompt = 'You are a helpful AI assistant. The user asked: "' + String(query).replace(/\"/g, '\\"') + '"\n\n' +
              'Here are the results from the database query:\n' + JSON.stringify(data, null, 2) + '\n\n' +
              'CRITICAL: First, carefully understand what the user is asking for. Pay attention to:\n' +
              '- Salary comparisons: "more than", "less than", "above", "below", "at least", "up to"\n' +
              '- Department filters: "in Engineering", "from Marketing", etc.\n' +
              '- Count vs. details: "how many" vs. "show me all"\n' +
              '- Time-based queries: "currently active", "recent hires", etc.\n\n' +
              'VERY IMPORTANT: The user asked: "' + String(query).replace(/\"/g, '\\"') + '"\n' +
              '- If they asked for "more than 50k", answer about employees with salary > 50000\n' +
              '- If they asked for "less than 50k", answer about employees with salary < 50000\n' +
              '- If they asked for "above 50k", answer about employees with salary > 50000\n' +
              '- If they asked for "below 50k", answer about employees with salary < 50000\n\n' +
              'DO NOT mention:\n' +
              '- Database queries, SQL, or technical details\n' +
              '- JSON objects, data structures, or internal workings\n' +
              '- How you processed or retrieved the data\n' +
              '- Technical terms like "success field", "data field", etc.\n' +
              '- Confidentiality or privacy policies\n\n' +
              'DO:\n' +
              '- Answer the user\'s question directly and naturally\n' +
              '- Use conversational language\n' +
              '- Focus on what the user actually wants to know\n' +
              '- Be helpful and informative\n' +
              '- If there\'s no data, explain what that means in simple terms\n' +
              '- Make sure your answer matches the user\'s original question exactly\n\n' +
              'Provide a natural, conversational answer:';
            const ollamaResponse = await axios.post(LLM_API_URL + '/api/generate', { model, prompt, stream: false, options: { temperature: 0.7, top_p: 0.9, max_tokens: 1000 } });
            const body = ollamaResponse.data;
            if (body && body.response) { const explanation = String(body.response).trim(); res.json({ success: true, explanation }); return; }
            res.status(500).json({ success: false, error: 'Invalid response from LLM' });
        } catch (error) {
            const anyErr: any = error;
            console.error('LLM explanation API error:', anyErr?.message);
            if (anyErr?.response) { res.status(anyErr.response.status).json({ success: false, error: 'LLM API error: ' + (anyErr.response.data?.error || anyErr.message) }); return; }
            res.status(500).json({ success: false, error: 'Failed to connect to LLM: ' + (anyErr?.message || 'Unknown error') });
        }
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