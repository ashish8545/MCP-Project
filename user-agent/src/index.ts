import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
app.use(cors());
app.use(express.json());

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
const LLM_API_URL = process.env.LLM_API_URL || 'http://localhost:11434';

// MCP Service Interface
interface MCPService {
	initializeSession(sessionId: string): Promise<any>;
	callTool(toolName: string, toolArguments: any, sessionId?: string): Promise<any>;
	listTools(sessionId?: string): Promise<any>;
}

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

		const response = await axios.post(MCP_SERVER_URL, initRequest, { headers, responseType: 'text' });
		return this.parseResponse(response.data);
	}

	async callTool(toolName: string, toolArguments: any, sessionId?: string): Promise<any> {
		const headers: Record<string, string> = { 
			'Content-Type': 'application/json',
			'Accept': 'application/json, text/event-stream'
		};
		if (sessionId) headers['mcp-session-id'] = sessionId;
		const request = { jsonrpc: '2.0', id: '1', method: 'tools/call', params: { name: toolName, arguments: toolArguments } };
		const response = await axios.post(MCP_SERVER_URL, request, { headers, responseType: 'text' });
		return this.parseResponse(response.data);
	}

	async listTools(sessionId?: string): Promise<any> {
		const headers: Record<string, string> = { 
			'Content-Type': 'application/json',
			'Accept': 'application/json, text/event-stream'
		};
		if (sessionId) headers['mcp-session-id'] = sessionId;
		const response = await axios.post(MCP_SERVER_URL, { jsonrpc: '2.0', id: '1', method: 'tools/list' }, { headers, responseType: 'text' });
		return this.parseResponse(response.data);
	}

	private parseResponse(data: string): any {
		if (data.includes('data: ')) {
			const lines = data.split('\n');
			const jsonLines = lines.filter((line: string) => line.startsWith('data: ')).map((line: string) => line.substring(6)).filter((d: string) => d.trim() !== '');
			if (jsonLines.length > 0) return JSON.parse(jsonLines[jsonLines.length - 1]);
		}
		return JSON.parse(data);
	}
}

class MCPServiceFactory {
	private static instance: MCPService;
	static getService(): MCPService {
		if (!this.instance) this.instance = new HTTPMCPService();
		return this.instance;
	}
	static setService(service: MCPService) { this.instance = service; }
}

// Health
app.get('/health', (_req: Request, res: Response) => {
	res.json({ status: 'ok', service: 'user-agent' });
});

