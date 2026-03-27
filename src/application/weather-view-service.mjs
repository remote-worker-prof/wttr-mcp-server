import { parseCurrentFromApi, parseForecastFromApi } from "../domain/weather-parsers.mjs";
import { requireEnum, requireIntInRange, requireString } from "../domain/validation.mjs";

const UNITS = ["auto", "metric", "us"];

/**
 * Declares the supported weather rendering views.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   Frozen array of supported view identifiers.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export const WEATHER_VIEWS = Object.freeze(["normal", "ascii_compact", "ascii_full", "ascii_one_line"]);

/**
 * Defines per-agent default rendering behavior.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   Frozen map from agent profile to `{ view, ansi }` defaults.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export const AGENT_DEFAULTS = Object.freeze({
  auto: { view: "normal", ansi: false },
  openclaw: { view: "normal", ansi: false },
  webchat: { view: "normal", ansi: false },
  browser: { view: "normal", ansi: false },
  n8n: { view: "normal", ansi: false },
  claude: { view: "normal", ansi: false },
  codex: { view: "ascii_compact", ansi: false },
  cursor: { view: "ascii_compact", ansi: false },
  cline: { view: "ascii_compact", ansi: false },
  windsurf: { view: "ascii_compact", ansi: false },
  terminal: { view: "ascii_full", ansi: true },
});

/**
 * Exposes supported agent profile names.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   Frozen array of agent profile keys.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export const WEATHER_AGENTS = Object.freeze(Object.keys(AGENT_DEFAULTS));

/**
 * Validates and normalizes units input.
 *
 * Args:
 *   value: Candidate unit profile.
 *
 * Returns:
 *   Validated unit profile.
 *
 * Throws:
 *   Error: If units are not one of `auto|metric|us`.
 */
function normalizeUnits(value) {
  const units = value || "auto";
  requireEnum(units, "units", UNITS);
  return units;
}

/**
 * Removes ANSI control sequences for chat-safe output.
 *
 * Args:
 *   text: Raw text, potentially containing ANSI sequences.
 *
 * Returns:
 *   Text without ANSI escape sequences.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
function stripAnsi(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\u001B\[[0-9;]*[A-Za-z]/g, "").replace(/\u001B\][^\u0007]*\u0007/g, "");
}

/**
 * Converts value to finite number or null.
 *
 * Args:
 *   value: Candidate numeric value.
 *
 * Returns:
 *   Finite number if conversion is possible; otherwise null.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
function safeNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

/**
 * Base strategy contract for weather rendering.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   WeatherViewStrategy instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
class WeatherViewStrategy {
  /**
   * Creates a strategy descriptor.
   *
   * Args:
   *   id: Stable strategy identifier.
   *
   * Returns:
   *   WeatherViewStrategy instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor({ id }) {
    this.id = id;
  }

  /**
   * Renders weather output for a strategy.
   *
   * Args:
   *   args: Strategy-specific render arguments.
   *
   * Returns:
   *   Promise resolved with strategy output payload.
   *
   * Throws:
   *   Error: Always, because base strategy is abstract.
   */
  // eslint-disable-next-line class-methods-use-this
  async render() {
    throw new Error(`render() not implemented for strategy: ${this.id}`);
  }
}

