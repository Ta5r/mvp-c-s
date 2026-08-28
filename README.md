# Model Context Protocol (MCP) Server & Client Playground

Welcome! This repository is an interactive, visual Proof of Concept (POC) for the **Model Context Protocol (MCP)**. It contains a fully functioning MCP Server and Client Bridge, coupled with a beautiful, real-time web dashboard that lets you run tools, read resources, and inspect raw JSON-RPC traffic under the hood.

---

## 💡 What is Model Context Protocol (MCP)?

The **Model Context Protocol (MCP)** is an open-source standard created by Anthropic that defines how Large Language Models (LLMs) connect to external data sources and tools. 

Instead of writing custom APIs, routers, and configurations for every new tool or database, MCP provides a unified protocol. LLM applications (called **Hosts**) can connect to **MCP Servers** via an intermediary **Client** to safely request tools, resources, and prompt templates.

### Core Architecture Roles:
1. **The Host**: The AI application (like Claude Desktop, Cursor, or a custom LLM agent framework) that wants to utilize tools or context.
2. **The Client**: The bridge that initiates connections, manages the transport layer, and translates LLM requests into protocol requests.
3. **The Server**: The lightweight process or service exposing specific data, resources, or capabilities (e.g. database access, local command executors, APIs).

---

## 🛠️ Technology Stack Used

This playground uses modern, lightweight technologies:
- **TypeScript & Node.js**: The core language stack. Native ECMAScript Modules (ESM) compile typescript sources down to ESM-compliant JavaScript.
- **`@modelcontextprotocol/sdk`**: The official TypeScript SDK provided by the MCP organization.
- **Express.js**: A Node.js web server framework used to build our **Client Bridge**. It translates browser HTTP requests into MCP client requests and serves the frontend dashboard.
- **Server-Sent Events (SSE)**: Used to stream real-time logs of the raw JSON-RPC communication channel directly from the Client Bridge to the browser.
- **Vanilla CSS (Grid & Flexbox)**: A responsive dark-mode layout with neon accents, custom scrollbars, and glassmorphic panels for a premium look.

---

## 📂 Repository Structure

```
├── package.json         # Project metadata, ESM module configuration & scripts
├── tsconfig.json        # TypeScript compiler configurations (using Node16 ESM)
├── src/
│   ├── mcp-server.ts    # The standalone MCP Server (runs via stdio transport)
│   └── client-bridge.ts # Express server acting as the Client & static files server
└── public/
    ├── index.html       # Layout structure of the Dashboard
    ├── style.css        # Dashboard styling (dark-mode theme)
    └── app.js           # Frontend client logic (binds forms & reads SSE stream)
```

---

## ⚡ How the Playground Works Under the Hood

```
   ┌────────────────────────────────────────────────────────┐
   │                       Web Browser                      │
   │           (Interactive Dashboard & Inspector)          │
   └────────────────────────┬───────────────────▲───────────┘
                            │                   │
                     REST   │  /api/tools       │ SSE
                     APIs   │  /api/tools/call  │ /api/logs-stream
                            ▼                   │
   ┌────────────────────────────────────────────┴───────────┐
   │                     Express Bridge                     │
   │                     (MCP Client)                       │
   └────────────────────────┬───────────────────▲───────────┘
                            │                   │
                            │  JSON-RPC 2.0     │ JSON-RPC 2.0
                     stdin  │  (method calls)   │ (results/errors)
                            ▼                   │
   ┌────────────────────────────────────────────┴───────────┐
   │                      MCP Server                        │
   │                     (Subprocess)                       │
   └────────────────────────────────────────────────────────┘
```

1. **Subprocess Spawning**: When the Express Bridge starts, it spawns `dist/mcp-server.js` as a background child process using `node` and attaches to its `stdin` and `stdout` streams (**Stdio Transport**).
2. **Handshake Negotiation**: The client initiates an `initialize` JSON-RPC request. The server replies with its name, version, protocol version, and capabilities (declaring it supports tools, resources, and prompts).
3. **Interception**: A custom `LoggingTransport` decorator wraps the transport. Every message passing between the client and server is recorded into an in-memory buffer.
4. **SSE Streaming**: The logs buffer is continuously piped to the browser UI via Server-Sent Events (`EventSource`).
5. **Action Invocation**: When you click "Call Tool" on the web dashboard, the browser fires an HTTP POST request to the Express Bridge. The bridge translates this into an SDK call (`client.callTool(...)`), which writes a `tools/call` JSON-RPC message to the server's `stdin`. The server processes it, writes the output back to `stdout`, and the bridge forwards it to the browser.

---

## 🚀 Running the Project

### Prerequisites
Make sure you have Node.js (version 16 or newer) installed.

### Setup and Start
1. Install the required dependencies:
   ```bash
   npm install
   ```

2. Compile the TypeScript files and launch the server:
   ```bash
   npm start
   ```
   *Note: This command runs the TypeScript compiler (`tsc`) and starts the Express web server.*

3. Open your browser and navigate to:
   **[http://localhost:3005](http://localhost:3005)**

---

## 🔧 How to Expand the Project

One of the best ways to learn MCP is by adding your own capabilities. Here is how you can expand each category:

### 1. Add a New Tool
Tools are functions that the client/LLM can execute. To add a tool, open [`src/mcp-server.ts`](file:///Users/tanay/mini-progs/mvp-c-s/src/mcp-server.ts) and call `server.tool()`:

```typescript
import { z } from "zod";

server.tool(
  "my_custom_tool", // Name of the tool
  "A description of what the tool does for the client", // Description
  {
    // Define input parameters and validation rules using Zod
    paramName: z.string().describe("What this parameter represents"),
    optionalNum: z.number().optional().describe("An optional number parameter")
  },
  async ({ paramName, optionalNum }) => {
    // Implement your tool's logic here (e.g. read files, call APIs, run commands)
    const outputText = `Hello, ${paramName}! You provided number: ${optionalNum ?? "none"}`;
    
    return {
      content: [{ type: "text", text: outputText }]
    };
  }
);
```

### 2. Add a New Resource
Resources are static or dynamic data files/URIs that provide context to the LLM. Open [`src/mcp-server.ts`](file:///Users/tanay/mini-progs/mvp-c-s/src/mcp-server.ts) and call `server.resource()`:

```typescript
server.resource(
  "user-profile", // Unique name
  "system://profile", // Unique URI (RFC-compliant protocol format)
  { description: "Mock user profile metadata" },
  async (uri) => {
    const data = {
      username: "developer_one",
      role: "administrator",
      skills: ["TypeScript", "Node.js", "Model Context Protocol"]
    };
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2)
        }
      ]
    };
  }
);
```

### 3. Add a New Prompt
Prompts are reusable formatting templates that help structure requests for LLMs. Open [`src/mcp-server.ts`](file:///Users/tanay/mini-progs/mvp-c-s/src/mcp-server.ts) and call `server.prompt()`:

```typescript
server.prompt(
  "summarize-text", // Prompt identifier name
  "Guides the LLM on how to summarize a block of text",
  {
    text: z.string().describe("The article or text content to summarize"),
    bulletPoints: z.number().default(3).describe("Number of bullets requested")
  },
  async ({ text, bulletPoints }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Summarize the following text in exactly ${bulletPoints} bullet points:\n\n${text}`
        }
      }
    ]
  })
);
```

---

## ⚡ Next Steps
Once you feel comfortable playing with this dashboard, you can connect this MCP Server (`dist/mcp-server.js`) to real host applications like **Claude Desktop** or **Cursor** to let an LLM control your tools directly!