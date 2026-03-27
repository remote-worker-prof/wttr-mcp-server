/**
 * Validates that a value is a non-empty string.
 *
 * Args:
 *   value: Candidate value to validate.
 *   field: Human-readable field name for error messages.
 *
 * Returns:
 *   void.
 *
 * Throws:
 *   Error: If `value` is not a non-empty string.
 */
export function requireString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

/**
 * Validates that a value is an integer within inclusive bounds.
 *
 * Args:
 *   value: Candidate numeric value.
 *   field: Human-readable field name for error messages.
 *   min: Inclusive lower bound.
 *   max: Inclusive upper bound.
 *
 * Returns:
 *   void.
 *
 * Throws:
 *   Error: If `value` is not an integer in the range [`min`, `max`].
 */
export function requireIntInRange(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`);
  }
}

/**
 * Validates that a value belongs to an allowlist.
 *
 * Args:
 *   value: Candidate string value.
 *   field: Human-readable field name for error messages.
 *   allowed: Enumeration allowlist.
 *
 * Returns:
 *   void.
 *
 * Throws:
 *   Error: If `value` is not present in `allowed`.
 */
export function requireEnum(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  }
}
