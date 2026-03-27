#!/usr/bin/env python3
"""Install or update a wttr MCP entry in JSON-based client configs.

This script is intentionally dependency-free so it works in CI and on freshly
bootstrapped machines. It teaches the expected config structure while mutating
as little as possible.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments.

    Returns:
        Parsed argument namespace.
    """
    parser = argparse.ArgumentParser(
        description="Install or update a wttr MCP entry in a JSON config file."
    )
    parser.add_argument("--config", required=True, help="Path to the target JSON config file.")
    parser.add_argument(
        "--root-key",
        default="mcpServers",
        help="Dot path to the MCP servers map (default: mcpServers).",
    )
    parser.add_argument("--server-name", default="wttr-mcp", help="MCP server key name.")
    parser.add_argument("--mode", choices=["source", "docker", "http"], default="source")
    parser.add_argument("--project-root", required=True, help="Path to project root.")
    parser.add_argument("--docker-image", default="markstroinyi/wttr-mcp-server:latest")
    parser.add_argument("--http-url", default="", help="Remote MCP HTTP URL for mode=http")
    parser.add_argument(
        "--http-url-key",
        choices=["serverUrl", "url"],
        default="serverUrl",
        help="URL key for remote JSON config entries (serverUrl or url)",
    )
    parser.add_argument(
        "--headers-json",
        default="{}",
        help=(
            "JSON object with headers for remote HTTP entries, "
            "e.g. '{\"Authorization\":\"Bearer ${env:TOKEN}\"}'"
        ),
    )
    return parser.parse_args()


def load_json(path: Path) -> dict[str, Any]:
    """Load JSON object from disk.

    Args:
        path: Source JSON file path.

    Returns:
        Parsed object map. Empty map when file is missing or empty.

    Raises:
        json.JSONDecodeError: If file exists but content is invalid JSON.
        OSError: If file reading fails.
    """
    if not path.exists():
        return {}

    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return {}

    return json.loads(text)


def ensure_path(root: dict[str, Any], dot_key: str) -> dict[str, Any]:
    """Ensure nested object path exists and return terminal node.

    Args:
        root: Root object that should contain nested maps.
        dot_key: Dot-path, for example "mcpServers" or "settings.mcpServers".

    Returns:
        Terminal dictionary at the requested path.

    Raises:
        TypeError: Never raised intentionally; non-dict intermediates are replaced.
    """
    keys = [token for token in dot_key.split(".") if token]
    current = root

    # Pedagogical rule: if path segment is missing or wrong type, repair in place.
    for key in keys:
        if key not in current or not isinstance(current[key], dict):
            current[key] = {}
        current = current[key]

    return current


def parse_headers(raw_json: str) -> dict[str, str]:
    """Validate HTTP headers JSON from CLI.

    Args:
        raw_json: JSON object encoded as string.

    Returns:
        Normalized headers dictionary with string keys and values.

    Raises:
        json.JSONDecodeError: If `raw_json` is not valid JSON.
        ValueError: If decoded value is not an object of string-to-string pairs.
    """
    parsed = json.loads(raw_json)
    if not isinstance(parsed, dict):
        raise ValueError("--headers-json must decode to a JSON object")

    normalized: dict[str, str] = {}
    for key, value in parsed.items():
        if not isinstance(key, str) or not isinstance(value, str):
            raise ValueError("--headers-json keys and values must be strings")
        normalized[key] = value

    return normalized


def make_entry(
    mode: str,
    project_root: Path,
    docker_image: str,
    http_url: str,
    http_url_key: str,
    headers_json: str,
) -> dict[str, Any]:
    """Build MCP server entry for requested mode.

    Args:
        mode: Installation mode (source, docker, http).
        project_root: Project root directory for source mode.
        docker_image: Docker image name for docker mode.
        http_url: Remote endpoint for http mode.
        http_url_key: Field name for URL in target config.
        headers_json: Raw JSON headers string.

    Returns:
        JSON-serializable MCP server descriptor.

    Raises:
        ValueError: If required mode-specific parameters are missing/invalid.
        json.JSONDecodeError: If `headers_json` is invalid for http mode.
    """
    if mode == "http":
        if not http_url:
            raise ValueError("--http-url is required when --mode=http")

        headers = parse_headers(headers_json)
        return {
            http_url_key: http_url,
            **({"headers": headers} if headers else {}),
            "description": f"wttr.in weather MCP via remote HTTP endpoint {http_url}",
        }

    if mode == "docker":
        return {
            "command": "docker",
            "args": ["run", "--rm", "-i", docker_image],
            "description": f"wttr.in weather MCP via Docker image {docker_image}",
        }

    # source mode: run local Node entrypoint directly.
    return {
        "command": "node",
        "args": [str(project_root / "src" / "index.mjs")],
        "description": f"wttr.in weather MCP from {project_root}",
    }


def main() -> None:
    """CLI entrypoint.

    Performs a read-modify-write cycle:
    1) parse args,
    2) load existing JSON (or start empty),
    3) ensure nested root key,
    4) upsert server entry,
    5) write back pretty JSON.

    Raises:
        ValueError/json.JSONDecodeError/OSError: Propagated to caller for clear CLI failure.
    """
    args = parse_args()
    config_path = Path(args.config).expanduser()
    project_root = Path(args.project_root).expanduser().resolve()

    data = load_json(config_path)
    servers = ensure_path(data, args.root_key)
    servers[args.server_name] = make_entry(
        mode=args.mode,
        project_root=project_root,
        docker_image=args.docker_image,
        http_url=args.http_url,
        http_url_key=args.http_url_key,
        headers_json=args.headers_json,
    )

    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Updated {config_path}")
    print(f"  root key: {args.root_key}")
    print(f"  server:   {args.server_name}")
    print(f"  mode:     {args.mode}")


if __name__ == "__main__":
    main()
