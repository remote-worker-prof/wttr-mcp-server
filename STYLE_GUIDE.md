# Source Style Guide

This repository uses a pragmatic, Google-inspired style baseline across source types.

## JavaScript / Node (`.mjs`)

- Use clear names over abbreviations.
- Keep functions focused and side-effect boundaries explicit.
- Use JSDoc for exported symbols and non-obvious behavior.
- Docblock template for exported entities is mandatory and must contain sections: `Args:`, `Returns:`, `Throws:`.
- Prefer early validation with actionable error messages.
- Keep protocol adapters thin; keep business logic in domain/application layers.

## Python (`scripts/*.py`)

- Follow PEP 8 with type hints for public functions.
- Use short module-level docstrings and function docstrings.
- Keep scripts dependency-light and deterministic.
- Use explicit filesystem operations and UTF-8 encoding.

## Markdown (`README.md`, `docs/*.md`)

- Use concise technical prose in English.
- Prefer plain headings and explicit lists over marketing language.
- Keep examples runnable as-is.
- Avoid decorative symbols and emoji in technical docs.

## Makefile

- Keep target names explicit and task-oriented.
- Use uppercase variables for user-overridable settings.
- Keep command blocks short and composable.

## Humanization rule

The writing should feel natural and direct, not robotic.
The style should remain professional, technical, and free from hype.
