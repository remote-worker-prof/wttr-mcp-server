import test from "node:test";
import assert from "node:assert/strict";
import {
  checkExportDocblocks,
  checkExportDocblocksInText,
  findExports,
  validateDocblockSections,
} from "../../scripts/check_export_docs.mjs";

test("findExports detects exported functions, classes, and consts", () => {
  const exportsFound = findExports(`
export const ANSWER = 42;
export function run() {}
export class Runner {}
`);

  assert.deepEqual(
    exportsFound.map((item) => item.name),
    ["ANSWER", "run", "Runner"],
  );
});

test("validateDocblockSections enforces Args/Returns/Throws", () => {
  const missing = validateDocblockSections(`/**\n * test\n * Args:\n *  x\n */`);
  assert.deepEqual(missing, ["Returns:", "Throws:"]);
});

test("checkExportDocblocksInText fails when export has no docblock", () => {
  const errors = checkExportDocblocksInText(`export function run() { return true; }`);
  assert.equal(errors.length, 1);
  assert.match(errors[0].reason, /missing JSDoc/);
});

test("checkExportDocblocksInText passes with required template", () => {
  const errors = checkExportDocblocksInText(`
/**
 * Demo.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   Number value.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export const VALUE = 1;
`);

  assert.equal(errors.length, 0);
});

test("repository src passes export docblock policy", async () => {
  const result = await checkExportDocblocks(new URL("../../src", import.meta.url).pathname);
  assert.equal(result.errors.length, 0);
  assert.ok(result.checkedFiles >= 1);
});
