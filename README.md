# 🌦️ wttr-mcp-server

A practical MCP server for [wttr.in](https://wttr.in) that works with both:
- the classic text-style weather output,
- and the JSON API (`format=j1`).

If you want weather tools that are easy to wire into agents, this repo is for you.

---

## ✨ What you get

- `wttr_weather_view` → human-friendly weather output with agent profiles (`openclaw`, `codex`, `cursor`, `terminal`) and ASCII variants
- `wttr_site_weather` → quick weather view (`3/0/1/2/v2/0pq` or custom `%...` format)
- `wttr_raw_request` → raw access to wttr endpoints (moon, PNG, special URLs, combined options)
- `wttr_api_current` → structured current weather from `format=j1`
- `wttr_api_forecast` → structured 1-3 day forecast from `format=j1`
- `wttr_help` → full `wttr.in/:help`

---

## 🚀 Quick start

```bash
npm install
npm start
```

---

## 🧭 "Normal" vs ASCII output through MCP

Use `wttr_weather_view` when you want readable output without digging into raw JSON.

Examples:
- **Normal summary**: `agent=openclaw` (default: clean text, no ANSI)
- **ASCII for Codex/Cursor/Cline**: `agent=codex` or `agent=cursor`
- **Terminal full ASCII with colors**: `agent=terminal` or `view=ascii_full&ansi=true`
- **Force one-line output**: `view=ascii_one_line`

You can still call low-level tools (`wttr_api_current`, `wttr_site_weather`, `wttr_raw_request`) when you need full control.

## 🧪 Smoke test

```bash
npm run smoke
# or
make smoke
```

This runs local stdio checks via `mcporter --stdio` and verifies the key tool paths.

---

## 🛠️ Makefile shortcuts

```bash
make help
make install-deps
make test
make smoke
make docker-build
make docker-push
```

---

## 🐳 Docker

Docker Hub page:
- https://hub.docker.com/r/markstroinyi/wttr-mcp-server

Build and run locally:

```bash
docker build -t markstroinyi/wttr-mcp-server:0.3.0 .
docker run --rm -i markstroinyi/wttr-mcp-server:0.3.0
```

---

## 🤖 MCP config examples

### Source mode (local project)

```json
{
  "mcpServers": {
    "wttr-mcp": {
      "command": "node",
      "args": ["/home/sorcerer/Projects/wttr-mcp-server/src/index.mjs"]
    }
  }
}
```

### Docker mode

```json
{
  "mcpServers": {
    "wttr-mcp": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "markstroinyi/wttr-mcp-server:latest"]
    }
  }
}
```

---

## ⚙️ One-command install for popular AI agents

```bash
# OpenClaw / mcporter
make install-openclaw-source

# Claude Desktop (Linux)
make install-claude-linux-source

# Claude Desktop (macOS)
make install-claude-mac-source

# Cursor
make install-cursor-source

# VS Code + Cline (writes cline.mcpServers in settings.json)
make install-cline-vscode-source

# Windsurf
make install-windsurf-source

# Codex CLI (~/.codex/config.toml)
make install-codex-source
```

Custom config targets:

```bash
make install-generic-source CONFIG=~/.cursor/mcp.json ROOT_KEY=mcpServers
make install-generic-docker CONFIG=~/.config/Claude/claude_desktop_config.json ROOT_KEY=mcpServers
```

For Codex, the installer writes a TOML section like:
`[mcp_servers.<name>]` in `~/.codex/config.toml`.

---

## 🧱 Architecture (kept simple on purpose)

- `src/domain/*` → pure logic (validation, parsers)
- `src/infrastructure/*` → wttr adapter (`WttrClient`)
- `src/application/*` → tool registry and command execution
- `src/presentation/*` → MCP transport wiring

Patterns used:
- Command
- Adapter
- Composition root
- Layered structure (Fowler-style separation)

---

## 📄 License

MIT
