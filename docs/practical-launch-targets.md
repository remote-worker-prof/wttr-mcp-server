# practical launch guide

This guide covers real launch choices for `wttr-mcp-server` across the MCP clients people actually use.
It focuses on what works in practice, not just what is possible in theory.

## how to read this guide

Use it in this order:

1. pick your host environment,
2. choose transport (`stdio` or remote HTTP),
3. apply one config snippet,
4. run smoke checks.

If you are working on one machine, start with `stdio`.
If you need a shared backend, move to remote HTTP.

## environment matrix

| environment | config shape | recommended transport | notes |
| --- | --- | --- | --- |
| OpenClaw | JSON `mcpServers.<name>.command/args` | local `stdio` (`node src/index.mjs`) | stable for local runs and smoke checks |
| Claude Code / Claude Desktop | `claude mcp add ...` or JSON | local `stdio`; remote HTTP/SSE when needed | CLI supports all three transports |
| Codex CLI | `~/.codex/config.toml` (`mcp_servers`) | local `stdio`; remote `streamable_http` | modern docs support both |
| Cursor | `.mcp.json` / `mcp.json` | `stdio` or remote URL | supports URL + headers |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | `stdio` or remote HTTP/SSE | supports `serverUrl`/`url` + env interpolation |
| n8n | MCP Trigger / MCP Client Tool | remote streamable HTTP | usually `/mcp-server/http` + bearer token |

## reference snippets

### OpenClaw (local stdio)

```json
{
  "mcpServers": {
    "wttr-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/wttr-mcp-server/src/index.mjs"]
    }
  }
}
```

### Claude Code (remote HTTP)

```bash
claude mcp add --transport http wttr-remote https://example.com/mcp \
  --header "Authorization: Bearer ${WTTR_TOKEN}"
```

### Codex CLI (`streamable_http`)

```toml
[mcp_servers.wttr_mcp]
enabled = true
transport = { type = "streamable_http", url = "https://example.com/mcp" }
bearer_token_env_var = "WTTR_TOKEN"
startup_timeout_sec = 30.0
tool_timeout_sec = 120.0
```

### Cursor (remote)

```json
{
  "mcpServers": {
    "wttr-remote": {
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${env:WTTR_TOKEN}"
      }
    }
  }
}
```

### Windsurf (remote)

```json
{
  "mcpServers": {
    "wttr-remote": {
      "serverUrl": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer ${env:WTTR_TOKEN}"
      }
    }
  }
}
```

### n8n

Use streamable HTTP. Keep bearer auth in headers. Keep `content[0].text` parseable and keep `structuredContent` available.

## transport choice in plain terms

- choose `stdio` when the server runs on the same machine as the client.
- choose remote HTTP when you need one server for many clients.
- for workflow engines, prefer compact machine-friendly text and keep structured payloads in parallel.

## response profile recommendations

- chat UI: `WTTR_MCP_RESULT_PROFILE=webchat`
- workflow automation: `WTTR_MCP_RESULT_PROFILE=n8n`
- mixed/general use: keep `default`

## repository support already in place

- `scripts/install_mcp.py` supports `--mode http` for JSON clients.
- `scripts/install_codex.py` supports `--transport stdio|streamable_http`.
- Make targets include:
  - `install-cursor-http`
  - `install-windsurf-http`
  - `install-codex-http`
  - `install-generic-http`

## sources

- MCP transports and logging rules: <https://modelcontextprotocol.io/specification/2025-11-25/basic/transports>
- Claude MCP docs: <https://docs.anthropic.com/en/docs/claude-code/mcp>
- Codex MCP docs: <https://mintlify.com/openai/codex/cli/mcp>
- Codex CLI reference: <https://developers.openai.com/codex/cli/reference/>
- Cursor MCP docs: <https://cursor.com/docs/context/mcp>
- Cursor MCP extension docs: <https://cursor.com/docs/context/mcp-extension-api>
- Windsurf MCP docs: <https://docs.windsurf.com/windsurf/cascade/mcp>
- n8n MCP docs: <https://docs.n8n.io/advanced-ai/accessing-n8n-mcp-server/>
