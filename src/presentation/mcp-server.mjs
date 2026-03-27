import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createToolRegistry } from "../application/tool-registry.mjs";
import { WttrClient } from "../infrastructure/wttr-client.mjs";

export const SERVER_NAME = "wttr-mcp";
export const SERVER_VERSION = "0.3.0";

export function createWttrMcpServer() {
  const wttrClient = new WttrClient();
  const registry = createToolRegistry({ wttrClient });

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: registry.list() }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args = {} } = request.params;
      const result = await registry.execute(name, args);
      return registry.toMcpResult(result);
    } catch (error) {
      const code = /must be|unknown tool/i.test(error?.message || "") ? "VALIDATION" : "UPSTREAM";
      return registry.toMcpError(error, code);
    }
  });

  return server;
}
