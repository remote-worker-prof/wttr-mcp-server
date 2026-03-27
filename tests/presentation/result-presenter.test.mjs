import test from "node:test";
import assert from "node:assert/strict";
import { ResultPresenter, createResultPresenter } from "../../src/presentation/result-presenter.mjs";

test("factory returns ResultPresenter instance", () => {
  const presenter = createResultPresenter({ defaultProfile: "default" });
  assert.equal(presenter instanceof ResultPresenter, true);
});

test("default profile emits pretty JSON text and structuredContent", () => {
  const presenter = createResultPresenter({ defaultProfile: "default" });
  const result = presenter.present({ ok: true, value: 42 });

  assert.equal(result.content[0].type, "text");
  assert.match(result.content[0].text, /"ok": true/);
  assert.deepEqual(result.structuredContent, { ok: true, value: 42 });
});

test("webchat profile prefers text field for chat readability", () => {
  const presenter = createResultPresenter({ defaultProfile: "default" });
  const result = presenter.present(
    { ok: true, text: "Weather: Saint Petersburg\nNow: Cloudy" },
    { profile: "webchat" },
  );

  assert.equal(result.content[0].text, "Weather: Saint Petersburg\nNow: Cloudy");
  assert.equal(result.structuredContent.ok, true);
});

test("n8n profile emits compact JSON in content text", () => {
  const presenter = createResultPresenter({ defaultProfile: "default" });
  const result = presenter.present({ ok: true, nested: { a: 1 } }, { profile: "n8n" });

  assert.equal(result.content[0].text, '{"ok":true,"nested":{"a":1}}');
  assert.deepEqual(result.structuredContent, { ok: true, nested: { a: 1 } });
});

test("invalid profile throws validation error", () => {
  const presenter = createResultPresenter({ defaultProfile: "default" });

  assert.throws(() => presenter.present({ ok: true }, { profile: "unknown" }), /profile must be one of/);
});
