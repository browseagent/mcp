# BrowseAgent MCP Configuration Guide

> **Complete configuration guide for BrowseAgent MCP Server** - Setup instructions for all MCP clients, advanced configuration options, and deployment scenarios.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [MCP Client Configuration](#mcp-client-configuration)
- [Server Configuration](#server-configuration)
- [Chrome Extension Setup](#chrome-extension-setup)
- [Advanced Configuration](#advanced-configuration)
- [Environment Variables](#environment-variables)
- [Security Configuration](#security-configuration)
- [Performance Tuning](#performance-tuning)
- [Deployment Scenarios](#deployment-scenarios)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Minimal Setup (Recommended)

The simplest way to get started with BrowseAgent MCP:

```json
{
  "mcpServers": {
    "browseagent": {
      "command": "npx",
      "args": ["@browseagent/mcp@latest"]
    }
  }
}
```

This configuration:
- ✅ Uses the latest version automatically
- ✅ Works with default settings
- ✅ Enables all browser automation features
- ✅ Requires only Chrome extension installation

---

## MCP Client Configuration

### Claude Desktop

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)  
**Location**: `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

#### Basic Configuration
```json
{
  "mcpServers": {
    "browseagent": {
      "command": "npx",
      "args": ["@browseagent/mcp@latest"]
    }
  }
}
```

#### Development Configuration
```json
{
  "mcpServers": {
    "browseagent-dev": {
      "command": "npx",
      "args": [
        "@browseagent/mcp@latest",
        "--debug",
        "--port", "8765"
      ]
    }
  }
}
```

#### Local Development Configuration
```json
{
  "mcpServers": {
    "browseagent-local": {
      "command": "node",
      "args": ["/absolute/path/to/project/src/index.js", "--debug"],
      "cwd": "/absolute/path/to/project"
    }
  }
}
```

### Visual Studio Code (MCP Extension)

**File**: `.vscode/settings.json`

```json
{
  "mcp.servers": {
    "browseagent": {
      "command": "npx",
      "args": ["@browseagent/mcp@latest"],
      "description": "Browser automation for VS Code"
    }
  }
}
```

### Cursor IDE

**File**: `cursor_config.json` or IDE settings

```json
{
  "mcpServers": {
    "browseagent": {
      "command": "npx", 
      "args": ["@browseagent/mcp@latest"],
      "capabilities": ["tools"]
    }
  }
}
```

### Windsurf IDE

**File**: windsurf MCP configuration

```json
{
  "tools": {
    "browseagent": {
      "type": "mcp",
      "command": "npx",
      "args": ["@browseagent/mcp@latest"]
    }
  }
}
```

### Zed Editor

**File**: `~/.config/zed/settings.json`

```json
{
  "experimental": {
    "mcp": {
      "servers": {
        "browseagent": {
          "command": "npx",
          "args": ["@browseagent/mcp@latest"]
        }
      }
    }
  }
}
```

### Aider

**Command line usage:**
```bash
# Use with aider
aider --mcp-server "npx @browseagent/mcp@latest"

# Or with config file
aider --config aider_config.json
```

**Config file** (`aider_config.json`):
```json
{
  "mcp-servers": {
    "browseagent": {
      "command": "npx",
      "args": ["@browseagent/mcp@latest"]
    }
  }
}
```

### Generic MCP Client

For any MCP-compatible client:

```json
{
  "servers": [
    {
      "name": "browseagent",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["@browseagent/mcp@latest"]
      }
    }
  ]
}
```

---

## Server Configuration

### Command Line Options

All available command line flags and their purposes:

```bash
npx @browseagent/mcp@latest [options]
```

| Flag | Description | Default | Example |
|------|-------------|---------|---------|
| `--debug` | Enable detailed logging | `false` | `--debug` |
| `--port <number>` | WebSocket port for extension | `8765` | `--port 9000` |
| `--config <path>` | Configuration file path | None | `--config ./config.json` |
| `--stdio` | Force STDIO mode | Auto-detected | `--stdio` |
| `--websocket` | Force WebSocket mode (dev) | `false` | `--websocket` |
| `--wait-extension` | Wait for extension on startup | `false` | `--wait-extension` |

#### Example Configurations

**Debug Mode:**
```json
{
  "command": "npx",
  "args": ["@browseagent/mcp@latest", "--debug"]
}
```

**Custom Port:**
```json
{
  "command": "npx", 
  "args": ["@browseagent/mcp@latest", "--port", "9000"]
}
```

**Multiple Options:**
```json
{
  "command": "npx",
  "args": [
    "@browseagent/mcp@latest", 
    "--debug",
    "--port", "8765",
    "--wait-extension"
  ]
}
```

### Configuration File

Create a `browseagent.config.json` file for advanced settings:

```json
{
  "server": {
    "debug": false,
    "logLevel": "info",
    "port": 8765,
    "host": "127.0.0.1",
    "timeout": 30000
  },
  "extension": {
    "heartbeatInterval": 30000,
    "connectionTimeout": 60000,
    "maxRetries": 3,
    "retryDelay": 5000
  },
  "tools": {
    "toolTimeout": 60000,
    "maxConcurrentTools": 5,
    "screenshotQuality": 0.8
  },
  "security": {
    "allowedOrigins": [
      "chrome-extension://*",
      "ws://localhost:*"
    ],
    "maxMessageSize": 10485760
  },
  "performance": {
    "maxMemoryUsage": 536870912,
    "gcInterval": 300000
  },
  "features": {
    "enableCursor": true,
    "enableSnapshots": true,
    "enableScreenshots": true,
    "enableConsoleCapture": true
  }
}
```

**Usage:**
```json
{
  "command": "npx",
  "args": ["@browseagent/mcp@latest", "--config", "./browseagent.config.json"]
}
```

---

## Chrome Extension Setup

### Installation

1. **Install from Chrome Web Store** (Recommended)
   ```
   https://chrome.google.com/webstore/detail/browseagent
   ```

### Extension Configuration

#### Basic Setup
1. **Click extension icon** in Chrome toolbar
2. **Click "Connect"** button
3. **Verify connection** status (should show green)

#### Advanced Extension Settings

Open extension popup and configure:

```
    serverUrl =  ws://localhost:8765
    autoConnect =  true
```

#### Custom Server URL

If using a custom port:

```
    serverUrl =  ws://localhost:9000
```

#### Development Mode

For extension development:

```
    serverUrl =  ws://localhost:8765
    autoConnect =  false
```

---

## Advanced Configuration

### Multiple Server Instances

Run multiple BrowseAgent servers for different purposes:

```json
{
  "mcpServers": {
    "browseagent-production": {
      "command": "npx",
      "args": ["@browseagent/mcp@latest"]
    },
    "browseagent-development": {
      "command": "npx",
      "args": [
        "@browseagent/mcp@latest",
        "--debug",
        "--port", "8766"
      ]
    },
    "browseagent-testing": {
      "command": "npx",
      "args": [
        "@browseagent/mcp@latest",
        "--websocket",
        "--port", "8767"
      ]
    }
  }
}
```

### Environment-Specific Configurations

#### Development Environment
```json
{
  "browseagent-dev": {
    "command": "npx",
    "args": [
      "@browseagent/mcp@latest",
      "--debug",
      "--wait-extension",
      "--config", "./config/development.json"
    ],
    "env": {
      "NODE_ENV": "development",
      "DEBUG": "browseagent:*"
    }
  }
}
```

#### Production Environment
```json
{
  "browseagent-prod": {
    "command": "npx",
    "args": [
      "@browseagent/mcp@latest",
      "--config", "./config/production.json"
    ],
    "env": {
      "NODE_ENV": "production"
    }
  }
}
```

#### Testing Environment
```json
{
  "browseagent-test": {
    "command": "npx",
    "args": [
      "@browseagent/mcp@latest",
      "--websocket",
      "--debug",
      "--config", "./config/testing.json"
    ],
    "env": {
      "NODE_ENV": "test",
      "HEADLESS": "true"
    }
  }
}
```

### Custom Working Directory

```json
{
  "browseagent": {
    "command": "npx",
    "args": ["@browseagent/mcp@latest"],
    "cwd": "/path/to/workspace"
  }
}
```

---

## Environment Variables

### Server Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Runtime environment | `production` | `development` |
| `DEBUG` | Debug scope filter | None | `browseagent:*` |
| `BROWSEAGENT_PORT` | WebSocket port | `8765` | `9000` |
| `BROWSEAGENT_HOST` | Bind host | `127.0.0.1` | `0.0.0.0` |
| `BROWSEAGENT_LOG_LEVEL` | Logging level | `info` | `debug` |
| `BROWSEAGENT_CONFIG` | Config file path | None | `./config.json` |

#### Example Usage

**In MCP configuration:**
```json
{
  "browseagent": {
    "command": "npx",
    "args": ["@browseagent/mcp@latest"],
    "env": {
      "NODE_ENV": "development",
      "DEBUG": "browseagent:*",
      "BROWSEAGENT_PORT": "8766",
      "BROWSEAGENT_LOG_LEVEL": "debug"
    }
  }
}
```

**In shell:**
```bash
export NODE_ENV=development
export DEBUG=browseagent:*
export BROWSEAGENT_PORT=8766
npx @browseagent/mcp@latest
```

### Client Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MCP_BROWSEAGENT_TIMEOUT` | Request timeout | `60000` |
| `MCP_BROWSEAGENT_RETRIES` | Max retry attempts | `3` |


---

## Performance Tuning

### Memory Configuration

```json
{
  "performance": {
    "maxMemoryUsage": 536870912,
    "gcInterval": 300000,
    "maxConcurrentTools": 5,
    "requestTimeout": 30000
  }
}
```

### Node.js Performance Flags

```json
{
  "browseagent": {
    "command": "node",
    "args": [
      "--max-old-space-size=512",
      "--gc-interval=100",
      "node_modules/@browseagent/mcp/src/index.js"
    ]
  }
}
```

### Screenshot Quality Optimization

```json
{
  "tools": {
    "screenshotQuality": 0.8,
    "maxScreenshotSize": 1920,
    "screenshotFormat": "png"
  }
}
```

### Connection Optimization

```json
{
  "extension": {
    "heartbeatInterval": 30000,
    "connectionTimeout": 60000,
    "maxRetries": 3,
    "retryDelay": 5000,
    "keepAlive": true
  }
}
```

---


## Troubleshooting

### Common Configuration Issues

#### 1. Server Won't Start

**Problem**: `EADDRINUSE` error
```bash
Error: listen EADDRINUSE: address already in use :::8765
```

**Solutions:**
```json
// Option 1: Use different port
{
  "args": ["@browseagent/mcp@latest", "--port", "8766"]
}

// Option 2: Kill existing process
// killall -9 node

// Option 3: Auto-detect available port
{
  "args": ["@browseagent/mcp@latest", "--port", "auto"]
}
```

#### 2. Extension Connection Failed

**Problem**: Extension can't connect

**Debug steps:**
1. Verify server is running: `netstat -an | grep 8765`
2. Check extension popup for error messages
3. Review server logs: `--debug` flag
4. Test WebSocket manually: `wscat -c ws://localhost:8765`

#### 3. MCP Client Can't Find Server

**Problem**: Client reports server not found

**Solutions:**
```json
// Option 1: Use absolute path
{
  "command": "/usr/local/bin/node",
  "args": ["/absolute/path/to/@browseagent/mcp/src/index.js"]
}

// Option 2: Install globally
// npm install -g @browseagent/mcp@latest

// Option 3: Use npx with full path
{
  "command": "npx", 
  "args": ["@browseagent/mcp@latest"],
  "cwd": "/path/to/working/directory"
}
```

### Debug Configuration

**Maximum debug output:**
```json
{
  "browseagent-debug": {
    "command": "npx",
    "args": [
      "@browseagent/mcp@latest",
      "--debug",
      "--websocket"
    ],
    "env": {
      "DEBUG": "*",
      "NODE_ENV": "development",
      "BROWSEAGENT_LOG_LEVEL": "debug"
    }
  }
}
```

### Validation Commands

**Test configuration:**
```bash
# Test server startup
npx @browseagent/mcp@latest --debug --websocket

# Test extension connection
npm run test:connection

# Validate configuration file
node -e "console.log(JSON.parse(require('fs').readFileSync('./config.json')))"
```

### Health Check Endpoint

```bash
# Check server health (WebSocket mode)
curl -X GET http://localhost:8765/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "version": "1.0.0"
}
```

---

## Configuration Templates

### Template: Basic Claude Desktop
```json
{
  "mcpServers": {
    "browseagent": {
      "command": "npx",
      "args": ["@browseagent/mcp@latest"]
    }
  }
}
```

### Template: Development Setup
```json
{
  "mcpServers": {
    "browseagent-dev": {
      "command": "npx",
      "args": [
        "@browseagent/mcp@latest",
        "--debug",
        "--port", "8765",
        "--wait-extension"
      ],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "browseagent:*"
      }
    }
  }
}
```

### Template: Production Setup
```json
{
  "mcpServers": {
    "browseagent": {
      "command": "npx",
      "args": [
        "@browseagent/mcp@latest",
        "--config", "./production.config.json"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Template: Corporate Environment
```json
{
  "mcpServers": {
    "browseagent-corp": {
      "command": "npx",
      "args": [
        "@browseagent/mcp@latest",
        "--port", "8765"
      ],
      "env": {
        "HTTP_PROXY": "http://proxy.company.com:8080",
        "HTTPS_PROXY": "http://proxy.company.com:8080",
        "NODE_ENV": "production"
      }
    }
  }
}
```

---

## Support

- 📖 **Full Documentation**: [README.md](../README.md)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/browseagent/mcp/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/browseagent/mcp/discussions)
- 📧 **Email**: hello@browseagent.pro