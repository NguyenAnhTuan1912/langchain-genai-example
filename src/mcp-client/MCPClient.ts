import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DynamicStructuredTool } from "@langchain/core/tools";

// Import helpers
import { jsonSchemaToZod } from "../helpers/schema/json-schema-to-zod";

export type TMCPServerConfig = {
  /** Tên định danh cho server */
  name: string;

  /** Loại transport */
  transport: "stdio" | "http";

  /** Cho stdio: command để spawn server */
  command?: string;
  args?: string[];

  /** Cho http: URL của MCP server */
  url?: string;
}

export type ConnectedServer = {
  config: TMCPServerConfig;
  client: Client;
}

export class MCPClient {
  private servers: ConnectedServer[] = [];

  /**
   * Connect tới một MCP Server
   */
  async connect(config: TMCPServerConfig): Promise<void> {
    const client = new Client({
      name: `chatbot-client-${config.name}`,
      version: "1.0.0",
    });

    let transport;

    if (config.transport === "stdio") {
      if (!config.command) throw new Error(`Server "${config.name}": command is required for stdio`);

      transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
      });
    } else if (config.transport === "http") {
      if (!config.url) throw new Error(`Server "${config.name}": url is required for http`);

      transport = new StreamableHTTPClientTransport(new URL(config.url));
    } else {
      throw new Error(`Unknown transport: ${config.transport}`);
    }

    await client.connect(transport);

    this.servers.push({ config, client });
    console.error(`  ✅ Connected to MCP Server: ${config.name}`);
  }

  async connectAll(configs: TMCPServerConfig[]): Promise<void> {
    for (const config of configs) {
      try {
        await this.connect(config);
      } catch (error: any) {
        console.log(JSON.stringify(error, null, 2));
        console.error(`  ❌ Failed to connect to "${config.name}": ${error.message}`);
      }
    }
  }

  async getTools(): Promise<DynamicStructuredTool[]> {
    const langchainTools: DynamicStructuredTool[] = [];

    for (const { config, client } of this.servers) {
      const { tools } = await client.listTools();

      for (const mcpTool of tools) {
        // Convert JSON Schema → Zod schema
        const zodSchema = jsonSchemaToZod(mcpTool.inputSchema);

        const langchainTool = new DynamicStructuredTool({
          name: mcpTool.name,
          description: mcpTool.description || `Tool from ${config.name}`,
          schema: zodSchema,

          func: async (args: Record<string, any>) => {
            // Gọi tool qua MCP Client
            const result = await client.callTool({
              name: mcpTool.name,
              arguments: args,
            });

            // Extract text content từ MCP response
            if (result.content && Array.isArray(result.content)) {
              return result.content
                .map((item: any) => {
                  if (item.type === "text") return item.text;
                  return JSON.stringify(item);
                })
                .join("\n");
            }

            return JSON.stringify(result);
          },
        });

        langchainTools.push(langchainTool);
      }

      console.error(
        `  📦 ${config.name}: loaded ${tools.length} tools → [${tools.map((t) => t.name).join(", ")}]`,
      );
    }

    return langchainTools;
  }

  /**
   * Disconnect tất cả servers
   */
  async disconnect(): Promise<void> {
    for (const { config, client } of this.servers) {
      try {
        await client.close();
        console.error(`  🔌 Disconnected: ${config.name}`);
      } catch {
        // ignore
      }
    }
    this.servers = [];
  }

  /**
   * Lấy danh sách resources từ tất cả servers
   */
  async getResources() {
    const allResources: { server: string; uri: string; name?: string }[] = [];

    for (const { config, client } of this.servers) {
      const { resources } = await client.listResources();
      for (const res of resources) {
        allResources.push({
          server: config.name,
          uri: res.uri,
          name: res.name,
        });
      }
    }

    return allResources;
  }

  /**
   * Đọc một resource theo URI (tìm đúng server)
   */
  async readResource(uri: string): Promise<string> {
    for (const { client } of this.servers) {
      try {
        const result = await client.readResource({ uri });
        if (result.contents?.length) {
          return result.contents.map((c: any) => c.text || "").join("\n");
        }
      } catch {
        // Thử server tiếp theo
        continue;
      }
    }
    throw new Error(`Resource not found: ${uri}`);
  }

  get connectedCount(): number {
    return this.servers.length;
  }
}
