import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";

import { createMCPServer } from "./mcp-server";

async function main() {
  const mode = process.argv[2] || "stdio";

  if (mode === "http") {
    // ── HTTP Transport ──────────────────────────────
    const app = express();

    app.use(express.json());

    app.post("/mcp", async (req, res) => {
      console.log("Have a client connect to mcp server", req.ip);

      try {
        const mcpServer = createMCPServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);

        res.on("close", () => {
          transport.close();
          mcpServer.close();
        });
      } catch (error: any) {
        if (!res.headersSent) {
          res.status(500).json({ error: error.message });
        }
      }
    });

    app.get("/mcp", async (req, res) => {
      return res.status(403).send("Please use POST method to use this resource");
    });

    // Cho phép client GET để check server
    app.get("/health", async (req, res) => {
      return res.status(200).send("ok");
    });

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`🚀 MCP Server (HTTP) running at http://localhost:${PORT}/mcp`);
    });

  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
