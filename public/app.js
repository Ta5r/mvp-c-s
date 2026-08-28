// Global State
let currentCategory = 'tools';
let activeItem = null; // Stores { type: 'tool'|'resource'|'prompt', data: object }
let allItems = { tools: [], resources: [], prompts: [] };
let logEntries = [];
let logsPaused = false;
let currentLogFilter = 'all';

// DOM Elements
const elements = {
  connectionStatusDot: document.getElementById('connection-status-dot'),
  connectionStatusText: document.getElementById('connection-status-text'),
  serverNameBadge: document.getElementById('server-name-badge'),
  serverVersionBadge: document.getElementById('server-version-badge'),
  metaProtocolVer: document.getElementById('meta-protocol-ver'),
  
  tabTools: document.getElementById('tab-btn-tools'),
  tabResources: document.getElementById('tab-btn-resources'),
  tabPrompts: document.getElementById('tab-btn-prompts'),
  
  listTools: document.getElementById('list-tools'),
  listResources: document.getElementById('list-resources'),
  listPrompts: document.getElementById('list-prompts'),
  
  toolsListItems: document.getElementById('tools-list-items'),
  resourcesListItems: document.getElementById('resources-list-items'),
  promptsListItems: document.getElementById('prompts-list-items'),
  
  selectedTypeBadge: document.getElementById('selected-type-badge'),
  selectedItemTitle: document.getElementById('selected-item-title'),
  selectedItemDescBadge: document.getElementById('selected-item-desc-badge'),
  selectedItemDescription: document.getElementById('selected-item-description'),
  
  dynamicFormContainer: document.getElementById('dynamic-form-container'),
  formFieldsGrid: document.getElementById('form-fields-grid'),
  submitActionBtn: document.getElementById('submit-action-btn'),
  interactionForm: document.getElementById('interaction-form'),
  
  responseStatusBadge: document.getElementById('response-status-badge'),
  resultOutputCode: document.getElementById('result-output-code'),
  
  logsViewport: document.getElementById('logs-viewport'),
  emptyLogsPlaceholder: document.getElementById('empty-logs-placeholder'),
  pauseLogsBtn: document.getElementById('pause-logs-btn'),
  streamingIndicator: document.getElementById('inspector-streaming-indicator'),
  
  logDetailModal: document.getElementById('log-detail-modal'),
  modalJsonContent: document.getElementById('modal-json-content'),
};

// Initial Load & Heartbeat
document.addEventListener('DOMContentLoaded', () => {
  checkStatus();
  fetchInitialData();
  setupLogsStream();
  setInterval(checkStatus, 5000); // 5s heartbeat
});

// 1. Connection Status Checking
async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    
    if (data.connected) {
      elements.connectionStatusDot.className = 'status-dot connected pulsing';
      elements.connectionStatusText.textContent = 'CONNECTED';
      elements.connectionStatusText.style.color = 'var(--color-success)';
      
      elements.serverNameBadge.textContent = `Server: ${data.server.name}`;
      elements.serverVersionBadge.textContent = data.server.version;
      elements.metaProtocolVer.textContent = data.server.protocolVersion;
    } else {
      elements.connectionStatusDot.className = 'status-dot disconnected';
      elements.connectionStatusText.textContent = 'DISCONNECTED';
      elements.connectionStatusText.style.color = 'var(--color-error)';
      if (data.error) {
        console.error("Server connection error details:", data.error);
      }
    }
  } catch (err) {
    elements.connectionStatusDot.className = 'status-dot disconnected';
    elements.connectionStatusText.textContent = 'BRIDGE OFFLINE';
    elements.connectionStatusText.style.color = 'var(--color-error)';
  }
}

// 2. Fetch Lists of Tools, Resources, and Prompts
async function fetchInitialData() {
  try {
    // Fetch Tools
    const toolsRes = await fetch('/api/tools');
    if (toolsRes.ok) {
      const data = await toolsRes.json();
      allItems.tools = data.tools || [];
      renderToolsList();
    }

    // Fetch Resources
    const resourcesRes = await fetch('/api/resources');
    if (resourcesRes.ok) {
      const data = await resourcesRes.json();
      allItems.resources = data.resources || [];
      renderResourcesList();
    }

    // Fetch Prompts
    const promptsRes = await fetch('/api/prompts');
    if (promptsRes.ok) {
      const data = await promptsRes.json();
      allItems.prompts = data.prompts || [];
      renderPromptsList();
    }
  } catch (err) {
    console.error("Error fetching initial list data:", err);
  }
}

// 3. Category Tab Switching
function switchCategory(category) {
  currentCategory = category;
  
  // Update Buttons active class
  elements.tabTools.classList.toggle('active', category === 'tools');
  elements.tabResources.classList.toggle('active', category === 'resources');
  elements.tabPrompts.classList.toggle('active', category === 'prompts');
  
  // Show / Hide containers
  elements.listTools.classList.toggle('active', category === 'tools');
  elements.listResources.classList.toggle('active', category === 'resources');
  elements.listPrompts.classList.toggle('active', category === 'prompts');
}

