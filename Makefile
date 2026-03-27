# Makefile for wttr-mcp-server
#
# Pedagogical notes:
# - Variables use ?= so operators can override from CLI/env.
# - Targets are grouped by intent (dev, docker, installers).
# - Installer targets are thin wrappers around scripts/install_*.py.
#
# Example override:
#   make install-cursor-http HTTP_URL=https://example.com/mcp HTTP_HEADERS_JSON='{"Authorization":"Bearer ${env:TOKEN}"}'

PROJECT_ROOT := $(abspath .)
SERVER_NAME ?= wttr-mcp
DOCKER_IMAGE ?= markstroinyi/wttr-mcp-server:latest
DOCKER_IMAGE_VERSIONED ?= markstroinyi/wttr-mcp-server:0.3.0

OPENCLAW_CONFIG ?= /home/sorcerer/.openclaw/workspace/config/mcporter.json
CLAUDE_LINUX_CONFIG ?= $(HOME)/.config/Claude/claude_desktop_config.json
CLAUDE_MAC_CONFIG ?= $(HOME)/Library/Application Support/Claude/claude_desktop_config.json
CURSOR_CONFIG ?= $(HOME)/.cursor/mcp.json
VSCODE_SETTINGS ?= $(HOME)/.config/Code/User/settings.json
WINDSURF_CONFIG ?= $(HOME)/.codeium/windsurf/mcp_config.json
CODEX_CONFIG ?= $(HOME)/.codex/config.toml
CODEX_SERVER_NAME ?= wttr_mcp

# Remote MCP options (used by *-http install targets)
HTTP_URL ?=
HTTP_HEADERS_JSON ?={}
HTTP_URL_KEY ?= serverUrl
BEARER_TOKEN_ENV_VAR ?=

.PHONY: help install-deps run test check-docs ci smoke docker-build docker-push docker-run \
	install-openclaw-source install-openclaw-docker \
	install-claude-linux-source install-claude-linux-docker \
	install-claude-mac-source install-claude-mac-docker \
	install-cursor-source install-cursor-docker \
	install-cline-vscode-source install-cline-vscode-docker \
	install-windsurf-source install-windsurf-docker \
	install-codex-source install-codex-docker install-codex-http \
	install-cursor-http install-windsurf-http \
	install-generic-source install-generic-docker install-generic-http

# -------------------------
# Core development targets
# -------------------------

help:
	@echo "wttr-mcp-server Makefile"
	@echo ""
	@echo "Core:"
	@echo "  make install-deps      Install Node dependencies"
	@echo "  make run               Run MCP server over stdio"
	@echo "  make check-docs        Validate Args/Returns/Throws for exports"
	@echo "  make test              Run unit tests"
	@echo "  make ci                Run doc checks + unit tests"
	@echo "  make smoke             Run end-to-end smoke tests via mcporter"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build      Build Docker image (latest + versioned)"
	@echo "  make docker-push       Push Docker image tags"
	@echo "  make docker-run        Run Docker image interactively"
	@echo ""
	@echo "Install in popular AI agents:"
	@echo "  make install-openclaw-source"
	@echo "  make install-claude-linux-source"
	@echo "  make install-claude-mac-source"
	@echo "  make install-cursor-source"
	@echo "  make install-cline-vscode-source"
	@echo "  make install-windsurf-source"
	@echo "  make install-codex-source"
	@echo ""
	@echo "Remote HTTP install helpers:"
	@echo "  make install-cursor-http HTTP_URL=https://host/mcp"
	@echo "  make install-windsurf-http HTTP_URL=https://host/mcp"
	@echo "  make install-codex-http HTTP_URL=https://host/mcp BEARER_TOKEN_ENV_VAR=MCP_TOKEN"
	@echo ""
	@echo "Generic install examples:"
	@echo "  make install-generic-source CONFIG=~/.cursor/mcp.json ROOT_KEY=mcpServers"
	@echo "  make install-generic-docker CONFIG=~/.config/Claude/claude_desktop_config.json ROOT_KEY=mcpServers"
	@echo "  make install-generic-http CONFIG=~/.codeium/windsurf/mcp_config.json ROOT_KEY=mcpServers HTTP_URL=https://host/mcp"

install-deps:
	npm install

run:
	node src/index.mjs

check-docs:
	npm run check:docs

test:
	npm test

ci:
	npm run ci

smoke:
	npm run smoke

# ---------------
# Docker targets
# ---------------

# Build both immutable and floating tags in one call.
docker-build:
	docker build -t $(DOCKER_IMAGE_VERSIONED) -t $(DOCKER_IMAGE) .

# Push both tags to keep CI/CD and manual consumers aligned.
docker-push:
	docker push $(DOCKER_IMAGE_VERSIONED)
	docker push $(DOCKER_IMAGE)

# Run in stdio mode, suitable for MCP host piping.
docker-run:
	docker run --rm -i $(DOCKER_IMAGE)

# -------------------------------------------
# MCP config installers for popular AI hosts
# -------------------------------------------

# Source mode: local node entrypoint.
install-openclaw-source:
	python3 scripts/install_mcp.py --config "$(OPENCLAW_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode source --project-root "$(PROJECT_ROOT)"

# Docker mode: avoids local Node runtime dependency in host config.
install-openclaw-docker:
	python3 scripts/install_mcp.py --config "$(OPENCLAW_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode docker --project-root "$(PROJECT_ROOT)" --docker-image "$(DOCKER_IMAGE)"

