#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWttrMcpServer } from "./presentation/mcp-server.mjs";

/**
 * Bootstraps stdio transport required by MCP hosts.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   Promise resolved when server transport is connected.
 *
 * Throws:
 *   Error: If server initialization or transport connection fails.
 */
async function main() {
  const server = createWttrMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  // stdout is reserved for JSON-RPC messages.
  // eslint-disable-next-line no-console
  console.error("Fatal wttr-mcp error:", error);
  process.exit(1);
});
