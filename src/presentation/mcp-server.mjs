import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createToolRegistry } from "../application/tool-registry.mjs";
import { WttrClient } from "../infrastructure/wttr-client.mjs";
import { RESULT_PROFILES, createResultPresenter } from "./result-presenter.mjs";

/**
 * MCP server name identifier.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   Stable server name string.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export const SERVER_NAME = "wttr-mcp";

/**
 * MCP server semantic version.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   Server version string.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export const SERVER_VERSION = "0.3.0";

/**
 * Resolves result profile from request metadata and environment.
 *
 * Args:
 *   request: Incoming MCP request envelope.
 *   defaultProfile: Fallback profile when metadata/environment are absent.
 *
 * Returns:
 *   Selected profile identifier guaranteed to be supported.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
function resolveResultProfile({ request, defaultProfile }) {
  const metadataProfile = request?.params?._meta?.resultProfile || request?.params?._meta?.clientProfile;
  const envProfile = process.env.WTTR_MCP_RESULT_PROFILE;
  const candidate = metadataProfile || envProfile || defaultProfile;

  if (RESULT_PROFILES.includes(candidate)) {
    return candidate;
  }
  return defaultProfile;
}

/**
 * Creates an MCP server instance bound to wttr handlers.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   Initialized `Server` with registered request handlers.
 *
 * Throws:
 *   Error: If dependencies or request handlers fail during runtime.
 */
export function createWttrMcpServer() {
  const wttrClient = new WttrClient();
  const resultPresenter = createResultPresenter({ defaultProfile: "default" });
  const registry = createToolRegistry({ wttrClient, resultPresenter });

  const server = new Server({ name: SERVER_NAME, version: SERVER_VERSION }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: registry.list() }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args = {} } = request.params;
      const result = await registry.execute(name, args);
      const profile = resolveResultProfile({ request, defaultProfile: "default" });
      return registry.toMcpResult(result, { profile });
    } catch (error) {
      const code = /must be|unknown tool/i.test(error?.message || "") ? "VALIDATION" : "UPSTREAM";
      return registry.toMcpError(error, code);
    }
  });

  return server;
}
