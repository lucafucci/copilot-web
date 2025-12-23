# Copilot Web Interface

A web interface for GitHub Copilot CLI built from scratch.

## Overview

Web-based graphical interface to interact with GitHub Copilot CLI through your browser, providing a ChatGPT-like experience for AI-assisted coding.

## Project Structure

```
copilot-web/
├── Dockerfile                 # Debian Slim + Node.js 22 + Copilot CLI
├── package.json              # Dependencies: express, ws
├── .dockerignore
├── src/
│   └── server.js            # Node.js backend with WebSocket
└── public/
    └── index.html           # Frontend chat interface
```

## Architecture

### Backend (Node.js + Express + WebSocket)
- **HTTP Server**: Express on port 3000
- **WebSocket**: Real-time client-server communication
- **Copilot Execution**: Spawns `copilot -p "<prompt>" --allow-all-tools` process per message
- **Mode**: Non-interactive (each message is a separate command)

### Frontend (HTML + Vanilla JS)
- **Design**: GitHub dark theme
- **Components**: Header with status indicator, chat container, input box
- **WebSocket Client**: Auto-connects to server
- **Messages**: User (blue), Assistant (gray), System (cyan), Error (red)

### Docker Configuration
**Base Image**: `node:22-slim` (Debian-based, required for copilot CLI x64 glibc binary)

**Copilot CLI Installation**:
```dockerfile
RUN curl -fsSL https://github.com/github/copilot-cli/releases/latest/download/copilot-linux-x64.tar.gz -o /tmp/copilot.tar.gz && \
    tar -xzf /tmp/copilot.tar.gz -C /usr/local/bin
```

**Required Environment Variables**:
- `COPILOT_GITHUB_TOKEN` (or `GH_TOKEN` or `GITHUB_TOKEN`)
- `TZ` (your timezone, e.g., `America/New_York`, `Europe/London`)

**Mounted Volumes**:
- `~/.config:/root/.config` (to persist Copilot credentials)

## Integration

### docker-compose.yml
```yaml
services:
  copilot-web:
    build: ./copilot-web
    container_name: copilot-web
    restart: unless-stopped
    networks:
      - traefik
    environment:
      - TZ=America/New_York  # Change to your timezone
      - GH_TOKEN=${GH_TOKEN}
      - GITHUB_TOKEN=${GH_TOKEN}
      - COPILOT_GITHUB_TOKEN=${GH_TOKEN}
    volumes:
      - ~/.config:/root/.config  # Persist Copilot OAuth credentials
    labels:
      - traefik.enable=true
      - traefik.http.routers.copilot-web.rule=Host(`copilot.example.com`)  # Change domain
      - traefik.http.routers.copilot-web.entrypoints=websecure
      - traefik.http.routers.copilot-web.tls.certresolver=cloudflare
      - traefik.http.services.copilot-web.loadbalancer.server.port=3000

networks:
  traefik:
    external: true
```

### Reverse Proxy (Traefik)
- **URL**: https://copilot.example.com (configure your domain)
- **SSL**: Automatic certificate via Let's Encrypt/Cloudflare
- **Auth**: None (can be added with any SSO provider)

## Issues Encountered

### 1. Alpine Linux Incompatibility
**Problem**: Copilot CLI is a x64 glibc binary, doesn't work on Alpine (musl)
**Error**: `exec /usr/local/bin/copilot: no such file or directory`
**Solution**: Changed base image from `node:22-alpine` to `node:22-slim` (Debian)

### 2. Interactive Mode Not Working
**Problem**: Spawning `copilot` without parameters produced no output
**Reason**: Copilot requires PTY (pseudo-terminal) for interactive mode
**Solution**: Used non-interactive mode with `-p "<prompt>"` flag

### 3. GitHub Authentication
**Critical Issue**: Copilot CLI refuses PAT (Personal Access Token)
**Error**: `No authentication information found`
**Failed Attempts**:
- GitHub classic token (`ghp_...`) ❌
- Fine-grained PAT ❌
- Environment variables `GH_TOKEN`, `GITHUB_TOKEN`, `COPILOT_GITHUB_TOKEN` ❌

**Root Cause**: Copilot CLI requires full OAuth authentication (like VS Code), doesn't support PAT tokens

## Current Status

### ✅ Completed
- [x] Node.js backend working
- [x] Frontend with GitHub theme
- [x] WebSocket real-time communication
- [x] Docker build and deployment
- [x] Traefik integration with SSL
- [x] Copilot CLI installed in container
- [x] Non-interactive mode implemented

### ❌ Not Working
- [ ] **Copilot CLI Authentication** - blocks all functionality

### Container Status
```bash
$ docker compose ps copilot-web
NAME          IMAGE                    STATUS
copilot-web   copilot-web              Up (healthy)
```

### Log Status
```
WebSocket server ready
Copilot Web UI running on port 3000
Client connected
Executing copilot with prompt: <message>
Copilot stderr: Error: No authentication information found.
```

## Solution Required

### Option 1: Interactive Authentication (RECOMMENDED)
Authenticate once interactively, saving OAuth credentials:

```bash
# Enter the container
docker exec -it copilot-web bash

# Start copilot
/usr/local/bin/copilot

# In the CLI, execute
/login

# Follow instructions (GitHub device code flow)
# Credentials are saved in /root/.config/copilot/
```

**Advantages**:
- Full OAuth authentication
- Persistent credentials (mounted volume)
- Works like VS Code

**Prerequisites**:
- Active GitHub Copilot subscription
- Browser access for device code flow

### Option 2: Rebuild with Direct APIs
Replace Copilot CLI with direct API calls:
- **OpenAI API** (GPT-4o, GPT-4-turbo)
- **Anthropic API** (Claude Sonnet, Claude Opus)

**Advantages**:
- No authentication issues
- More control over implementation
- Faster and more reliable

**Disadvantages**:
- Requires backend rewrite
- Needs separate API key (OpenAI/Anthropic)
- Loses GitHub MCP server integration

## Useful Commands

### Build and Deploy
```bash
cd /path/to/copilot-web
docker compose build copilot-web
docker compose up -d copilot-web
```

### Debugging
```bash
# Real-time logs
docker compose logs -f copilot-web

# Last 50 lines
docker compose logs copilot-web --tail 50

# Enter container
docker exec -it copilot-web bash

# Manual copilot test
docker exec copilot-web /usr/local/bin/copilot -p "hello" --allow-all-tools
```

### Rebuild After Changes
```bash
docker compose build copilot-web && docker compose up -d copilot-web
```

## Next Steps

1. **Authenticate Copilot CLI** (option 1)
   ```bash
   docker exec -it copilot-web bash
   /usr/local/bin/copilot
   # Then /login
   ```

2. **Test Functionality**
   - Open https://copilot.example.com (your configured domain)
   - Send message "how does docker work?"
   - Verify response

3. **Future Improvements** (optional):
   - Add SSO/authentication (OAuth, SAML, etc.)
   - Token-by-token response streaming
   - Conversation history
   - Multi-session support
   - Code syntax highlighting in responses
   - File upload for code analysis

## Technical Notes

- **Internal Port**: 3000
- **WebSocket Protocol**: ws:// (http) or wss:// (https) automatic
- **Spawn Timeout**: None (waits for Copilot response)
- **Memory Limit**: Not set (Docker default)
- **CPU Limit**: Not set (Docker default)

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

---

**Created**: December 23, 2025  
**Status**: Functional but blocked on authentication  
**Next Action**: Interactive Copilot CLI login
