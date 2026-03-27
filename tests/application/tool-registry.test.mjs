import test from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry, createToolRegistry } from "../../src/application/tool-registry.mjs";

const SAMPLE_API = {
  current_condition: [
    {
      observation_time: "06:00 AM",
      temp_C: "2",
      temp_F: "36",
      FeelsLikeC: "0",
      FeelsLikeF: "32",
      humidity: "82",
      windspeedKmph: "12",
      windspeedMiles: "7",
      winddir16Point: "W",
      pressure: "1012",
      uvIndex: "1",
      weatherDesc: [{ value: "Partly cloudy" }],
      precipMM: "0",
      cloudcover: "45",
    },
  ],
  nearest_area: [{ areaName: [{ value: "Saint Petersburg" }], country: [{ value: "Russia" }] }],
  weather: [
    {
      date: "2026-03-28",
      maxtempC: "4",
      mintempC: "-1",
      avgtempC: "2",
      maxtempF: "39",
      mintempF: "30",
      avgtempF: "36",
      uvIndex: "2",
      astronomy: [{}],
      hourly: [
        {
          time: "1200",
          tempC: "3",
          tempF: "37",
          FeelsLikeC: "1",
          FeelsLikeF: "34",
          humidity: "75",
          chanceofrain: "20",
          chanceofsnow: "0",
          windspeedKmph: "10",
          winddir16Point: "W",
          weatherDesc: [{ value: "Sunny intervals" }],
        },
      ],
    },
  ],
};

class MockClient {
  buildUrl({ path, query }) {
    return `https://wttr.in/${path}?${query || ""}`;
  }

  async fetchText(url) {
    if (url.includes(":help")) {
      return { text: "help page", contentType: "text/plain" };
    }
    return { text: "weather text", contentType: "text/plain" };
  }

  async fetchJson() {
    return { json: SAMPLE_API, contentType: "application/json" };
  }

  async fetchBase64() {
    return { base64: "ZmFrZQ==", contentType: "image/png", bytes: 1234 };
  }
}

test("factory returns ToolRegistry instance", () => {
  const registry = createToolRegistry({ wttrClient: new MockClient() });
  assert.equal(registry instanceof ToolRegistry, true);
});

test("registry lists expected tools", () => {
  const registry = createToolRegistry({ wttrClient: new MockClient() });
  const tools = registry.list();

  const names = tools.map((tool) => tool.name);
  assert.deepEqual(names, [
    "wttr_site_weather",
    "wttr_weather_view",
    "wttr_raw_request",
    "wttr_api_current",
    "wttr_api_forecast",
    "wttr_help",
  ]);
});

test("registry executes known tool", async () => {
  const registry = createToolRegistry({ wttrClient: new MockClient() });
  const result = await registry.execute("wttr_api_current", { location: "Saint Petersburg" });

  assert.equal(result.ok, true);
  assert.equal(result.tool, "wttr_api_current");
  assert.equal(result.current.temperatureC, "2");
});

test("registry rejects unknown tools", async () => {
  const registry = createToolRegistry({ wttrClient: new MockClient() });
  await assert.rejects(() => registry.execute("unknown_tool"), /Unknown tool/);
});

test("default MCP result serializer emits structuredContent", () => {
  const registry = createToolRegistry({ wttrClient: new MockClient() });
  const payload = { ok: true, value: 1 };
  const mcpResult = registry.toMcpResult(payload);

  assert.equal(mcpResult.content[0].type, "text");
  assert.deepEqual(mcpResult.structuredContent, payload);
});
