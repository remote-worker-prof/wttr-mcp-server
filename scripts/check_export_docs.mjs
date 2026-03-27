#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const EXPORT_PATTERNS = [
  /^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/,
  /^\s*export\s+class\s+([A-Za-z_$][\w$]*)\b/,
  /^\s*export\s+const\s+([A-Za-z_$][\w$]*)\b/,
];

/**
 * Recursively collects files with selected extension.
 *
 * Args:
 *   rootDir: Root directory to scan.
 *   extension: File extension to include.
 *
 * Returns:
 *   Array of absolute file paths.
 *
 * Throws:
 *   Error: If directory traversal fails.
 */
export async function collectFiles(rootDir, extension = ".mjs") {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const abs = path.join(rootDir, entry.name);
      if (entry.isDirectory()) return collectFiles(abs, extension);
      return abs.endsWith(extension) ? [abs] : [];
    }),
  );
  return nested.flat();
}

/**
 * Extracts exported declarations from source text.
 *
 * Args:
 *   sourceText: File source code.
 *
 * Returns:
 *   Array of `{ line, name, declaration }` objects.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export function findExports(sourceText) {
  const lines = sourceText.split(/\r?\n/);
  const exportsFound = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of EXPORT_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        exportsFound.push({
          line: index + 1,
          name: match[1],
          declaration: line.trim(),
        });
        break;
      }
    }
  }

  return exportsFound;
}

/**
 * Finds JSDoc block placed immediately above declaration line.
 *
 * Args:
 *   sourceText: File source code.
 *   declarationLine: 1-based declaration line number.
 *
 * Returns:
 *   JSDoc block text or null when absent.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export function findNearestDocblock(sourceText, declarationLine) {
  const lines = sourceText.split(/\r?\n/);
  let cursor = declarationLine - 2;

  while (cursor >= 0 && lines[cursor].trim() === "") {
    cursor -= 1;
  }

  if (cursor < 0 || !lines[cursor].trim().endsWith("*/")) {
    return null;
  }

  const chunk = [];
  while (cursor >= 0) {
    chunk.unshift(lines[cursor]);
    if (lines[cursor].trim().startsWith("/**")) {
      return chunk.join("\n");
    }
    cursor -= 1;
  }

  return null;
}

/**
 * Validates docblock template sections.
 *
 * Args:
 *   docblock: JSDoc block text.
 *
 * Returns:
 *   Empty array when valid; otherwise list of missing section names.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export function validateDocblockSections(docblock) {
  const requiredSections = ["Args:", "Returns:", "Throws:"];
  return requiredSections.filter((section) => !docblock.includes(section));
}

/**
 * Checks a single source text for export docblock compliance.
 *
 * Args:
 *   sourceText: File source code.
 *
 * Returns:
 *   Array of validation error objects.
 *
 * Throws:
 *   Error: Never thrown intentionally.
 */
export function checkExportDocblocksInText(sourceText) {
  const exportsFound = findExports(sourceText);
  const errors = [];

  for (const exported of exportsFound) {
    const docblock = findNearestDocblock(sourceText, exported.line);

    if (!docblock) {
      errors.push({
        line: exported.line,
        name: exported.name,
        reason: "missing JSDoc docblock",
      });
      continue;
    }

    const missingSections = validateDocblockSections(docblock);
    if (missingSections.length > 0) {
      errors.push({
        line: exported.line,
        name: exported.name,
        reason: `missing sections: ${missingSections.join(", ")}`,
      });
    }
  }

  return errors;
}

/**
 * Checks source files for exported-entity docblock policy.
 *
 * Args:
 *   sourceRoot: Root directory with source files.
 *
 * Returns:
 *   Object with checked file count and validation errors.
 *
 * Throws:
 *   Error: If source files cannot be read.
 */
export async function checkExportDocblocks(sourceRoot = path.resolve("src")) {
  const files = await collectFiles(sourceRoot, ".mjs");
  const errors = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, "utf8");
    const fileErrors = checkExportDocblocksInText(source).map((error) => ({
      ...error,
      filePath,
    }));
    errors.push(...fileErrors);
  }

  return {
    checkedFiles: files.length,
    errors,
  };
}

/**
 * CLI entrypoint for export-docblock policy check.
 *
 * Args:
 *   none.
 *
 * Returns:
 *   Process exit code via `process.exit`.
 *
 * Throws:
 *   Error: If checker execution itself fails unexpectedly.
 */
async function main() {
  const sourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve("src");
  const result = await checkExportDocblocks(sourceRoot);

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      // eslint-disable-next-line no-console
      console.error(`${path.relative(process.cwd(), error.filePath)}:${error.line} ${error.name} -> ${error.reason}`);
    }
    // eslint-disable-next-line no-console
    console.error(`\nExport docblock policy failed: ${result.errors.length} issue(s) found.`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`Export docblock policy passed (${result.checkedFiles} files checked).`);
}

const isExecutedDirectly = import.meta.url === new URL(process.argv[1], "file:").href;
if (isExecutedDirectly) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Docblock checker failed:", error);
    process.exit(1);
  });
}
