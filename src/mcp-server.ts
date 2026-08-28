import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import os from "os";

// 1. Initialize the MCP Server
const server = new McpServer({
  name: "demo-mcp-server",
  version: "1.0.0",
});

// 2. Define a Calculator Tool
server.tool(
  "calculate",
  "Perform basic arithmetic operations (add, subtract, multiply, divide)",
  {
    operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("The arithmetic operation to execute"),
    a: z.number().describe("The first operand"),
    b: z.number().describe("The second operand"),
  },
  async ({ operation, a, b }) => {
    let result: number;
    switch (operation) {
      case "add":
        result = a + b;
        break;
      case "subtract":
        result = a - b;
        break;
      case "multiply":
        result = a * b;
        break;
      case "divide":
        if (b === 0) {
          return {
            content: [{ type: "text", text: "Error: Division by zero is not allowed." }],
            isError: true,
          };
        }
        result = a / b;
        break;
    }
    return {
      content: [{ type: "text", text: `The result of ${a} ${operation} ${b} is ${result}` }],
    };
  }
);

// 3. Define a System Info Tool
server.tool(
  "get_system_info",
  "Fetch the hosting system's hardware and environment specs",
  {},
  async () => {
    const info = {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      totalMemMB: Math.round(os.totalmem() / (1024 * 1024)),
      freeMemMB: Math.round(os.freemem() / (1024 * 1024)),
      cpus: os.cpus().map(cpu => cpu.model).filter((val, i, arr) => arr.indexOf(val) === i),
      uptimeHours: Math.round((os.uptime() / 3600) * 100) / 100,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
    };
  }
);

// 4. Define a Jokes Tool
const JOKES = [
  "Why do programmers wear glasses? Because they need to C#.",
  "There are 10 types of people in this world: Those who understand binary, and those who don't.",
  "How many programmers does it take to change a light bulb? None, it's a hardware problem.",
  "What is a programmer's favorite hangout place? Foo Bar.",
  "Why did the programmer quit his job? Because he didn't get arrays.",
  "['hip', 'hip'] (hip hip array!)",
  "A SQL query goes into a bar, walks up to two tables and asks, 'Can I join you?'",
  "There are only two hard things in Computer Science: cache invalidation, naming things, and off-by-one errors.",
];

server.tool(
  "get_joke",
  "Get a random computer science or programming joke",
  {},
  async () => {
    const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
    return {
      content: [{ type: "text", text: joke }],
    };
  }
);

// 5. Define a Resource (System Usage)
server.resource(
  "system-usage",
  "system://usage",
  { description: "Dynamic real-time system performance statistics" },
  async (uri) => {
    const usage = {
      timestamp: new Date().toISOString(),
      freeMemoryBytes: os.freemem(),
      totalMemoryBytes: os.totalmem(),
      memoryUsagePercentage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 10000) / 100,
      loadAverage: os.loadavg(),
    };
    return {
      contents: [
        {
          uri: uri.toString(),
          mimeType: "application/json",
          text: JSON.stringify(usage, null, 2),
        },
      ],
    };
  }
);

// 6. Define a Prompt Template
server.prompt(
  "explain-error",
  "Analyze a console error or stack trace and explain possible root causes and fixes",
  {
    errorLog: z.string().describe("The raw console output or error stack trace"),
    context: z.string().optional().describe("Additional context on what action was running"),
  },
  async ({ errorLog, context }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please analyze the following error stack trace:\n\n${errorLog}\n\n${
            context ? `Additional Context:\n${context}\n\n` : ""
          }Explain what likely went wrong and how I can fix it step-by-step.`,
        },
      },
    ],
  })
);

// 7. Start the Server with Stdio Transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Demo MCP Server running on stdio transport");
}

run().catch((error) => {
  console.error("Fatal error running MCP Server:", error);
  process.exit(1);
});