// 4. Rendering Lists in UI
function renderToolsList() {
  if (allItems.tools.length === 0) {
    elements.toolsListItems.innerHTML = '<p class="empty-logs-placeholder">No tools found</p>';
    return;
  }
  
  elements.toolsListItems.innerHTML = allItems.tools.map((tool) => `
    <button class="list-item" id="item-tool-${tool.name}" onclick="selectItem('tool', '${tool.name}')">
      <div class="list-item-header">
        <span class="list-item-name">${tool.name}</span>
        <span class="badge">Tool</span>
      </div>
      <p class="list-item-desc">${tool.description || 'No description available.'}</p>
    </button>
  `).join('');
}

function renderResourcesList() {
  if (allItems.resources.length === 0) {
    elements.resourcesListItems.innerHTML = '<p class="empty-logs-placeholder">No resources found</p>';
    return;
  }
  
  elements.resourcesListItems.innerHTML = allItems.resources.map((res) => `
    <button class="list-item" id="item-resource-${res.name}" onclick="selectItem('resource', '${res.name}')">
      <div class="list-item-header">
        <span class="list-item-name">${res.name}</span>
        <span class="badge">Resource</span>
      </div>
      <p class="list-item-desc">${res.uri}<br>${res.description || ''}</p>
    </button>
  `).join('');
}

function renderPromptsList() {
  if (allItems.prompts.length === 0) {
    elements.promptsListItems.innerHTML = '<p class="empty-logs-placeholder">No prompts found</p>';
    return;
  }
  
  elements.promptsListItems.innerHTML = allItems.prompts.map((prompt) => `
    <button class="list-item" id="item-prompt-${prompt.name}" onclick="selectItem('prompt', '${prompt.name}')">
      <div class="list-item-header">
        <span class="list-item-name">${prompt.name}</span>
        <span class="badge">Prompt</span>
      </div>
      <p class="list-item-desc">${prompt.description || 'No description available.'}</p>
    </button>
  `).join('');
}

// 5. Selecting a Tool, Resource or Prompt
function selectItem(type, name) {
  // Clear previous selected items class
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('selected'));
  
  // Add active selected class
  const itemEl = document.getElementById(`item-${type}-${name}`);
  if (itemEl) itemEl.classList.add('selected');
  
  let item = null;
  if (type === 'tool') {
    item = allItems.tools.find(t => t.name === name);
    elements.selectedTypeBadge.textContent = 'TOOL';
    elements.selectedTypeBadge.style.color = 'var(--accent-purple)';
    elements.submitActionBtn.textContent = 'Call Tool';
  } else if (type === 'resource') {
    item = allItems.resources.find(r => r.name === name);
    elements.selectedTypeBadge.textContent = 'RESOURCE';
    elements.selectedTypeBadge.style.color = 'var(--accent-blue)';
    elements.submitActionBtn.textContent = 'Read Resource';
  } else if (type === 'prompt') {
    item = allItems.prompts.find(p => p.name === name);
    elements.selectedTypeBadge.textContent = 'PROMPT';
    elements.selectedTypeBadge.style.color = 'var(--color-warning)';
    elements.submitActionBtn.textContent = 'Generate Prompt';
  }
  
  if (!item) return;
  
  activeItem = { type, data: item };
  
  // Render details card
  elements.selectedItemTitle.textContent = item.name;
  elements.selectedItemDescBadge.textContent = type.toUpperCase();
  elements.selectedItemDescription.textContent = item.description || 'No description provided by server.';
  
  // Generate Form Fields
  generateFormFields(type, item);
}