install-claude-linux-source:
	python3 scripts/install_mcp.py --config "$(CLAUDE_LINUX_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode source --project-root "$(PROJECT_ROOT)"

install-claude-linux-docker:
	python3 scripts/install_mcp.py --config "$(CLAUDE_LINUX_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode docker --project-root "$(PROJECT_ROOT)" --docker-image "$(DOCKER_IMAGE)"

install-claude-mac-source:
	python3 scripts/install_mcp.py --config "$(CLAUDE_MAC_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode source --project-root "$(PROJECT_ROOT)"

install-claude-mac-docker:
	python3 scripts/install_mcp.py --config "$(CLAUDE_MAC_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode docker --project-root "$(PROJECT_ROOT)" --docker-image "$(DOCKER_IMAGE)"

install-cursor-source:
	python3 scripts/install_mcp.py --config "$(CURSOR_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode source --project-root "$(PROJECT_ROOT)"

install-cursor-docker:
	python3 scripts/install_mcp.py --config "$(CURSOR_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode docker --project-root "$(PROJECT_ROOT)" --docker-image "$(DOCKER_IMAGE)"

install-cline-vscode-source:
	python3 scripts/install_mcp.py --config "$(VSCODE_SETTINGS)" --root-key cline.mcpServers --server-name $(SERVER_NAME) --mode source --project-root "$(PROJECT_ROOT)"

install-cline-vscode-docker:
	python3 scripts/install_mcp.py --config "$(VSCODE_SETTINGS)" --root-key cline.mcpServers --server-name $(SERVER_NAME) --mode docker --project-root "$(PROJECT_ROOT)" --docker-image "$(DOCKER_IMAGE)"

install-windsurf-source:
	python3 scripts/install_mcp.py --config "$(WINDSURF_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode source --project-root "$(PROJECT_ROOT)"

install-windsurf-docker:
	python3 scripts/install_mcp.py --config "$(WINDSURF_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode docker --project-root "$(PROJECT_ROOT)" --docker-image "$(DOCKER_IMAGE)"

# Codex installers use TOML-specific helper.
install-codex-source:
	python3 scripts/install_codex.py --config "$(CODEX_CONFIG)" --server-name "$(CODEX_SERVER_NAME)" --mode source --project-root "$(PROJECT_ROOT)" --docker-image "$(DOCKER_IMAGE)"

install-codex-docker:
	python3 scripts/install_codex.py --config "$(CODEX_CONFIG)" --server-name "$(CODEX_SERVER_NAME)" --mode docker --project-root "$(PROJECT_ROOT)" --docker-image "$(DOCKER_IMAGE)"

# HTTP mode supports remote streamable MCP endpoints.
install-codex-http:
	@test -n "$(HTTP_URL)" || (echo "HTTP_URL is required" && exit 1)
	python3 scripts/install_codex.py --config "$(CODEX_CONFIG)" --server-name "$(CODEX_SERVER_NAME)" --transport streamable_http --url "$(HTTP_URL)" --bearer-token-env-var "$(BEARER_TOKEN_ENV_VAR)" --mode source --project-root "$(PROJECT_ROOT)"

install-cursor-http:
	@test -n "$(HTTP_URL)" || (echo "HTTP_URL is required" && exit 1)
	python3 scripts/install_mcp.py --config "$(CURSOR_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode http --project-root "$(PROJECT_ROOT)" --http-url "$(HTTP_URL)" --http-url-key url --headers-json '$(HTTP_HEADERS_JSON)'

install-windsurf-http:
	@test -n "$(HTTP_URL)" || (echo "HTTP_URL is required" && exit 1)
	python3 scripts/install_mcp.py --config "$(WINDSURF_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode http --project-root "$(PROJECT_ROOT)" --http-url "$(HTTP_URL)" --http-url-key serverUrl --headers-json '$(HTTP_HEADERS_JSON)'

# -----------------------------------------------------
# Generic installers for custom MCP host config layouts
# -----------------------------------------------------

install-generic-source:
	@test -n "$(CONFIG)" || (echo "CONFIG is required" && exit 1)
	python3 scripts/install_mcp.py --config "$(CONFIG)" --root-key "$(or $(ROOT_KEY),mcpServers)" --server-name $(SERVER_NAME) --mode source --project-root "$(PROJECT_ROOT)"

install-generic-docker:
	@test -n "$(CONFIG)" || (echo "CONFIG is required" && exit 1)
	python3 scripts/install_mcp.py --config "$(CONFIG)" --root-key "$(or $(ROOT_KEY),mcpServers)" --server-name $(SERVER_NAME) --mode docker --project-root "$(PROJECT_ROOT)" --docker-image "$(DOCKER_IMAGE)"

install-generic-http:
	@test -n "$(CONFIG)" || (echo "CONFIG is required" && exit 1)
	@test -n "$(HTTP_URL)" || (echo "HTTP_URL is required" && exit 1)
	python3 scripts/install_mcp.py --config "$(CONFIG)" --root-key "$(or $(ROOT_KEY),mcpServers)" --server-name $(SERVER_NAME) --mode http --project-root "$(PROJECT_ROOT)" --http-url "$(HTTP_URL)" --http-url-key "$(HTTP_URL_KEY)" --headers-json '$(HTTP_HEADERS_JSON)'
