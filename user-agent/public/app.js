const chat = document.getElementById('chat');
const promptInput = document.getElementById('user-prompt');
const modelSelect = document.getElementById('model-select');
const submitBtn = document.getElementById('submit-btn');
const statusEl = document.getElementById('status');

function showStatus(message, tone = 'info') {
	statusEl.textContent = message;
}

function appendMessage(role, text) {
	const wrapper = document.createElement('div');
	wrapper.className = `message ${role}`;

	const bubble = document.createElement('div');
	bubble.className = 'bubble';
	bubble.textContent = text;

	wrapper.appendChild(bubble);
	chat.prepend(wrapper);
}

function setLoading(isLoading) {
	submitBtn.disabled = isLoading;
	if (isLoading) {
		submitBtn.style.opacity = '0.8';
		submitBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
		showStatus('Thinking warm thoughts...');
	} else {
		submitBtn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
		showStatus('');
	}
}

function autoSizeTextarea(el) {
	el.style.height = 'auto';
	el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

autoSizeTextarea(promptInput);
promptInput.addEventListener('input', () => autoSizeTextarea(promptInput));

promptInput.addEventListener('keydown', (e) => {
	if (e.key === 'Enter' && !e.shiftKey) {
		e.preventDefault();
		submitQuery();
	}
});

submitBtn.addEventListener('click', submitQuery);

async function submitQuery() {
	const prompt = promptInput.value.trim();
	const model = modelSelect.value;
	if (!prompt) {
		showStatus('Please share something for me to help with.');
		return;
	}

	appendMessage('user', prompt);
	promptInput.value = '';
	autoSizeTextarea(promptInput);
	setLoading(true);

	try {
		// Non-technical guiding statuses
		showStatus('Thinking...');

		// Step 1: Generate SQL (kept internal)
		const sqlResponse = await fetch('/api/llm/generate-sql', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query: prompt, model })
		});
		const sqlData = await sqlResponse.json();
		if (!sqlData.success) throw new Error(sqlData.error || 'Could not think of an approach.');

		showStatus('Gathering information...');

		// Step 2: Execute via MCP
		const mcpResponse = await fetch('/api/mcp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: '1',
				method: 'tools/call',
				params: { name: 'queryDatabase', arguments: { query: sqlData.sql } }
			})
		});
		const mcpData = await mcpResponse.json();
		if (mcpData.error) throw new Error(mcpData.error.message || 'Something went wrong while thinking.');

		showStatus('Almost there...');

		// Step 3: Natural language explanation
		const nlResponse = await fetch('/api/llm/explain-results', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: prompt,
				results: mcpData.result.content,
				model
			})
		});
		const nlData = await nlResponse.json();
		if (!nlData.success) throw new Error(nlData.error || 'I had trouble finishing that thought.');

		appendMessage('assistant', nlData.explanation);
		showStatus('');
	} catch (err) {
		appendMessage('assistant', 'Sorry, I ran into a bump. Mind trying again?');
		showStatus(err?.message || 'Something went a little sideways.');
	} finally {
		setLoading(false);
	}
}