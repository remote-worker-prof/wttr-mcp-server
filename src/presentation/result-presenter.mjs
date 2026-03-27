import { requireEnum } from "../domain/validation.mjs";

/**
 * Module overview:
 *
 * This layer translates internal tool payloads into MCP response envelopes.
 * It intentionally demonstrates Strategy + Factory in a compact form so the
 * presentation policy can evolve without changing domain/application logic.
 */

/**
 * Declares supported result rendering profiles.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   Frozen list of profile identifiers.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export const RESULT_PROFILES = Object.freeze(["default", "webchat", "n8n"]);

/**
 * Checks whether a value is a non-array object.
 *
 * Args:
 *   value: Candidate value.
 *
 * Returns:
 *   True when `value` is an object literal-like value.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Serializes result payload to JSON text.
 *
 * Args:
 *   value: Any serializable value.
 *   compact: Whether JSON must be compact.
 *
 * Returns:
 *   String representation of payload.
 *
 * Throws:
 *   Error: If value cannot be serialized.
 */
function toJsonText(value, { compact = false } = {}) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, compact ? 0 : 2);
}

/**
 * Extracts user-facing text from common payload fields.
 *
 * Args:
 *   value: Tool result payload.
 *
 * Returns:
 *   Preferred readable text or null.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
function pickPrimaryText(value) {
  if (!isPlainObject(value)) return null;

  const candidateKeys = ["text", "weather", "help"];
  for (const key of candidateKeys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return null;
}

/**
 * Base strategy for profile-specific result presentation.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   ResultPresentationStrategy instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
class ResultPresentationStrategy {
  /**
   * Creates strategy descriptor.
   *
   * Args:
   *   id: Stable strategy identifier.
   *
   * Returns:
   *   ResultPresentationStrategy instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor({ id }) {
    this.id = id;
  }

  /**
   * Converts payload to text content.
   *
   * Args:
   *   value: Any payload.
   *
   * Returns:
   *   String content for MCP `content[0].text`.
   *
   * Throws:
   *   Error: If serialization fails.
   */
  // eslint-disable-next-line class-methods-use-this
  buildContentText(value) {
    return toJsonText(value);
  }

  /**
   * Builds final MCP-compatible output object.
   *
   * Args:
   *   value: Tool result payload.
   *
   * Returns:
   *   Object with `content` and optional `structuredContent`.
   *
   * Throws:
   *   Error: If text rendering fails.
   */
  present(value) {
    const structuredContent = isPlainObject(value) ? value : undefined;
    const text = this.buildContentText(value);

    return {
      content: [{ type: "text", text }],
      ...(structuredContent ? { structuredContent } : {}),
    };
  }
}

/**
 * Default balanced presentation strategy.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   DefaultResultPresentationStrategy instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
class DefaultResultPresentationStrategy extends ResultPresentationStrategy {
  /**
   * Initializes default strategy id.
   *
   * Args:
   *   none.
   *
   * Returns:
   *   DefaultResultPresentationStrategy instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor() {
    super({ id: "default" });
  }
}

/**
 * Chat-first strategy for browser/chat surfaces.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   WebchatResultPresentationStrategy instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
class WebchatResultPresentationStrategy extends ResultPresentationStrategy {
  /**
   * Initializes webchat strategy id.
   *
   * Args:
   *   none.
   *
   * Returns:
   *   WebchatResultPresentationStrategy instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor() {
    super({ id: "webchat" });
  }

  /**
   * Prefers readable text over full JSON dump.
   *
   * Args:
   *   value: Tool result payload.
   *
   * Returns:
   *   Readable text if present; otherwise JSON text.
   *
   * Throws:
   *   Error: If serialization fails.
   */
  buildContentText(value) {
    if (typeof value === "string") return value;
    const primaryText = pickPrimaryText(value);
    if (primaryText) return primaryText;
    return toJsonText(value);
  }
}

/**
 * Workflow-first strategy for automation tools.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   N8nResultPresentationStrategy instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
class N8nResultPresentationStrategy extends ResultPresentationStrategy {
  /**
   * Initializes n8n strategy id.
   *
   * Args:
   *   none.
   *
   * Returns:
   *   N8nResultPresentationStrategy instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor() {
    super({ id: "n8n" });
  }

  /**
   * Emits compact JSON text for deterministic parsing.
   *
   * Args:
   *   value: Tool result payload.
   *
   * Returns:
   *   Compact JSON string.
   *
   * Throws:
   *   Error: If serialization fails.
   */
  buildContentText(value) {
    return toJsonText(value, { compact: true });
  }
}

/**
 * Factory for result presentation strategies.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   ResultPresentationStrategyFactory instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
class ResultPresentationStrategyFactory {
  /**
   * Indexes strategies by identifier.
   *
   * Args:
   *   strategies: List of strategy instances.
   *
   * Returns:
   *   ResultPresentationStrategyFactory instance.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  constructor(strategies) {
    this.byId = new Map(strategies.map((strategy) => [strategy.id, strategy]));
  }

  /**
   * Resolves strategy by profile id.
   *
   * Args:
   *   profileId: Requested profile identifier.
   *
   * Returns:
   *   Strategy instance for requested profile or default fallback.
   *
   * Throws:
   *   Error: Never thrown intentionally.
   */
  get(profileId) {
    return this.byId.get(profileId) || this.byId.get("default");
  }
}

/**
 * OOP facade for result presentation.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   ResultPresenter instance.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export class ResultPresenter {
  /**
   * Creates presenter with pluggable strategy factory.
   *
   * Args:
   *   defaultProfile: Default profile identifier.
   *
   * Returns:
   *   ResultPresenter instance.
   *
   * Throws:
   *   Error: If default profile is not supported.
   */
  constructor({ defaultProfile = "default" } = {}) {
    requireEnum(defaultProfile, "defaultProfile", RESULT_PROFILES);
    this.defaultProfile = defaultProfile;
    this.factory = new ResultPresentationStrategyFactory([
      new DefaultResultPresentationStrategy(),
      new WebchatResultPresentationStrategy(),
      new N8nResultPresentationStrategy(),
    ]);
  }

  /**
   * Renders payload according to selected profile.
   *
   * Args:
   *   value: Tool result payload.
   *   profile: Optional explicit profile override.
   *
   * Returns:
   *   MCP-compatible result payload.
   *
   * Throws:
   *   Error: If selected profile is invalid.
   */
  present(value, { profile } = {}) {
    // 1) Resolve profile.
    const selectedProfile = profile || this.defaultProfile;
    requireEnum(selectedProfile, "profile", RESULT_PROFILES);

    // 2) Delegate payload formatting to the chosen strategy.
    const strategy = this.factory.get(selectedProfile);

    // 3) Return canonical MCP envelope.
    return strategy.present(value);
  }
}

/**
 * Creates presenter facade for existing call sites.
 *
 * Args:
 *   defaultProfile: Default profile identifier.
 *
 * Returns:
 *   ResultPresenter instance.
 *
 * Throws:
 *   Error: If default profile is invalid.
 */
export function createResultPresenter({ defaultProfile = "default" } = {}) {
  return new ResultPresenter({ defaultProfile });
}
