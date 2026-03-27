#!/usr/bin/env python3
"""Install or update wttr MCP section in Codex TOML configuration.

The script keeps behavior explicit so operators can audit every generated TOML
line before applying it in production workstations.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def parse_args() -> argparse.Namespace:
    """Parse command-line options.

    Returns:
        Parsed argument namespace.
    """
    parser = argparse.ArgumentParser(
        description="Install or update wttr MCP server in Codex ~/.codex/config.toml"
    )
    parser.add_argument("--config", required=True, help="Path to Codex config.toml")
    parser.add_argument(
        "--server-name",
        default="wttr_mcp",
        help="Codex mcp_servers key (TOML table suffix)",
    )
    parser.add_argument("--mode", choices=["source", "docker"], default="source")
    parser.add_argument("--project-root", required=True, help="Path to project root")
    parser.add_argument("--docker-image", default="markstroinyi/wttr-mcp-server:latest")
    parser.add_argument(
        "--transport",
        choices=["stdio", "streamable_http"],
        default="stdio",
        help="Codex MCP transport type",
    )
    parser.add_argument(
        "--url",
        default="",
        help="Remote streamable HTTP URL (required when --transport=streamable_http)",
    )
    parser.add_argument(
        "--bearer-token-env-var",
        default="",
        help="Environment variable name containing bearer token for streamable HTTP transport",
    )
    parser.add_argument(
        "--legacy-format",
        action="store_true",
        help="Write legacy command/args layout instead of transport table for stdio",
    )
    parser.add_argument("--startup-timeout", type=float, default=30.0)
    parser.add_argument("--tool-timeout", type=float, default=120.0)
    return parser.parse_args()


def toml_array(values: list[str]) -> str:
    """Serialize list as TOML-compatible array literal.

    Args:
        values: String list to serialize.

    Returns:
        TOML array literal string.
    """
    return json.dumps(values, ensure_ascii=False)


def toml_inline_table(pairs: list[tuple[str, str]]) -> str:
    """Build TOML inline table from key/value string pairs.

    Args:
        pairs: Sequence of `(key, value)` tuples.

    Returns:
        TOML inline table string.
    """
    encoded_pairs = [f'{key} = "{value}"' for key, value in pairs]
    return "{ " + ", ".join(encoded_pairs) + " }"


def build_stdio_transport_block(mode: str, project_root: Path, docker_image: str) -> tuple[str, list[str]]:
    """Build command and arguments for stdio transport.

    Args:
        mode: Source or docker mode.
        project_root: Local project root for source mode.
        docker_image: Docker image for docker mode.

    Returns:
        Tuple `(command, args)`.
    """
    if mode == "docker":
        return "docker", ["run", "--rm", "-i", docker_image]

    return "node", [str(project_root / "src" / "index.mjs")]


def build_block(
    server_name: str,
    mode: str,
    project_root: Path,
    docker_image: str,
    startup: float,
    tool: float,
    transport: str,
    remote_url: str,
    bearer_token_env_var: str,
    legacy_format: bool,
) -> str:
    """Build TOML block for `[mcp_servers.<server_name>]`.

    Args:
        server_name: TOML table suffix.
        mode: Source or docker mode for stdio transport.
        project_root: Local project root for source mode.
        docker_image: Docker image for docker mode.
        startup: Startup timeout seconds.
        tool: Tool timeout seconds.
        transport: Selected transport (`stdio` or `streamable_http`).
        remote_url: URL for HTTP transport.
        bearer_token_env_var: Optional env var for bearer token.
        legacy_format: Whether to emit legacy command/args layout.

    Returns:
        TOML block string ending with newline.

    Raises:
        ValueError: If HTTP transport is selected without URL.
    """
    lines = [f"[mcp_servers.{server_name}]"]

    if transport == "streamable_http":
        if not remote_url:
            raise ValueError("--url is required when --transport=streamable_http")

        lines.append("enabled = true")
        lines.append(
            f'transport = {toml_inline_table([("type", "streamable_http"), ("url", remote_url)])}'
        )
        if bearer_token_env_var:
            lines.append(f'bearer_token_env_var = "{bearer_token_env_var}"')
        lines.append(f"startup_timeout_sec = {startup:.1f}")
        lines.append(f"tool_timeout_sec = {tool:.1f}")
        return "\n".join(lines) + "\n"

    command, args = build_stdio_transport_block(mode, project_root, docker_image)

    if legacy_format:
        # Legacy mode helps old Codex versions that still expect command+args fields.
        lines.extend(
            [
                f'command = "{command}"',
                f"args = {toml_array(args)}",
                f"startup_timeout_sec = {startup:.1f}",
                f"tool_timeout_sec = {tool:.1f}",
            ]
        )
        return "\n".join(lines) + "\n"

    lines.append("enabled = true")
    lines.append(
        f'transport = {toml_inline_table([("type", "stdio"), ("command", command), ("args", toml_array(args))])}'
    )
    lines.append(f"startup_timeout_sec = {startup:.1f}")
    lines.append(f"tool_timeout_sec = {tool:.1f}")

    return "\n".join(lines) + "\n"


def upsert_section(text: str, section_name: str, block: str) -> tuple[str, str]:
    """Insert or replace one `[mcp_servers.<name>]` section.

    Args:
        text: Existing TOML text.
        section_name: Section suffix to replace.
        block: New section block.

    Returns:
        Tuple `(updated_text, status)` where status is `added` or `updated`.
    """
    pattern = re.compile(rf"(?ms)^\[mcp_servers\.{re.escape(section_name)}\]\n.*?(?=^\[|\Z)")
    if pattern.search(text):
        return pattern.sub(block + "\n", text, count=1), "updated"

    if text and not text.endswith("\n"):
        text += "\n"

    return text + "\n" + block, "added"


def main() -> None:
    """CLI entrypoint.

    Execution flow:
    1) parse flags,
    2) read existing TOML,
    3) render target section,
    4) upsert section,
    5) write file back.
    """
    args = parse_args()
    config_path = Path(args.config).expanduser()
    project_root = Path(args.project_root).expanduser().resolve()

    original = config_path.read_text(encoding="utf-8") if config_path.exists() else ""
    block = build_block(
        server_name=args.server_name,
        mode=args.mode,
        project_root=project_root,
        docker_image=args.docker_image,
        startup=args.startup_timeout,
        tool=args.tool_timeout,
        transport=args.transport,
        remote_url=args.url,
        bearer_token_env_var=args.bearer_token_env_var,
        legacy_format=args.legacy_format,
    )

    updated, status = upsert_section(original, args.server_name, block)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(updated, encoding="utf-8")

    print(f"{status.capitalize()} Codex MCP section in {config_path}")
    print(f"  section: [mcp_servers.{args.server_name}]")
    print(f"  transport: {args.transport}")
    if args.transport == "stdio":
        print(f"  mode: {args.mode}")
    else:
        print(f"  url: {args.url}")


if __name__ == "__main__":
    main()
