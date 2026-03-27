import { parseCurrentFromApi, parseForecastFromApi } from "../domain/weather-parsers.mjs";
import { requireEnum, requireIntInRange, requireString } from "../domain/validation.mjs";

const UNITS = ["auto", "metric", "us"];

export const WEATHER_VIEWS = Object.freeze(["normal", "ascii_compact", "ascii_full", "ascii_one_line"]);

export const AGENT_DEFAULTS = Object.freeze({
  auto: { view: "normal", ansi: false },
  openclaw: { view: "normal", ansi: false },
  claude: { view: "normal", ansi: false },
  codex: { view: "ascii_compact", ansi: false },
  cursor: { view: "ascii_compact", ansi: false },
  cline: { view: "ascii_compact", ansi: false },
  windsurf: { view: "ascii_compact", ansi: false },
  terminal: { view: "ascii_full", ansi: true },
});

export const WEATHER_AGENTS = Object.freeze(Object.keys(AGENT_DEFAULTS));

function normalizeUnits(value) {
  const units = value || "auto";
  requireEnum(units, "units", UNITS);
  return units;
}

function stripAnsi(text) {
  if (typeof text !== "string") return "";
  // Basic ANSI color/control cleanup for agent-friendly output.
  return text.replace(/\u001B\[[0-9;]*[A-Za-z]/g, "").replace(/\u001B\][^\u0007]*\u0007/g, "");
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

class WeatherViewStrategy {
  constructor({ id }) {
    this.id = id;
  }

  // eslint-disable-next-line class-methods-use-this
  async render() {
    throw new Error(`render() not implemented for strategy: ${this.id}`);
  }
}

class NormalSummaryStrategy extends WeatherViewStrategy {
  constructor({ wttrClient }) {
    super({ id: "normal" });
    this.wttrClient = wttrClient;
  }

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

    for (const day of forecast) {
      const midday = day.hourly?.find((h) => h.time === "1200") || day.hourly?.[0] || null;
      const maxRain = Math.max(...(day.hourly || []).map((h) => safeNumber(h.chanceOfRain) || 0));
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
    };
  }
}

class AsciiSiteStrategy extends WeatherViewStrategy {
  constructor({ id, mode, wttrClient }) {
    super({ id });
    this.mode = mode;
    this.wttrClient = wttrClient;
  }

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

class WeatherViewStrategyFactory {
  constructor(strategies) {
    this.byId = new Map(strategies.map((s) => [s.id, s]));
  }

  get(id) {
    const strategy = this.byId.get(id);
    if (!strategy) {
      throw new Error(`view must be one of: ${Array.from(this.byId.keys()).join(", ")}`);
    }
    return strategy;
  }
}

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

export function createWeatherViewService({ wttrClient }) {
  const factory = new WeatherViewStrategyFactory([
    new NormalSummaryStrategy({ wttrClient }),
    new AsciiSiteStrategy({ id: "ascii_compact", mode: "3", wttrClient }),
    new AsciiSiteStrategy({ id: "ascii_full", mode: "2", wttrClient }),
    new AsciiSiteStrategy({ id: "ascii_one_line", mode: "1", wttrClient }),
  ]);

  return {
    render: async (args = {}) => {
      requireString(args.location, "location");
      const units = normalizeUnits(args.units);
      const days = args.days ?? 2;
      requireIntInRange(days, "days", 1, 3);

      const selected = resolveViewOptions({
        agent: args.agent,
        view: args.view,
        ansi: args.ansi,
      });

      const strategy = factory.get(selected.view);
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
    },
  };
}
