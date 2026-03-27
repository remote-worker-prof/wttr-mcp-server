# wttr-mcp-server

`wttr-mcp-server` is a small MCP server for `wttr.in`.
It can return plain weather text, structured JSON, or base64-encoded PNG payloads,
depending on which tool you call.

The project is built for day-to-day use in editor agents, chat UIs, and workflow systems.

## what it does

- `wttr_weather_view` — readable weather summaries plus ASCII views.
- `wttr_site_weather` — direct wttr mode output (`0`, `1`, `2`, `3`, `v2`, `0pq`, `%...`).
- `wttr_raw_request` — raw endpoint access, including special paths and PNG output.
- `wttr_api_current` — structured current conditions.
- `wttr_api_forecast` — structured forecast data.
- `wttr_help` — full `wttr.in/:help` output.

## result profiles

MCP clients don’t always treat responses the same way, so the server supports three presentation profiles:

- `default`
- `webchat`
- `n8n`

Profile resolution order:

1. request metadata (`params._meta.resultProfile` or `params._meta.clientProfile`)
2. environment variable `WTTR_MCP_RESULT_PROFILE`
3. fallback to `default`

## weather view profiles

`wttr_weather_view` has agent-oriented defaults:

- summary-first: `auto`, `openclaw`, `webchat`, `browser`, `n8n`, `claude`
- compact ASCII: `codex`, `cursor`, `cline`, `windsurf`
- terminal ASCII with ANSI by default: `terminal`

Available views:

- `normal`
- `ascii_compact`
- `ascii_full`
- `ascii_one_line`

## quick start

```bash
npm install
npm start
```

## local examples

```bash
# readable summary
mcporter call wttr-mcp.wttr_weather_view \
  --args '{"location":"Saint Petersburg","agent":"webchat","lang":"ru"}'

# compact ASCII output
mcporter call wttr-mcp.wttr_weather_view \
  --args '{"location":"Saint Petersburg","agent":"codex","lang":"ru"}'

# structured current weather
mcporter call wttr-mcp.wttr_api_current \
  --args '{"location":"Saint Petersburg","lang":"ru"}'
```

## quality checks

```bash
npm run check:docs   # exported entities must have Args/Returns/Throws docblocks
npm test
npm run smoke
npm run ci           # check:docs + unit tests
```

Makefile equivalents:

```bash
make check-docs
make test
make ci
make smoke
```

## install helpers

The repository includes installer scripts and Make targets for common MCP hosts.

```bash
make install-openclaw-source
make install-claude-linux-source
make install-claude-mac-source
make install-cursor-source
make install-cline-vscode-source
make install-windsurf-source
make install-codex-source
```

Remote HTTP variants:

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

## docker

```bash
docker build -t markstroinyi/wttr-mcp-server:0.3.0 .
docker run --rm -i markstroinyi/wttr-mcp-server:0.3.0
```

## architecture in short

- `src/domain` — validation and API parsing.
- `src/infrastructure` — upstream wttr HTTP adapter.
- `src/application` — tool registry and weather rendering flow.
- `src/presentation` — MCP server wiring and result presentation policy.

Patterns used in production code:

- command
- adapter
- strategy + factory
- composition root

For a full walkthrough, see `docs/architecture.md` and `docs/practical-launch-targets.md`.

## license

MIT
