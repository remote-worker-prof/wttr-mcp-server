import test from "node:test";
import assert from "node:assert/strict";
import { WeatherViewService, createWeatherViewService } from "../../src/application/weather-view-service.mjs";

const SAMPLE_API = {
  current_condition: [
    {
      observation_time: "06:00 AM",
      temp_C: "1",
      temp_F: "34",
      FeelsLikeC: "-2",
      FeelsLikeF: "28",
      humidity: "86",
      windspeedKmph: "18",
      windspeedMiles: "11",
      winddir16Point: "NW",
      pressure: "1008",
      uvIndex: "1",
      weatherDesc: [{ value: "Cloudy" }],
      precipMM: "0.1",
      cloudcover: "80",
    },
  ],
  nearest_area: [
    {
      areaName: [{ value: "New Holland" }],
      country: [{ value: "Russia" }],
    },
  ],
  weather: [
    {
      date: "2026-03-28",
      maxtempC: "3",
      mintempC: "-1",
      avgtempC: "1",
      maxtempF: "37",
      mintempF: "30",
      avgtempF: "34",
      uvIndex: "1",
      astronomy: [{}],
      hourly: [
        {
          time: "1200",
          tempC: "2",
          tempF: "36",
          FeelsLikeC: "-1",
          FeelsLikeF: "30",
          humidity: "80",
          chanceofrain: "45",
          chanceofsnow: "0",
          windspeedKmph: "20",
          winddir16Point: "NW",
          weatherDesc: [{ value: "Light rain" }],
        },
      ],
    },
  ],
};

class MockWttrClient {
  buildUrl({ path, query }) {
    return `https://wttr.in/${path}?${query || ""}`;
  }

  async fetchJson() {
    return { json: SAMPLE_API, contentType: "application/json" };
  }

  async fetchText(url) {
    if (url.includes("?3")) {
      return {
        text: "🌤️ Погода: Санкт-Петербург\n+1°C\nОщущается как -1°C",
        contentType: "text/plain",
      };
    }

    return {
      text: "\u001b[38;5;39mASCII FULL\u001b[0m",
      contentType: "text/plain",
    };
  }
}

test("factory returns WeatherViewService instance", () => {
  const service = createWeatherViewService({ wttrClient: new MockWttrClient() });
  assert.equal(service instanceof WeatherViewService, true);
});

test("normal view returns localized, emoji-rich summary payload", async () => {
  const service = createWeatherViewService({ wttrClient: new MockWttrClient() });
  const result = await service.render({ location: "Saint Petersburg", agent: "openclaw", days: 1 });

  assert.equal(result.ok, true);
  assert.equal(result.view, "normal");
  assert.match(result.text, /📍 Location: Saint Petersburg \(nearest area: New Holland, Russia\)/);
  assert.match(result.text, /📅 Forecast/);
  assert.match(result.text, /☁️ Now: Cloudy/);
  assert.equal(result.current.condition, "Cloudy");
  assert.equal(result.forecast.length, 1);
  assert.equal(result.locale, "en");
});

test("ru locale applies russian labels and translated condition", async () => {
  const service = createWeatherViewService({ wttrClient: new MockWttrClient() });
  const result = await service.render({
    location: "Санкт-Петербург",
    agent: "openclaw",
    days: 1,
    lang: "ru",
  });

  assert.equal(result.locale, "ru");
  assert.match(result.text, /📍 Локация:/);
  assert.match(result.text, /☁️ Сейчас: Облачно/);
  assert.match(result.text, /📅 Прогноз/);
});

test("nativeSite mode returns wttr site-localized text", async () => {
  const service = createWeatherViewService({ wttrClient: new MockWttrClient() });
  const result = await service.render({
    location: "Санкт-Петербург",
    agent: "openclaw",
    days: 2,
    lang: "ru",
    nativeSite: true,
  });

  assert.equal(result.nativeSite, true);
  assert.match(result.text, /Погода: Санкт-Петербург/);
  assert.equal(result.current, null);
  assert.equal(result.forecast.length, 0);
});

test("codex profile defaults to ascii_compact without ANSI", async () => {
  const service = createWeatherViewService({ wttrClient: new MockWttrClient() });
  const result = await service.render({ location: "Saint Petersburg", agent: "codex" });

  assert.equal(result.view, "ascii_compact");
  assert.equal(result.ansi, false);
  assert.doesNotMatch(result.text, /\u001b\[/);
});

test("terminal profile keeps ANSI unless explicitly disabled", async () => {
  const service = createWeatherViewService({ wttrClient: new MockWttrClient() });
  const result = await service.render({ location: "Saint Petersburg", agent: "terminal", view: "ascii_full" });

  assert.equal(result.view, "ascii_full");
  assert.equal(result.ansi, true);
  assert.match(result.text, /\u001b\[/);
});

test("invalid view is rejected", async () => {
  const service = createWeatherViewService({ wttrClient: new MockWttrClient() });

  await assert.rejects(
    () => service.render({ location: "Saint Petersburg", agent: "openclaw", view: "invalid" }),
    /view must be one of/,
  );
});
