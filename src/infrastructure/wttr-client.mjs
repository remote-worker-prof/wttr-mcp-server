const DEFAULT_BASE_URL = "https://wttr.in";
const DEFAULT_UA = "curl/8.8.0 wttr-mcp/0.3.0 (+https://wttr.in)";

/**
 * Normalizes a wttr path segment.
 *
 * Args:
 *   path: Raw location/path fragment.
 *
 * Returns:
 *   URL-safe path prefixed with `/`, or empty string.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
function normalizePath(path = "") {
  const raw = String(path ?? "").trim();
  if (!raw) return "";
  const noLeadingSlash = raw.replace(/^\/+/, "");
  return `/${encodeURI(noLeadingSlash)}`;
}

/**
 * Builds wttr query string from logical flags.
 *
 * Args:
 *   query: Raw query segment without guarantees about leading `?`.
 *   lang: Optional language code.
 *   units: Unit profile (`auto|metric|us`).
 *   windInMps: Whether to request m/s wind units.
 *
 * Returns:
 *   Encoded query string including leading `?`, or empty string.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
function buildQuery({ query, lang, units, windInMps }) {
  const queryParts = [];

  // Preserve raw query segment first so power users can pass wttr custom options.
  if (typeof query === "string" && query.trim()) {
    queryParts.push(query.trim().replace(/^\?/, ""));
  }

  // Append normalized flags in deterministic order for predictable URL snapshots.
  if (lang) queryParts.push(`lang=${encodeURIComponent(lang)}`);
  if (units === "metric") queryParts.push("m");
  if (units === "us") queryParts.push("u");
  if (windInMps) queryParts.push("M");

  return queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
}

/**
 * Adapter around wttr.in HTTP behavior.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   WttrClient instance exposing URL builders and fetch helpers.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 *
 * Responsibilities:
 * - URL composition for path/query/unit/lang flags.
 * - Content negotiation and response decoding.
 * - Stable error contract for upstream failures.
 */
export class WttrClient {
  /**
   * Creates a wttr HTTP adapter.
   *
   * Args:
   *   baseUrl: Optional wttr base URL override.
   *   fetchImpl: Optional fetch implementation for tests.
   *
   * Returns:
   *   WttrClient instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor({ baseUrl = process.env.WTTR_BASE_URL || DEFAULT_BASE_URL, fetchImpl = fetch } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    this.fetchImpl = fetchImpl;
  }

  /**
   * Builds full request URL for wttr endpoints.
   *
   * Args:
   *   path: wttr path segment or location.
   *   query: Query string without strict formatting requirements.
   *   lang: Optional language code.
   *   units: Unit profile (`auto|metric|us`).
   *   windInMps: Whether to request m/s wind units.
   *
   * Returns:
   *   Fully qualified request URL.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  buildUrl({ path = "", query, lang, units, windInMps }) {
    return `${this.baseUrl}${normalizePath(path)}${buildQuery({ query, lang, units, windInMps })}`;
  }

  /**
   * Executes a raw HTTP request with negotiated headers.
   *
   * Args:
   *   url: Fully qualified request URL.
   *   acceptLanguage: Optional `Accept-Language` header value.
   *   accept: `Accept` header value.
   *
   * Returns:
   *   Fetch Response instance.
   *
   * Throws:
   *   Error: If upstream response status is non-2xx.
   */
  async #request(url, { acceptLanguage, accept }) {
    // Centralized request path keeps headers and error policy consistent.
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

  /**
   * Fetches text payload from wttr endpoint.
   *
   * Args:
   *   url: Fully qualified request URL.
   *   acceptLanguage: Optional `Accept-Language` header value.
   *
   * Returns:
   *   Object containing response text and content type.
   *
   * Throws:
   *   Error: If upstream request fails.
   */
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

  /**
   * Fetches and parses JSON payload from wttr endpoint.
   *
   * Args:
   *   url: Fully qualified request URL.
   *   acceptLanguage: Optional `Accept-Language` header value.
   *
   * Returns:
   *   Object containing parsed JSON and content type.
   *
   * Throws:
   *   Error: If upstream request fails or payload is not valid JSON.
   */
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

  /**
   * Fetches binary payload and returns Base64 representation.
   *
   * Args:
   *   url: Fully qualified request URL.
   *   acceptLanguage: Optional `Accept-Language` header value.
   *
   * Returns:
   *   Object containing Base64 payload, content type, and byte length.
   *
   * Throws:
   *   Error: If upstream request fails.
   */
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
