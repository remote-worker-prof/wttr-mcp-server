import { parseCurrentFromApi, parseForecastFromApi } from "../domain/weather-parsers.mjs";
import { requireEnum, requireIntInRange, requireString } from "../domain/validation.mjs";
import { WEATHER_AGENTS, WEATHER_VIEWS, createWeatherViewService } from "./weather-view-service.mjs";

const UNITS = ["auto", "metric", "us"];
const RESPONSE_TYPES = ["text", "json", "base64"];

function normalizeUnits(value) {
  const units = value || "auto";
  requireEnum(units, "units", UNITS);
  return units;
}

function toMcpResult(value) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

function toMcpError(error, code = "UPSTREAM") {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            ok: false,
            error: {
              code,
              message: error?.message || String(error),
            },
          },
          null,
          2,
        ),
      },
    ],
  };
}

export function createToolRegistry({ wttrClient }) {
  const weatherViewService = createWeatherViewService({ wttrClient });

  const tools = [
    {
      name: "wttr_site_weather",
      description:
        "Convenience weather lookup for wttr.in website output. Supports short modes (3/0/1/2/v2/0pq) and custom format strings.",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City/region/airport/domain/GPS, e.g. 'Saint Petersburg'" },
          mode: {
            type: "string",
            description:
              "wttr mode. Examples: '3', '0', '1', '2', 'v2', '0pq'. For custom format strings start with '%' (e.g. '%l:+%c+%t').",
            default: "3",
          },
          lang: { type: "string", description: "Optional language code, e.g. 'ru'" },
          units: { type: "string", enum: UNITS, default: "auto" },
          windInMps: { type: "boolean", default: false },
          acceptLanguage: { type: "string", description: "Optional Accept-Language header" },
        },
        required: ["location"],
      },
      execute: async (args = {}) => {
        requireString(args.location, "location");
        const units = normalizeUnits(args.units);
        const mode = typeof args.mode === "string" && args.mode.trim() ? args.mode.trim() : "3";
        const query = mode.startsWith("%") ? `format=${encodeURIComponent(mode)}` : mode;

        const url = wttrClient.buildUrl({
          path: args.location,
          query,
          lang: args.lang,
          units,
          windInMps: Boolean(args.windInMps),
        });

        const { text, contentType } = await wttrClient.fetchText(url, { acceptLanguage: args.acceptLanguage });

        return {
          ok: true,
          tool: "wttr_site_weather",
          url,
          contentType,
          weather: text.trim(),
        };
      },
    },
    {
      name: "wttr_weather_view",
      description:
        "Human-friendly weather view with agent-specific defaults and ASCII variants (Strategy + Factory pattern).",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City/region/airport/domain/GPS, e.g. 'Saint Petersburg'" },
          agent: {
            type: "string",
            enum: WEATHER_AGENTS,
            default: "auto",
            description: "Agent profile that sets sensible defaults for weather output format.",
          },
          view: {
            type: "string",
            enum: WEATHER_VIEWS,
            description: "Optional explicit view override.",
          },
          ansi: {
            type: "boolean",
            description: "Force ANSI color preservation/removal for ASCII views. Defaults come from agent profile.",
          },
          days: { type: "integer", minimum: 1, maximum: 3, default: 2 },
          lang: { type: "string", description: "Optional language code, e.g. 'ru'" },
          units: { type: "string", enum: UNITS, default: "auto" },
          windInMps: { type: "boolean", default: false },
          acceptLanguage: { type: "string", description: "Optional Accept-Language header" },
        },
        required: ["location"],
      },
      execute: async (args = {}) => weatherViewService.render(args),
    },
    {
      name: "wttr_raw_request",
      description:
        "Raw wttr.in endpoint access (covers ALL help-page capabilities: moon, PNG, special URLs, combined options, localization).",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Raw path after host. Examples: 'Paris', 'moon', 'moon@2016-10-25', ':help', ':bash.function', ':translation', 'Paris.png', 'Paris_0pq.png'.",
            default: "",
          },
          query: {
            type: "string",
            description:
              "Raw query WITHOUT leading '?'. Examples: '0pq', '0pq&lang=fr', 'format=j1', 'transparency=150&background=00aaaa'.",
          },
          lang: { type: "string", description: "Optional lang query parameter" },
          units: { type: "string", enum: UNITS, default: "auto" },
          windInMps: { type: "boolean", default: false },
          acceptLanguage: { type: "string", description: "Optional Accept-Language header" },
          responseType: { type: "string", enum: RESPONSE_TYPES, default: "text" },
        },
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const units = normalizeUnits(args.units);
        const responseType = args.responseType || "text";
        requireEnum(responseType, "responseType", RESPONSE_TYPES);

        const url = wttrClient.buildUrl({
          path: args.path || "",
          query: args.query,
          lang: args.lang,
          units,
          windInMps: Boolean(args.windInMps),
        });

        if (responseType === "json") {
          const { json, contentType } = await wttrClient.fetchJson(url, { acceptLanguage: args.acceptLanguage });
          return { ok: true, tool: "wttr_raw_request", url, contentType, data: json };
        }

        if (responseType === "base64") {
          const { base64, contentType, bytes } = await wttrClient.fetchBase64(url, {
            acceptLanguage: args.acceptLanguage,
          });
          return { ok: true, tool: "wttr_raw_request", url, contentType, bytes, base64 };
        }

        const { text, contentType } = await wttrClient.fetchText(url, { acceptLanguage: args.acceptLanguage });
        return { ok: true, tool: "wttr_raw_request", url, contentType, text };
      },
    },
    {
      name: "wttr_api_current",
      description: "Get structured current weather from wttr JSON API (format=j1).",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City/region/airport/domain/GPS" },
          lang: { type: "string", description: "Optional language code, e.g. 'ru'" },
          units: { type: "string", enum: UNITS, default: "auto" },
          windInMps: { type: "boolean", default: false },
          acceptLanguage: { type: "string", description: "Optional Accept-Language header" },
        },
        required: ["location"],
      },
      execute: async (args = {}) => {
        requireString(args.location, "location");
        const units = normalizeUnits(args.units);

        const url = wttrClient.buildUrl({
          path: args.location,
          query: "format=j1",
          lang: args.lang,
          units,
          windInMps: Boolean(args.windInMps),
        });

        const { json: apiData, contentType } = await wttrClient.fetchJson(url, { acceptLanguage: args.acceptLanguage });

        return {
          ok: true,
          tool: "wttr_api_current",
          url,
          contentType,
          current: parseCurrentFromApi(apiData),
          nearestArea: apiData?.nearest_area?.[0] || null,
        };
      },
    },
    {
      name: "wttr_api_forecast",
      description: "Get structured forecast (1..3 days) from wttr JSON API (format=j1).",
      inputSchema: {
        type: "object",
        properties: {
          location: { type: "string", description: "City/region/airport/domain/GPS" },
          days: { type: "integer", minimum: 1, maximum: 3, default: 3 },
          lang: { type: "string", description: "Optional language code, e.g. 'ru'" },
          units: { type: "string", enum: UNITS, default: "auto" },
          windInMps: { type: "boolean", default: false },
          acceptLanguage: { type: "string", description: "Optional Accept-Language header" },
        },
        required: ["location"],
      },
      execute: async (args = {}) => {
        requireString(args.location, "location");
        const days = args.days ?? 3;
        requireIntInRange(days, "days", 1, 3);
        const units = normalizeUnits(args.units);

        const url = wttrClient.buildUrl({
          path: args.location,
          query: "format=j1",
          lang: args.lang,
          units,
          windInMps: Boolean(args.windInMps),
        });

        const { json: apiData, contentType } = await wttrClient.fetchJson(url, { acceptLanguage: args.acceptLanguage });

        return {
          ok: true,
          tool: "wttr_api_forecast",
          url,
          contentType,
          forecast: parseForecastFromApi(apiData, days),
          nearestArea: apiData?.nearest_area?.[0] || null,
        };
      },
    },
    {
      name: "wttr_help",
      description: "Return wttr.in help page with supported location formats and query options.",
      inputSchema: {
        type: "object",
        properties: {
          lang: { type: "string", description: "Optional language code, e.g. 'ru'" },
          acceptLanguage: { type: "string", description: "Optional Accept-Language header" },
        },
        additionalProperties: false,
      },
      execute: async (args = {}) => {
        const url = wttrClient.buildUrl({ path: ":help", lang: args.lang });
        const { text, contentType } = await wttrClient.fetchText(url, { acceptLanguage: args.acceptLanguage });

        return {
          ok: true,
          tool: "wttr_help",
          url,
          contentType,
          help: text,
        };
      },
    },
  ];

  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  return {
    list: () => tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    execute: async (name, args = {}) => {
      const command = byName.get(name);
      if (!command) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return command.execute(args);
    },
    toMcpResult,
    toMcpError,
  };
}
