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

.PHONY: help install-deps run test smoke docker-build docker-push docker-run \
	install-openclaw-source install-openclaw-docker \
	install-claude-linux-source install-claude-linux-docker \
	install-claude-mac-source install-claude-mac-docker \
	install-cursor-source install-cursor-docker \
	install-cline-vscode-source install-cline-vscode-docker \
	install-windsurf-source install-windsurf-docker \
	install-generic-source install-generic-docker

help:
	@echo "wttr-mcp-server Makefile"
	@echo ""
	@echo "Core:"
	@echo "  make install-deps      Install Node deps"
	@echo "  make run               Run MCP server"
	@echo "  make test              Run unit tests"
	@echo "  make smoke             Run local smoke tests via mcporter --stdio"
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
	@echo ""
	@echo "Generic install examples:"
	@echo "  make install-generic-source CONFIG=~/.cursor/mcp.json ROOT_KEY=mcpServers"
	@echo "  make install-generic-docker CONFIG=~/.config/Claude/claude_desktop_config.json ROOT_KEY=mcpServers"

install-deps:
	npm install

run:
	node src/index.mjs

test:
	npm test

smoke:
	npm run smoke

docker-build:
	docker build -t $(DOCKER_IMAGE_VERSIONED) -t $(DOCKER_IMAGE) .

docker-push:
	docker push $(DOCKER_IMAGE_VERSIONED)
	docker push $(DOCKER_IMAGE)

docker-run:
	docker run --rm -i $(DOCKER_IMAGE)

install-openclaw-source:
	python3 scripts/install_mcp.py --config "$(OPENCLAW_CONFIG)" --root-key mcpServers --server-name $(SERVER_NAME) --mode source --project-root "$(PROJECT_ROOT)"

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

install-generic-source:
	@test -n "$(CONFIG)" || (echo "CONFIG is required" && exit 1)
	python3 scripts/install_mcp.py --config "$(CONFIG)" --root-key "$(or $(ROOT_KEY),mcpServers)" --server-name $(SERVER_NAME) --mode source --project-root "$(PROJECT_ROOT)"

install-generic-docker:
	@test -n "$(CONFIG)" || (echo "CONFIG is required" && exit 1)
	python3 scripts/install_mcp.py --config "$(CONFIG)" --root-key "$(or $(ROOT_KEY),mcpServers)" --server-name $(SERVER_NAME) --mode docker --project-root "$(PROJECT_ROOT)" --docker-image "$(DOCKER_IMAGE)"