// 6. Generate Form Fields Dynamically based on schemas
function generateFormFields(type, item) {
  elements.formFieldsGrid.innerHTML = '';
  
  if (type === 'resource') {
    // Resources require no arguments, just display URI info
    elements.dynamicFormContainer.classList.remove('hidden');
    elements.formFieldsGrid.innerHTML = `
      <div class="form-group" style="grid-column: 1 / -1;">
        <label>Resource URI</label>
        <input type="text" value="${item.uri}" disabled style="background-color: var(--bg-secondary); cursor: not-allowed;" />
        <span class="field-desc">This resource will be fetched dynamically via GET request.</span>
      </div>
    `;
    return;
  }
  
  let properties = {};
  let required = [];
  
  if (type === 'tool' && item.inputSchema) {
    properties = item.inputSchema.properties || {};
    required = item.inputSchema.required || [];
  } else if (type === 'prompt' && item.arguments) {
    // Prompts expose args as a list
    item.arguments.forEach(arg => {
      properties[arg.name] = {
        type: 'string',
        description: arg.description || '',
        required: arg.required || false
      };
      if (arg.required) required.push(arg.name);
    });
  }
  
  const propNames = Object.keys(properties);
  
  if (propNames.length === 0) {
    elements.dynamicFormContainer.classList.remove('hidden');
    elements.formFieldsGrid.innerHTML = `
      <div class="form-group" style="grid-column: 1 / -1; text-align: center; padding: 12px; color: var(--text-muted);">
        No parameters required for this action.
      </div>
    `;
    return;
  }
  
  elements.dynamicFormContainer.classList.remove('hidden');
  
  propNames.forEach(name => {
    const prop = properties[name];
    const isRequired = required.includes(name) || prop.required;
    const typeLabel = prop.type || 'string';
    
    const fieldId = `field-${name}`;
    let fieldHtml = '';
    
    if (prop.anyOf || prop.enum) {
      // Dropdown enum selection
      const options = prop.anyOf ? prop.anyOf.map(o => o.const) : prop.enum;
      fieldHtml = `
        <select id="${fieldId}" ${isRequired ? 'required' : ''}>
          ${options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
        </select>
      `;
    } else if (prop.type === 'boolean') {
      fieldHtml = `
        <select id="${fieldId}" ${isRequired ? 'required' : ''}>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      `;
    } else if (prop.type === 'number' || prop.type === 'integer') {
      fieldHtml = `
        <input type="number" id="${fieldId}" step="any" placeholder="e.g. 42" ${isRequired ? 'required' : ''} />
      `;
    } else {
      // Default String
      fieldHtml = `
        <input type="text" id="${fieldId}" placeholder="Enter value..." ${isRequired ? 'required' : ''} />
      `;
    }
    
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'form-group';
    fieldContainer.innerHTML = `
      <label for="${fieldId}">
        ${name} ${isRequired ? '<span style="color: var(--color-error)">*</span>' : ''}
        <span>${typeLabel}</span>
      </label>
      ${fieldHtml}
      ${prop.description ? `<span class="field-desc">${prop.description}</span>` : ''}
    `;
    
    elements.formFieldsGrid.appendChild(fieldContainer);
  });
}

// 7. Form Submission to Trigger actions
async function handleFormSubmit(event) {
  event.preventDefault();
  if (!activeItem) return;
  
  // Set UI state to loading
  elements.responseStatusBadge.textContent = 'Executing...';
  elements.responseStatusBadge.className = 'response-status';
  elements.resultOutputCode.textContent = 'Waiting for response from MCP bridge...';
  elements.resultOutputCode.style.color = 'var(--text-muted)';
  
  const type = activeItem.type;
  const item = activeItem.data;
  
  // Gather arguments
  const args = {};
  if (type !== 'resource') {
    let properties = {};
    if (type === 'tool' && item.inputSchema) {
      properties = item.inputSchema.properties || {};
    } else if (type === 'prompt' && item.arguments) {
      item.arguments.forEach(arg => {
        properties[arg.name] = { type: 'string' };
      });
    }
    
    Object.keys(properties).forEach(name => {
      const inputEl = document.getElementById(`field-${name}`);
      if (inputEl) {
        let val = inputEl.value;
        if (inputEl.tagName === 'SELECT' && (val === 'true' || val === 'false')) {
          val = (val === 'true');
        } else if (inputEl.type === 'number') {
          val = Number(val);
        }
        args[name] = val;
      }
    });
  }
  
  try {
    let response;
    const startTime = Date.now();
    
    if (type === 'tool') {
      response = await fetch('/api/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name, arguments: args }),
      });
    } else if (type === 'resource') {
      response = await fetch(`/api/resources/read?uri=${encodeURIComponent(item.uri)}`);
    } else if (type === 'prompt') {
      response = await fetch('/api/prompts/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name, arguments: args }),
      });
    }
    
    const latency = Date.now() - startTime;
    const resultData = await response.json();
    
    if (response.ok) {
      elements.responseStatusBadge.textContent = `Success (${latency}ms)`;
      elements.responseStatusBadge.className = 'response-status success';
      elements.resultOutputCode.textContent = JSON.stringify(resultData, null, 2);
      elements.resultOutputCode.style.color = '#34d399'; // Mint Green color
    } else {
      elements.responseStatusBadge.textContent = 'Error';
      elements.responseStatusBadge.className = 'response-status error';
      elements.resultOutputCode.textContent = JSON.stringify(resultData, null, 2);
      elements.resultOutputCode.style.color = '#f87171'; // Light Red color
    }
  } catch (err) {
    elements.responseStatusBadge.textContent = 'Failed';
    elements.responseStatusBadge.className = 'response-status error';
    elements.resultOutputCode.textContent = `Error executing request: ${err.message || err}`;
    elements.resultOutputCode.style.color = '#f87171';
  }
}

