# Architecture Notes (Fowler-oriented)

## Why this structure

The codebase follows a layered split inspired by Martin Fowler's style of keeping domain logic isolated and minimizing coupling to transport and infrastructure.

- **Presentation layer** (`src/presentation`): MCP protocol handlers
- **Application layer** (`src/application`): use-case orchestration and command dispatch
- **Domain layer** (`src/domain`): pure business rules and transformations
- **Infrastructure layer** (`src/infrastructure`): external IO (wttr HTTP)

## Refactoring principles applied

- **Extract Function / Extract Module**: parsing, validation, transport, and IO are separated
- **Move Function**: HTTP concerns moved to `WttrClient`
- **Replace Conditional with Polymorphism-like dispatch**: command registry map by tool name
- **Encapsulate External System**: wttr endpoint behavior hidden behind adapter

## Design patterns in use

1. **Command Pattern**
   - Each tool defines `{name, description, inputSchema, execute}`
   - `execute(name, args)` resolves and runs command

2. **Adapter Pattern**
   - `WttrClient` adapts wttr quirks (query flags, headers, content types)

3. **Factory / Composition Root**
   - `createWttrMcpServer()` assembles dependencies and handlers in one place

4. **Strategy + Factory (weather views)**
   - `createWeatherViewService()` resolves an output strategy by `agent`/`view`
   - Strategies: `normal`, `ascii_compact`, `ascii_full`, `ascii_one_line`
   - This keeps formatting policies separate from transport and raw fetching

5. **DTO-style response objects**
   - Tool responses are explicit plain objects for stable MCP payloads