// Beautiful warm chat UI
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
        --bg1: #ffecd2; --bg2: #fcb69f; --ink: #2b2b2b; --muted: #6b7280;
        --user: #ffd6a5; --assistant: #ffe6ee; --accent1: #ff7f50; --accent2: #ff9770; --ring: rgba(255, 151, 112, 0.35);
      }
      body { margin: 0; font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: var(--ink); background: linear-gradient(135deg, var(--bg1) 0%, var(--bg2) 100%); min-height: 100vh; }
      .app { min-height: 100vh; display: flex; align-items: stretch; justify-content: center; padding: 24px; }
      .card { width: 100%; max-width: 960px; background: rgba(255,255,255,.85); backdrop-filter: blur(10px); border-radius: 20px; box-shadow: 0 20px 60px rgba(255,151,112,.25); display: flex; flex-direction: column; overflow: hidden; }
      .header { padding: 20px 24px; border-bottom: 1px solid rgba(0,0,0,.06); display: flex; align-items: center; justify-content: space-between; background: linear-gradient(180deg, rgba(255,255,255,.65), rgba(255,255,255,0)); }
      .title { font-size: 22px; font-weight: 800; letter-spacing: .3px; background: linear-gradient(90deg, #ff7f50, #ff9770, #ffaf87); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .subtitle { color: var(--muted); font-size: 13px; }
      .messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column-reverse; gap: 14px; background: linear-gradient(180deg, rgba(255,255,255,.6), rgba(255,255,255,.35)); }
      .bubble { max-width: 80%; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(0,0,0,.05); line-height: 1.5; font-size: 15px; box-shadow: 0 8px 26px rgba(0,0,0,.05); animation: fadeIn .35s ease; transition: transform .2s ease; white-space: pre-wrap; word-break: break-word; }
      .bubble.user { align-self: flex-end; background: var(--user); }
      .bubble.assistant { align-self: flex-start; background: var(--assistant); }
      .composer { border-top: 1px solid rgba(0,0,0,.06); padding: 12px; background: rgba(255,255,255,.9); }
      .row { display: grid; grid-template-columns: 1fr 160px 56px; gap: 10px; align-items: center; }
      textarea { width: 100%; border: 2px solid rgba(0,0,0,.07); border-radius: 12px; padding: 12px 12px 12px 14px; font-size: 15px; background: #fff7f2; transition: border-color .25s ease, box-shadow .25s ease, background .25s ease; resize: none; height: 52px; }
      textarea:focus { outline: none; border-color: var(--accent2); box-shadow: 0 0 0 4px var(--ring); background: #fff; }
      select { border: 2px solid rgba(0,0,0,.07); border-radius: 12px; padding: 10px 12px; font-size: 14px; background: #fff; transition: border-color .25s ease, box-shadow .25s ease; }
      select:focus { outline: none; border-color: var(--accent2); box-shadow: 0 0 0 3px var(--ring); }
      button { height: 52px; border: none; border-radius: 12px; background: linear-gradient(135deg, var(--accent1), var(--accent2)); color: white; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: transform .15s ease, box-shadow .2s ease, opacity .2s ease; box-shadow: 0 10px 24px rgba(255,127,80,.35); }
      button:hover { transform: translateY(-1px); box-shadow: 0 14px 34px rgba(255,127,80,.45); }
      button:active { transform: translateY(0); }
      button:disabled { opacity: .55; cursor: not-allowed; box-shadow: none; }
      .send-icon { width: 22px; height: 22px; }
      .toast { position: absolute; left: 50%; top: 18px; transform: translateX(-50%); background: rgba(0,0,0,.68); color: #fff; padding: 10px 14px; border-radius: 999px; font-size: 13px; opacity: 0; pointer-events: none; transition: opacity .3s ease, transform .3s ease; }
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

// Proxy endpoint to MCP server
app.post('/api/mcp', async (req: Request, res: Response) => {
	try {
		const mcpService = MCPServiceFactory.getService();
		let sessionId = req.header('mcp-session-id');
		if (!sessionId) sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		if (req.body.method === 'tools/call') {
			try { await mcpService.initializeSession(sessionId); } catch {}
		}
		let result;
		switch (req.body.method) {
			case 'tools/call':
				result = await mcpService.callTool(req.body.params.name, req.body.params.arguments, sessionId);
				break;
			case 'tools/list':
				result = await mcpService.listTools(sessionId);
				break;
			default:
				return res.status(400).json({ error: 'Unsupported MCP method' });
		}
		res.json(result);
	} catch (error: any) {
		res.status(500).json({ error: 'MCP request failed', detail: error.message });
	}
});

// List available MCP tools
app.get('/api/mcp/tools', async (req: Request, res: Response) => {
	try {
		const mcpService = MCPServiceFactory.getService();
		const sessionId = req.header('mcp-session-id') || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		await mcpService.initializeSession(sessionId);
		const tools = await mcpService.listTools(sessionId);
		res.json({ success: true, tools, sessionId });
	} catch (error: any) {
		res.status(500).json({ success: false, error: 'Failed to list tools', detail: error.message });
	}
});

// LLM integration endpoint
app.post('/api/llm/generate-sql', async (req: Request, res: Response) => {
	try {
		const { query, model = 'llama2' } = req.body;
		if (!query) return res.status(400).json({ success: false, error: 'Query is required' });
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
		const ollamaResponse = await axios.post(`${LLM_API_URL}/api/generate`, { model, prompt, stream: false, options: { temperature: 0.1, top_p: 0.9, max_tokens: 500 } });
		if (ollamaResponse.data && ollamaResponse.data.response) {
			let sql = ollamaResponse.data.response.trim().replace(/```sql\s*/gi, '').replace(/```\s*$/gi, '');
			if (!/^(SELECT|INSERT|UPDATE|DELETE|WITH)/i.test(sql)) return res.status(400).json({ success: false, error: 'Generated response does not appear to be valid SQL', rawResponse: sql });
			return res.json({ success: true, sql });
		}
		return res.status(500).json({ success: false, error: 'Invalid response from LLM' });
	} catch (error: any) {
		if (error.response) return res.status(error.response.status).json({ success: false, error: `LLM API error: ${error.response.data?.error || error.message}` });
		return res.status(500).json({ success: false, error: `Failed to connect to LLM: ${error.message}` });
	}
});

// LLM endpoint to explain results in natural language
app.post('/api/llm/explain-results', async (req: Request, res: Response) => {
	try {
		const { query, results, model = 'llama2' } = req.body;
		if (!query || !results) return res.status(400).json({ success: false, error: 'Query and results are required' });
		let data: any;
		try {
			if (typeof results === 'string') data = JSON.parse(results); else data = results;
			if (data && data.content) { try { data = JSON.parse(data.content); } catch { data = data.content; } }
			if (typeof data === 'string') { try { data = JSON.parse(data); } catch { data = { result: data }; } }
		} catch (e: any) {
			return res.status(400).json({ success: false, error: 'Invalid results format', debug: { rawResults: results, parseError: e.message } });
		}
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

Provide a natural, conversational answer:`;
		const ollamaResponse = await axios.post(`${LLM_API_URL}/api/generate`, { model, prompt, stream: false, options: { temperature: 0.7, top_p: 0.9, max_tokens: 1000 } });
		if (ollamaResponse.data && ollamaResponse.data.response) return res.json({ success: true, explanation: ollamaResponse.data.response.trim() });
		return res.status(500).json({ success: false, error: 'Invalid response from LLM' });
	} catch (error: any) {
		if (error.response) return res.status(error.response.status).json({ success: false, error: `LLM API error: ${error.response.data?.error || error.message}` });
		return res.status(500).json({ success: false, error: `Failed to connect to LLM: ${error.message}` });
	}
});

const port = parseInt(process.env.PORT || '3002', 10);
app.listen(port, () => {
	console.log(`User Agent started on http://localhost:${port}`);
	console.log(`Proxying MCP to ${MCP_SERVER_URL}`);
});