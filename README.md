# wttr-mcp-server

`wttr-mcp-server` is a Model Context Protocol (MCP) server for `wttr.in`.
It supports both human-readable weather output and structured JSON output,
with compatibility-focused behavior for chat UIs and workflow agents.

## Key capabilities

- `wttr_weather_view` for user-facing weather summaries and ASCII variants.
- `wttr_site_weather` for direct wttr format modes (`0`, `1`, `2`, `3`, `v2`, `0pq`, `%...`).
- `wttr_raw_request` for full wttr endpoint access, including special paths and PNG output.
- `wttr_api_current` and `wttr_api_forecast` for structured JSON weather data.
- `wttr_help` for complete `wttr.in/:help` output.

## Compatibility profiles

The server now supports result presentation profiles optimized for different MCP hosts:

- `default`: readable JSON text + `structuredContent` when available.
- `webchat`: prefers plain weather text in `content[0].text`, keeps `structuredContent`.
- `n8n`: emits compact JSON text in `content[0].text`, keeps `structuredContent`.

Profile selection:

1. Request metadata (`params._meta.resultProfile` or `params._meta.clientProfile`).
2. Environment variable `WTTR_MCP_RESULT_PROFILE`.
3. Fallback to `default`.

This improves interoperability in clients that flatten or transform tool responses.

## Weather output profiles

`wttr_weather_view` supports agent-specific defaults:

- Summary-first profiles: `auto`, `openclaw`, `webchat`, `browser`, `n8n`, `claude`.
- ASCII-compact profiles: `codex`, `cursor`, `cline`, `windsurf`.
- Full terminal profile: `terminal` (ANSI enabled by default).

Views:

- `normal`
- `ascii_compact`
- `ascii_full`
- `ascii_one_line`

## Quick start

```bash
npm install
npm start
```

## Example MCP calls

```bash
# Summary output for OpenClaw/WebChat style usage
mcporter call wttr-mcp.wttr_weather_view \
  --args '{"location":"Saint Petersburg","agent":"webchat","lang":"ru"}'

# ASCII compact for coding agents
mcporter call wttr-mcp.wttr_weather_view \
  --args '{"location":"Saint Petersburg","agent":"codex","lang":"ru"}'

# Full ASCII with ANSI colors
mcporter call wttr-mcp.wttr_weather_view \
  --args '{"location":"Saint Petersburg","agent":"terminal","lang":"ru","ansi":true}'

# Structured current weather
mcporter call wttr-mcp.wttr_api_current \
  --args '{"location":"Saint Petersburg","lang":"ru"}'
```

## Quality checks

```bash
npm run check:docs   # Enforces Args/Returns/Throws docblocks on exported entities
npm test
npm run smoke
npm run ci           # check:docs + unit tests (same as CI pipeline)
```

Or with Makefile shortcuts:

```bash
make test
make smoke
```

## Installation helpers

The repository provides installers for common MCP hosts.

```bash
make install-openclaw-source
make install-claude-linux-source
make install-claude-mac-source
make install-cursor-source
make install-cline-vscode-source
make install-windsurf-source
make install-codex-source
```

Remote HTTP installation helpers:

```bash
make install-cursor-http HTTP_URL=https://host.example/mcp
make install-windsurf-http HTTP_URL=https://host.example/mcp
make install-codex-http HTTP_URL=https://host.example/mcp BEARER_TOKEN_ENV_VAR=WTTR_TOKEN
```

Generic installers:

```bash
make install-generic-source CONFIG=~/.cursor/mcp.json ROOT_KEY=mcpServers
make install-generic-docker CONFIG=~/.config/Claude/claude_desktop_config.json ROOT_KEY=mcpServers
make install-generic-http CONFIG=~/.codeium/windsurf/mcp_config.json ROOT_KEY=mcpServers HTTP_URL=https://host.example/mcp
```

## Docker

```bash
docker build -t markstroinyi/wttr-mcp-server:0.3.0 .
docker run --rm -i markstroinyi/wttr-mcp-server:0.3.0
```

## Architecture overview

- `src/domain`: validation and weather data parsing.
- `src/infrastructure`: wttr HTTP adapter.
- `src/application`: tool registry and weather view orchestration.
- `src/presentation`: MCP server wiring and result presentation strategies.

Patterns in use:

- Command pattern for tool execution.
- Adapter pattern for upstream HTTP interaction.
- Strategy + Factory for weather view rendering.
- Strategy + Factory for MCP result presentation profiles.
- Composition root in MCP server bootstrap.

See `docs/architecture.md`, `docs/client-compatibility-research.md`, and `docs/practical-launch-targets.md` for details.

## License

MIT
