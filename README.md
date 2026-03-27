# wttr-mcp-server

MCP server for `wttr.in` (site + JSON API), with full help-page feature coverage.

## Features

- `wttr_site_weather` — convenience weather lookup (`3/0/1/2/v2/0pq` or custom `%...` format)
- `wttr_raw_request` — raw wttr endpoint access (moon, PNG, special URLs, combined options)
- `wttr_api_current` — structured current weather from `format=j1`
- `wttr_api_forecast` — structured 1–3 day forecast from `format=j1`
- `wttr_help` — full `wttr.in/:help`

## Design & Fowler-style structure

Project uses layered, refactoring-friendly architecture:

- `src/domain/*` — pure domain logic (validation, parsers)
- `src/infrastructure/*` — API adapter (`WttrClient`)
- `src/application/*` — command registry + orchestration (Command pattern)
- `src/presentation/*` — MCP transport wiring

Patterns used:
- **Command**: each MCP tool is a command object in registry
- **Adapter**: `WttrClient` isolates wttr HTTP specifics
- **Factory/Composition Root**: server is assembled in one place
- **Separated Layers** (Fowler style): domain/application/infrastructure/presentation split

## Run locally

```bash
npm install
npm start
```

## Docker

```bash
docker build -t markstroinyi/wttr-mcp-server:0.3.0 .
docker run --rm -i markstroinyi/wttr-mcp-server:0.3.0
```

## MCP config example

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

## License

MIT
