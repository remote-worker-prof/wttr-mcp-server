const DEFAULT_BASE_URL = "https://wttr.in";
const DEFAULT_UA = "curl/8.8.0 wttr-mcp/0.3.0 (+https://wttr.in)";

function normalizePath(path = "") {
  const raw = String(path ?? "").trim();
  if (!raw) return "";
  const noLeadingSlash = raw.replace(/^\/+/, "");
  return `/${encodeURI(noLeadingSlash)}`;
}

function buildQuery({ query, lang, units, windInMps }) {
  const queryParts = [];

  if (typeof query === "string" && query.trim()) {
    queryParts.push(query.trim().replace(/^\?/, ""));
  }

  if (lang) queryParts.push(`lang=${encodeURIComponent(lang)}`);
  if (units === "metric") queryParts.push("m");
  if (units === "us") queryParts.push("u");
  if (windInMps) queryParts.push("M");

  return queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
}

export class WttrClient {
  constructor({ baseUrl = process.env.WTTR_BASE_URL || DEFAULT_BASE_URL, fetchImpl = fetch } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  buildUrl({ path = "", query, lang, units, windInMps }) {
    return `${this.baseUrl}${normalizePath(path)}${buildQuery({ query, lang, units, windInMps })}`;
  }

  async #request(url, { acceptLanguage, accept }) {
    const response = await this.fetchImpl(url, {
      headers: {
        "User-Agent": DEFAULT_UA,
        Accept: accept,
        ...(acceptLanguage ? { "Accept-Language": acceptLanguage } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`wttr request failed: HTTP ${response.status}`);
    }

    return response;
  }

  async fetchText(url, { acceptLanguage } = {}) {
    const response = await this.#request(url, {
      acceptLanguage,
      accept: "text/plain,application/json;q=0.9,*/*;q=0.8",
    });

    return {
      text: await response.text(),
      contentType: response.headers.get("content-type") || null,
    };
  }

  async fetchJson(url, { acceptLanguage } = {}) {
    const { text, contentType } = await this.fetchText(url, { acceptLanguage });
    try {
      return {
        json: JSON.parse(text),
        contentType,
      };
    } catch {
      throw new Error("wttr returned non-JSON content for JSON request");
    }
  }

  async fetchBase64(url, { acceptLanguage } = {}) {
    const response = await this.#request(url, {
      acceptLanguage,
      accept: "image/png,*/*;q=0.8",
    });

    const arrayBuffer = await response.arrayBuffer();

    return {
      base64: Buffer.from(arrayBuffer).toString("base64"),
      contentType: response.headers.get("content-type") || null,
      bytes: Number(response.headers.get("content-length") || 0) || arrayBuffer.byteLength,
    };
  }
}