/**
 * Strategy that produces JSON-backed readable summaries.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   NormalSummaryStrategy instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
class NormalSummaryStrategy extends WeatherViewStrategy {
  /**
   * Creates strategy for rich summary rendering.
   *
   * Args:
   *   wttrClient: wttr HTTP adapter.
   *
   * Returns:
   *   NormalSummaryStrategy instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor({ wttrClient }) {
    super({ id: "normal" });
    this.wttrClient = wttrClient;
  }

  /**
   * Produces weather summary from JSON API payload.
   *
   * Args:
   *   location: User-provided location query.
   *   lang: Optional language code.
   *   units: Unit profile.
   *   windInMps: Whether wind should be shown in m/s.
   *   acceptLanguage: Optional `Accept-Language` header.
   *   days: Forecast day count.
   *
   * Returns:
   *   Normalized summary payload with text and structured fields.
   *
   * Throws:
   *   Error: If upstream request/parsing fails.
   */
  async render({ location, lang, units, windInMps, acceptLanguage, days }) {
    const url = this.wttrClient.buildUrl({
      path: location,
      query: "format=j1",
      lang,
      units,
      windInMps,
    });

    const { json: apiData, contentType } = await this.wttrClient.fetchJson(url, { acceptLanguage });
    const current = parseCurrentFromApi(apiData);
    const nearest = apiData?.nearest_area?.[0] || null;
    const forecast = parseForecastFromApi(apiData, days);

    const areaName = nearest?.areaName?.[0]?.value || location;
    const country = nearest?.country?.[0]?.value || "";
    const place = country ? `${areaName}, ${country}` : areaName;

    const windValue = windInMps
      ? `${Math.round((safeNumber(current.windKmph) || 0) / 3.6)} m/s`
      : `${current.windKmph} km/h`;

    const lines = [
      `Weather: ${place}`,
      `Now: ${current.condition}, ${current.temperatureC}°C (feels ${current.feelsLikeC}°C)`,
      `Humidity: ${current.humidity}% | Wind: ${current.windDirection} ${windValue} | Pressure: ${current.pressure} hPa`,
      "",
      `Forecast (${forecast.length} day${forecast.length === 1 ? "" : "s"}):`,
    ];

    // Extract peak rain probability so the summary keeps worst-case risk visible.
    for (const day of forecast) {
      const midday = day.hourly?.find((hourlyEntry) => hourlyEntry.time === "1200") || day.hourly?.[0] || null;
      const maxRain = Math.max(...(day.hourly || []).map((hourlyEntry) => safeNumber(hourlyEntry.chanceOfRain) || 0));
      lines.push(
        `- ${day.date}: ${day.minTempC}..${day.maxTempC}°C, ${midday?.condition || "n/a"}, rain up to ${maxRain}%`,
      );
    }

    return {
      view: this.id,
      outputType: "text",
      contentType,
      urls: [url],
      text: lines.join("\n").trim(),
      current,
      forecast,
      place,
    };
  }
}

/**
 * Strategy that proxies wttr native ASCII modes.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   AsciiSiteStrategy instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
class AsciiSiteStrategy extends WeatherViewStrategy {
  /**
   * Creates strategy for a specific wttr ASCII mode.
   *
   * Args:
   *   id: Stable strategy identifier.
   *   mode: wttr mode string (`1|2|3` etc).
   *   wttrClient: wttr HTTP adapter.
   *
   * Returns:
   *   AsciiSiteStrategy instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor({ id, mode, wttrClient }) {
    super({ id });
    this.mode = mode;
    this.wttrClient = wttrClient;
  }

  /**
   * Produces ASCII weather view output.
   *
   * Args:
   *   location: User-provided location query.
   *   lang: Optional language code.
   *   units: Unit profile.
   *   windInMps: Whether wind should be shown in m/s.
   *   acceptLanguage: Optional `Accept-Language` header.
   *   ansi: Whether ANSI sequences must be preserved.
   *
   * Returns:
   *   ASCII payload normalized for the target client profile.
   *
   * Throws:
   *   Error: If upstream request fails.
   */
  async render({ location, lang, units, windInMps, acceptLanguage, ansi }) {
    const url = this.wttrClient.buildUrl({
      path: location,
      query: this.mode,
      lang,
      units,
      windInMps,
    });

    const { text, contentType } = await this.wttrClient.fetchText(url, { acceptLanguage });
    const normalized = ansi ? text.trim() : stripAnsi(text).trim();

    return {
      view: this.id,
      outputType: "text",
      contentType,
      urls: [url],
      text: normalized,
    };
  }
}