// 8. Server-Sent Events (SSE) for JSON-RPC Traffic Inspector
function setupLogsStream() {
  const source = new EventSource('/api/logs-stream');
  
  source.onmessage = (event) => {
    if (logsPaused) return;
    
    const log = JSON.parse(event.data);
    logEntries.push(log);
    if (logEntries.length > 300) {
      logEntries.shift();
    }
    
    appendLogToDOM(log);
  };
  
  source.onerror = (err) => {
    console.error("SSE Logs stream encountered an error:", err);
    elements.streamingIndicator.textContent = '● OFFLINE';
    elements.streamingIndicator.style.color = 'var(--color-error)';
  };
  
  // Pull current log buffer history on first load
  fetch('/api/logs')
    .then(res => res.json())
    .then(historyLogs => {
      logEntries = historyLogs;
      elements.logsViewport.innerHTML = '';
      if (logEntries.length > 0) {
        elements.emptyLogsPlaceholder.classList.add('hidden');
        logEntries.forEach(log => appendLogToDOM(log));
      }
    });
}

function appendLogToDOM(log) {
  // Hide placeholder
  elements.emptyLogsPlaceholder.classList.add('hidden');
  
  // Extract info from JSON-RPC structure
  const msg = log.message;
  let method = 'unknown';
  let id = 'notification';
  let isErrorRow = false;
  
  if (msg) {
    if (msg.method) {
      method = msg.method;
    } else if (msg.result) {
      method = 'result';
      isErrorRow = !!msg.error;
    } else if (msg.error) {
      method = 'error';
      isErrorRow = true;
    }
    
    if (msg.id !== undefined) {
      id = `id: ${msg.id}`;
    }
  }
  
  // Filter check
  if (currentLogFilter !== 'all' && log.direction !== currentLogFilter) {
    return;
  }
  
  const time = new Date(log.timestamp).toLocaleTimeString();
  const dirLabel = log.direction === 'sent' ? 'CLIENT ➜' : '➜ SERVER';
  
  const row = document.createElement('div');
  row.className = `log-row ${log.direction} ${isErrorRow ? 'rpc-error' : ''}`;
  
  // Create clickable expansion
  const logIndex = logEntries.indexOf(log);
  row.onclick = () => openLogModal(logIndex);
  
  row.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-dir">${dirLabel}</span>
    <span class="log-method">${method}</span>
    <span class="log-meta">${id}</span>
  `;
  
  elements.logsViewport.appendChild(row);
  
  // Auto-scroll logs viewport to bottom
  elements.logsViewport.scrollTop = elements.logsViewport.scrollHeight;
}

// 9. Logging Control Operations (Filter, Pause, Clear)
function setLogFilter(filter) {
  currentLogFilter = filter;
  
  // Update UI buttons styling
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => {
    const text = btn.textContent.toLowerCase();
    btn.classList.toggle('active', text === filter);
  });
  
  // Re-render matching DOM logs
  elements.logsViewport.innerHTML = '';
  const filtered = logEntries.filter(log => filter === 'all' || log.direction === filter);
  
  if (filtered.length === 0) {
    elements.emptyLogsPlaceholder.classList.remove('hidden');
  } else {
    elements.emptyLogsPlaceholder.classList.add('hidden');
    filtered.forEach(log => appendLogToDOM(log));
  }
}

function togglePauseLogs() {
  logsPaused = !logsPaused;
  
  if (logsPaused) {
    elements.pauseLogsBtn.textContent = '▶ Resume';
    elements.streamingIndicator.textContent = '⏸ PAUSED';
    elements.streamingIndicator.style.color = 'var(--color-warning)';
  } else {
    elements.pauseLogsBtn.textContent = '⏸ Pause';
    elements.streamingIndicator.textContent = '● LIVE';
    elements.streamingIndicator.style.color = 'var(--color-success)';
    
    // Catch up viewport logs
    elements.logsViewport.innerHTML = '';
    const filtered = logEntries.filter(log => currentLogFilter === 'all' || log.direction === currentLogFilter);
    if (filtered.length > 0) {
      elements.emptyLogsPlaceholder.classList.add('hidden');
      filtered.forEach(log => appendLogToDOM(log));
    }
  }
}

function clearLogs() {
  logEntries = [];
  elements.logsViewport.innerHTML = '';
  elements.emptyLogsPlaceholder.classList.remove('hidden');
}

// 10. Log Details Detail Dialog Modal
function openLogModal(index) {
  const log = logEntries[index];
  if (!log) return;
  
  elements.modalJsonContent.textContent = JSON.stringify(log.message, null, 2);
  elements.logDetailModal.classList.remove('hidden');
}

function closeLogModal() {
  elements.logDetailModal.classList.add('hidden');
}
