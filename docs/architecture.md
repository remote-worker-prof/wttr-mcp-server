# Architecture Notes

This document is intentionally written as a guided walkthrough: a new engineer
should be able to open it, then navigate the codebase without guessing.

## 1) Mental model in one sentence

`wttr-mcp-server` is a layered MCP adapter:

- **presentation** speaks MCP,
- **application** orchestrates commands,
- **domain** normalizes data,
- **infrastructure** talks to `wttr.in`.

If a change crosses layers, it should cross through explicit interfaces.

---

## 2) Design goals

1. **Predictable behavior across MCP clients** (OpenClaw, Codex, Cursor, Windsurf, n8n).
2. **Explicit separation of concerns** so compatibility patches do not leak into domain logic.
3. **Pedagogical readability**: classes and comments should explain not only *what*, but *why*.
4. **Low-friction operations**: easy local run, Docker run, and config installers.

---

## 3) Layered structure (what lives where)

### `src/domain`

Purpose: pure transformations and validation.

- `validation.mjs`: guardrails for primitives (`requireString`, ranges, enums).
- `weather-parsers.mjs`: maps raw wttr JSON keys to stable internal field names.

Rule: domain code does not know about MCP request objects or HTTP headers.

### `src/infrastructure`

Purpose: external IO integration.

- `wttr-client.mjs`: URL composition, request headers, response decoding (`text/json/base64`).

Rule: infrastructure code knows upstream quirks; upper layers should not.

### `src/application`

Purpose: use-case orchestration.

- `tool-registry.mjs`: command descriptors + dispatch + MCP serialization helpers.
- `weather-view-service.mjs`: profile/view resolution + strategy-based rendering pipeline.

Rule: application code composes domain + infrastructure, but never owns protocol glue.

### `src/presentation`

Purpose: MCP protocol glue.

- `mcp-server.mjs`: request handlers, composition root.
- `result-presenter.mjs`: profile-aware result rendering strategy.

Rule: presentation knows MCP envelopes; domain/application do not.

---

## 4) Patterns in use (and where)

## 4.1 Command pattern

Location: `src/application/tool-registry.mjs`

Each tool is represented as a command descriptor:

- `name`
- `description`
- `inputSchema`
- `execute(args)`

Why: adding a new tool becomes additive (new descriptor), not invasive (no giant switch-case edits).

## 4.2 Adapter pattern

Location: `src/infrastructure/wttr-client.mjs`

`WttrClient` encapsulates:

- URL rules (`path`, `query`, units, language, wind flags),
- header policy,
- response decoding.

Why: upstream API changes are localized to one file.

## 4.3 Strategy + Factory (weather rendering)

Location: `src/application/weather-view-service.mjs`

Strategies:

- `NormalSummaryStrategy`
- `AsciiSiteStrategy` variants (`ascii_compact`, `ascii_full`, `ascii_one_line`)

Factory chooses strategy by resolved view.

Why: supports multiple output styles without branching spaghetti in one method.

## 4.4 Strategy + Factory (result presentation)

Location: `src/presentation/result-presenter.mjs`

Profiles:

- `default`
- `webchat`
- `n8n`

Why: different clients consume MCP outputs differently; profile-specific text formatting stays isolated.

## 4.5 Composition root

Location: `src/presentation/mcp-server.mjs`

`createWttrMcpServer()` wires concrete implementations once:

1. `WttrClient`
2. `ResultPresenter`
3. `ToolRegistry`
4. MCP handlers

Why: dependency graph is visible and testable.

---

## 5) Request lifecycle (step-by-step)

A single `tools/call` request follows this path:

1. **Presentation** receives request (`mcp-server.mjs`).
2. Presentation calls `registry.execute(name, args)`.
3. **Application** resolves command descriptor by `name`.
4. Command validates input and calls service/client.
5. **Infrastructure** performs wttr HTTP call if needed.
6. **Domain** parsers normalize raw API payload.
7. Application returns normalized payload.
8. Presentation selects result profile and serializes MCP response.

This flow is intentionally linear so logs and tests are easy to align with runtime behavior.

---

## 6) Error model

Errors are normalized into explicit machine-readable categories:

- `VALIDATION`: bad input / unknown tool / schema mismatch.
- `UPSTREAM`: wttr HTTP failures and runtime IO failures.

Why: automation clients can branch reliably on error code, not fragile text matching.

---

## 7) Why this architecture scales

- New tool? Add one command descriptor.
- New rendering style? Add one strategy.
- New client output profile? Add one presenter strategy.
- Upstream API change? Patch one adapter/parsing area.

That is the core scalability property: **local changes stay local**.

---

## 8) Where to start reading the code

For onboarding, read in this order:

1. `src/presentation/mcp-server.mjs` (entry protocol flow)
2. `src/application/tool-registry.mjs` (command map)
3. `src/application/weather-view-service.mjs` (core use-case logic)
4. `src/infrastructure/wttr-client.mjs` (external IO details)
5. `src/domain/weather-parsers.mjs` (data normalization)

Then run:

```bash
npm run ci
npm run smoke
```

This gives both static confidence and real end-to-end validation.