/**
 * Factory for weather view strategies.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   WeatherViewStrategyFactory instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
class WeatherViewStrategyFactory {
  /**
   * Indexes strategies by id.
   *
   * Args:
   *   strategies: List of instantiated strategy objects.
   *
   * Returns:
   *   WeatherViewStrategyFactory instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor(strategies) {
    this.byId = new Map(strategies.map((strategy) => [strategy.id, strategy]));
  }

  /**
   * Resolves strategy by identifier.
   *
   * Args:
   *   id: Requested view identifier.
   *
   * Returns:
   *   Strategy instance.
   *
   * Throws:
   *   Error: If strategy id is not registered.
   */
  get(id) {
    const strategy = this.byId.get(id);
    if (!strategy) {
      throw new Error(`view must be one of: ${Array.from(this.byId.keys()).join(", ")}`);
    }
    return strategy;
  }
}

/**
 * Resolves effective view options from profile defaults and overrides.
 *
 * Args:
 *   agent: Optional agent profile.
 *   view: Optional explicit view override.
 *   ansi: Optional explicit ANSI override.
 *
 * Returns:
 *   Resolved `{ agent, view, ansi }` tuple.
 *
 * Throws:
 *   Error: If agent or view values are invalid.
 */
function resolveViewOptions({ agent, view, ansi }) {
  const selectedAgent = agent || "auto";
  requireEnum(selectedAgent, "agent", WEATHER_AGENTS);

  const defaults = AGENT_DEFAULTS[selectedAgent];
  const selectedView = view || defaults.view;
  requireEnum(selectedView, "view", WEATHER_VIEWS);

  const selectedAnsi = typeof ansi === "boolean" ? ansi : defaults.ansi;

  return {
    agent: selectedAgent,
    view: selectedView,
    ansi: selectedAnsi,
  };
}

/**
 * OOP facade for weather rendering pipeline.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   WeatherViewService instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export class WeatherViewService {
  /**
   * Creates weather rendering service.
   *
   * Args:
   *   wttrClient: wttr HTTP adapter.
   *
   * Returns:
   *   WeatherViewService instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor({ wttrClient }) {
    this.factory = new WeatherViewStrategyFactory([
      new NormalSummaryStrategy({ wttrClient }),
      new AsciiSiteStrategy({ id: "ascii_compact", mode: "3", wttrClient }),
      new AsciiSiteStrategy({ id: "ascii_full", mode: "2", wttrClient }),
      new AsciiSiteStrategy({ id: "ascii_one_line", mode: "1", wttrClient }),
    ]);
  }

  /**
   * Renders weather payload according to requested profile and view.
   *
   * Args:
   *   args: Command arguments from MCP tool call.
   *
   * Returns:
   *   Normalized weather view payload.
   *
   * Throws:
   *   Error: If validation fails or upstream request fails.
   */
  async render(args = {}) {
    requireString(args.location, "location");
    const units = normalizeUnits(args.units);
    const days = args.days ?? 2;
    requireIntInRange(days, "days", 1, 3);

    const selected = resolveViewOptions({
      agent: args.agent,
      view: args.view,
      ansi: args.ansi,
    });

    const strategy = this.factory.get(selected.view);
    const result = await strategy.render({
      location: args.location,
      lang: args.lang,
      units,
      windInMps: Boolean(args.windInMps),
      acceptLanguage: args.acceptLanguage,
      days,
      ansi: selected.ansi,
    });

    return {
      ok: true,
      tool: "wttr_weather_view",
      profile: selected.agent,
      view: selected.view,
      ansi: selected.ansi,
      ...result,
    };
  }
}

/**
 * Creates weather rendering service with strategy-based policies.
 *
 * Args:
 *   wttrClient: wttr HTTP adapter.
 *
 * Returns:
 *   WeatherViewService instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export function createWeatherViewService({ wttrClient }) {
  return new WeatherViewService({ wttrClient });
}
