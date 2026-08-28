import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port configurations
const PORT = 3005;

// Type definition for transport wrapper
interface Transport {
  start(): Promise<void>;
  send(message: any): Promise<void>;
  close(): Promise<void>;
  onmessage?: (message: any) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;
}

// Log structure
interface LogEntry {
  timestamp: string;
  direction: "sent" | "received";
  message: any;
}

// In-memory buffer for logs
const logsBuffer: LogEntry[] = [];
let sseClients: express.Response[] = [];

// Intercept and add log entry
function addLog(direction: "sent" | "received", message: any) {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    direction,
    message,
  };
  logsBuffer.push(logEntry);
  if (logsBuffer.length > 300) {
    logsBuffer.shift(); // Keep buffer size under control
  }

  // Stream in real time to any connected UI dashboard pages
  const data = JSON.stringify(logEntry);
  sseClients.forEach((res) => {
    try {
      res.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error("Error writing to SSE client:", err);
    }
  });
}

// 1. Create a custom Logging Transport wrapper
class LoggingTransport implements Transport {
  onmessage?: (message: any) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  constructor(private delegate: Transport) {}

  async start() {
    this.delegate.onmessage = (msg) => {
      addLog("received", msg);
      if (this.onmessage) this.onmessage(msg);
    };
    this.delegate.onerror = (err) => {
      console.error("Transport error:", err);
      if (this.onerror) this.onerror(err);
    };
    this.delegate.onclose = () => {
      console.log("Transport closed");
      if (this.onclose) this.onclose();
    };
    await this.delegate.start();
  }

  async send(message: any) {
    addLog("sent", message);
    await this.delegate.send(message);
  }

  async close() {
    await this.delegate.close();
  }
}

// 2. Initialize Express application
const app = express();
app.use(cors());
app.use(express.json());

// Serve static dashboard files from the public folder
const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));

// 3. Initialize the MCP Client
const mcpClient = new Client(
  {
    name: "web-dashboard-client",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

let isConnected = false;
let connectionError: string | null = null;
let serverMeta: any = { name: "unknown", version: "unknown", protocolVersion: "unknown" };

// Connect to the MCP Server
async function connectToMcpServer() {
  console.log("Launching MCP Server process...");
  
  // Set up the Stdio transport to spawn the compiled typescript server
  const serverPath = path.join(__dirname, "mcp-server.js");
  const mcpTransport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    stderr: "inherit" // Forward server console.error logs to console
  });

  const loggingTransport = new LoggingTransport(mcpTransport);

  try {
    await mcpClient.connect(loggingTransport);
    isConnected = true;
    connectionError = null;
    console.log("Successfully connected to MCP Server!");

    // Capture metadata from the logs (the initialize exchange)
    const initResponse = logsBuffer.find(
      (log) => log.direction === "received" && log.message?.result?.serverInfo
    );
    if (initResponse) {
      serverMeta = {
        name: initResponse.message.result.serverInfo.name,
        version: initResponse.message.result.serverInfo.version,
        protocolVersion: initResponse.message.result.protocolVersion || "unknown",
      };
    } else {
      // Fallback
      serverMeta = {
        name: "demo-mcp-server",
        version: "1.0.0",
        protocolVersion: "2024-11-05",
      };
    }
  } catch (error: any) {
    isConnected = false;
    connectionError = error.message || String(error);
    console.error("Failed to connect to MCP Server:", error);
  }
}

// 4. API Endpoints for Dashboard

// Get connection status and server info
app.get("/api/status", (req, res) => {
  res.json({
    connected: isConnected,
    error: connectionError,
    client: { name: "web-dashboard-client", version: "1.0.0" },
    server: serverMeta,
  });
});

// List all tools from the MCP Server
app.get("/api/tools", async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({ error: "MCP server not connected" });
  }
  try {
    const result = await mcpClient.listTools();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list tools" });
  }
});

// Call a specific tool
app.post("/api/tools/call", async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({ error: "MCP server not connected" });
  }
  const { name, arguments: toolArgs } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Missing tool name" });
  }

  try {
    console.log(`Calling tool "${name}" with args:`, toolArgs);
    const result = await mcpClient.callTool({
      name,
      arguments: toolArgs || {},
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || `Failed to call tool ${name}` });
  }
});

// List all resources from the MCP Server
app.get("/api/resources", async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({ error: "MCP server not connected" });
  }
  try {
    const result = await mcpClient.listResources();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list resources" });
  }
});

// Read a specific resource
app.get("/api/resources/read", async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({ error: "MCP server not connected" });
  }
  const { uri } = req.query;
  if (!uri || typeof uri !== "string") {
    return res.status(400).json({ error: "Missing or invalid resource URI" });
  }

  try {
    console.log(`Reading resource: ${uri}`);
    const result = await mcpClient.readResource({ uri });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || `Failed to read resource ${uri}` });
  }
});

// List all prompts from the MCP Server
app.get("/api/prompts", async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({ error: "MCP server not connected" });
  }
  try {
    const result = await mcpClient.listPrompts();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to list prompts" });
  }
});

// Get/format a prompt
app.post("/api/prompts/get", async (req, res) => {
  if (!isConnected) {
    return res.status(503).json({ error: "MCP server not connected" });
  }
  const { name, arguments: promptArgs } = req.body;
  if (!name) {
    return res.status(400).json({ error: "Missing prompt name" });
  }

  try {
    console.log(`Getting prompt "${name}" with args:`, promptArgs);
    const result = await mcpClient.getPrompt({
      name,
      arguments: promptArgs || {},
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || `Failed to get prompt ${name}` });
  }
});

// Get buffered logs
app.get("/api/logs", (req, res) => {
  res.json(logsBuffer);
});

// Stream real-time logs via Server-Sent Events (SSE)
app.get("/api/logs-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Send historical logs in the buffer first
  logsBuffer.forEach((log) => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  });

  sseClients.push(res);

  req.on("close", () => {
    sseClients = sseClients.filter((client) => client !== res);
  });
});

// Start Express server and connect to MCP server
app.listen(PORT, async () => {
  console.log(`Express Client Bridge running on http://localhost:${PORT}`);
  await connectToMcpServer();
});
