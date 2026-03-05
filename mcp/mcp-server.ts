import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function createMCPServer() {
  const server = new McpServer({
    name: "mcp-server-example",
    version: "1.0.0",
  });

  server.registerTool(
    "calculate",
    {
      title: "Calculator",
      description:
        "Gọi tool này khi người dùng cần tính muốn biểu thức nào đó, cho dù nó có phức tạp hay là không.",
      inputSchema: {
        expression: z
          .union([z.string(), z.number()])
          .transform((val) => String(val))
          .describe("Biểu thức toán học"),
      },
    },
    async ({ expression }) => {
      try {
        // Chỉ cho phép các ký tự an toàn
        const sanitized = expression.replace(
          /[^0-9+\-*/().,%\s]|Math\.\w+/g,
          (match) => {
            if (match.startsWith("Math.")) return match;
            return "";
          },
        );

        console.log("Calculate:", expression);

        const result = new Function(`"use strict"; return (${sanitized})`)();

        return {
          content: [
            {
              type: "text",
              text: `${result}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Không thể tính: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerResource(
    "server-info",
    "info://server",
    {
      title: "Server Info",
      description: "Thông tin về MCP server này",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "info://server",
          text: JSON.stringify(
            {
              name: "mcp-demo-server",
              version: "1.0.0",
              author: "Nguyen Anh Tuan",
              description: "Demo MCP Server với Tools, Resources, Prompts",
              capabilities: {
                tools: ["calculate"],
                resources: ["server-info"],
              },
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  return server;
}
