# Browseagent MCP

[![npm version](https://badge.fury.io/js/%40browseagent%2Fmcp.svg)](https://www.npmjs.com/package/@browseagent/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

<p align="left">
   Control web browsers directly through AI applications conversation interface using the Model Context Protocol (MCP).
  <br />
  <a href="https://browseagent.pro"><strong>Website</strong></a> 
  •
  <a href="https://docs.browseagent.pro"><strong>Documentation</strong></a>
  •
  <a href="https://discord.gg/mt8pGkgUZj"><strong>Community</strong></a>
</p>


## ✨ Features

- 🌐 **Full Browser Control** - Navigate, click, type, and interact with any website
- 📸 **Screenshots & Analysis** - Capture and analyze web pages visually  
- 🎯 **Smart Element Detection** - AI-powered element identification and interaction
- 🔄 **Real-time Automation** - Dynamic connection with Chrome extension


## 🚀 Quick Start

<a href="https://docs.browseagent.pro"><strong>See Documentation</strong></a>


## 🔒 Security & Privacy

- ✅ **Local Communication** - All data stays on your machine
- ✅ **No Data Collection** - We don't store or transmit your browsing data
- ✅ **Permission Based** - Extension only accesses tabs when explicitly used
- ✅ **Open Source** - Full transparency in code and operations


## 🏗️ Development

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/browseagent/mcp.git
cd mcp

# Install dependencies
npm install

# Create global symlink for development
npm link

# Test the server
npm run test
```

### Testing with Claude Desktop (Development)

For local development and testing with Claude Desktop:

```bash
# 1. Create global link (one time setup)
npm link

# 2. Configure Claude Desktop to use your local version
```

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "browseagent-dev": {
      "command": "npx",
      "args": ["@browseagent/mcp", "--debug"]
    }
  }
}
```

**Development Workflow:**

1. **Make changes** to your code
2. **Test locally**: `npm test`
3. **Test with Claude Desktop**: Restart Claude Desktop to reload the linked package
4. **Iterate** and repeat

### Alternative: Direct Path Development

For more direct control during development:

```json
{
  "mcpServers": {
    "browseagent-dev": {
      "command": "node",
      "args": ["/absolute/path/to/your/project/src/index.js", "--debug"],
      "cwd": "/absolute/path/to/your/project"
    }
  }
}
```

### Running in Development Mode

```bash
# Run with debugging enabled
npm run dev

# Run with WebSocket mode for extension testing
npm run dev -- --websocket

# Run with watch mode for auto-restart during development
npm run dev -- --websocket --debug
```

### 🧪 Comprehensive Testing Suite

The project includes a full testing suite to validate all components:

#### Core Test Commands

```bash
# Run full test suite
npm test

# Run all manual tests sequentially
npm run test:all

# Watch mode - auto-run tests on file changes
npm run test:watch
```

#### Individual Test Suites

##### 1. Connection Tests (`test:connection`)
```bash
npm run test:connection
```

**What it tests:**
- ✅ Server startup and initialization
- ✅ WebSocket server creation and binding
- ✅ Extension bridge protocol handshake
- ✅ Architecture validation (STDIO vs WebSocket separation)
- ✅ Port conflict resolution
- ✅ Error handling and timeout scenarios

**Use when:** Setting up development environment or diagnosing connection issues.

##### 2. Tools Tests (`test:tools`)
```bash
npm run test:tools
```

**What it tests:**
- ✅ Tool registry loading and structure validation
- ✅ Tool argument validation (required/optional fields)
- ✅ Schema completeness and type checking
- ✅ Tool categorization (navigation, interaction, utility, inspection)
- ✅ Input constraint validation (min/max values, patterns)
- ✅ Error message accuracy for invalid inputs

**Use when:** Adding new tools or modifying existing tool schemas.

##### 3. Debug Tests (`test:debug`)
```bash
npm run test:debug
```

**What it tests:**
- ✅ Bridge ↔ Server communication flow
- ✅ Extension connection event propagation
- ✅ Tool call request/response cycle
- ✅ Mock extension handshake simulation
- ✅ Event listener setup and cleanup
- ✅ Status synchronization between components

**Use when:** Debugging communication issues between bridge and server.

##### 4. Interactive Tool Tests (`test:tool`)
```bash
npm run test:tool
```

**What it provides:**
- 🎮 Interactive CLI for manual tool testing
- 🔧 Real-time tool execution with live extension
- 📊 Connection status monitoring
- 🎯 Specific tool argument input and validation
- 📝 Step-by-step debugging of tool calls

**Use when:** Manually testing specific tools with real browser extension.

#### Test Modes

##### STDIO Mode Testing (Production)
```bash
# Test STDIO mode (what Claude Desktop uses)
node src/index.js --debug

# Send test MCP message
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node src/index.js
```

##### WebSocket Mode Testing (Development)
```bash
# Test WebSocket mode (for extension testing)
node src/index.js --websocket --debug
```

#### Advanced Testing Scenarios

##### Integration Testing
```bash
# Test with specific port
npm run test:connection -- --port 9999

# Test with timeout scenarios
npm run test:debug -- --timeout 5000

```

### Development Tools

#### Linting and Code Quality
```bash
# Run ESLint
npm run lint

```

#### Debugging Tools
```bash
# Verbose logging
npm run dev -- --debug
```

#### Development Scripts
```bash
# Start in development mode
npm run start

# Start with debugging enabled
npm run dev

# Quick development test
npm run dev -- --websocket --debug
```

### Testing Best Practices

#### Before Committing
```bash
# Run full validation suite
npm run test:all
npm run lint

# Test both modes
node src/index.js --debug  # STDIO mode
node src/index.js --websocket --debug  # WebSocket mode
```

#### Continuous Testing During Development
```bash
# Watch mode for automatic test runs
npm run test:watch

# Development mode with auto-restart
nodemon src/index.js -- --websocket --debug
```

#### Testing with Real Extension
1. **Install Chrome extension** 
2. **Run interactive tool tester**: `npm run test:tool`
3. **Connect extension** via popup
4. **Test specific tools** interactively
5. **Verify results** in browser


### Troubleshooting Development Issues

#### Common Development Problems

| Issue | Test Command | Solution |
|-------|-------------|----------|
| Extension not connecting | `npm run test:connection` | Check WebSocket port availability |
| Tool validation failing | `npm run test:tools` | Review tool schema definitions |
| Bridge communication broken | `npm run test:debug` | Verify event listener setup |
| Performance issues | `node --inspect src/index.js` | Profile memory/CPU usage |

#### Debug Logging Levels
```bash
# Minimal logging
node src/index.js

# Standard debug logging
node src/index.js --debug

# Verbose component logging
DEBUG=* node src/index.js --debug

# Specific component debugging
DEBUG=ExtensionBridge,MCPServer node src/index.js --debug
```

### Building from Source

```bash
# Install from source
npm install -g .

# Or run directly
node src/index.js --debug

# Package for distribution
npm pack
```


## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Set up development environment**: `npm install && npm link`
4. **Make your changes and test**: `npm test`
5. **Test with Claude Desktop** using the development configuration
6. **Commit changes**: `git commit -m 'Add amazing feature'`
7. **Push to branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request**

### Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/browseagent-mcp.git
cd browseagent-mcp

# Install dependencies
npm install

# Create development link
npm link

# Install the Chrome extension in development mode
npm run build:extension

# Test your changes
npm test
```

### Development Tools

- **ESLint**: `npm run lint`
- **Tests**: `npm test`
- **Debug mode**: `npm run dev -- --debug`
- **WebSocket mode**: `npm run dev -- --websocket`

## 📝 API Reference

### MCP Protocol

This server implements the [Model Context Protocol](https://modelcontextprotocol.io/) specification:

- **Protocol Version**: `2024-11-05`
- **Capabilities**: Tools
- **Transport**: stdio

### Tool Schemas

All tools follow the MCP tool schema format. See the [API documentation](./docs/api.md) for detailed schemas and examples.

## 🗂️ Project Structure

```
src/
├── index.js              # Main entry point
├── server/               # MCP server implementation
│   ├── MCPServer.js      # Core MCP protocol handler
│   └── transports/       # Communication transports
├── bridge/               # Chrome extension bridge
│   └── ExtensionBridge.js
├── tools/                # Tool definitions and registry
│   └── ToolRegistry.js
├── utils/                # Utilities and helpers
│   └── Logger.js
├── config/               # Configuration management
|    └── Config.js
└── test/                          
    ├── connection.test.js         # Test connection script
    └── tools.test.js              # Test tools script

```

## 📚 Documentation

- 📖 [Tools Reference](./docs/tools.md) 

## 🆘 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/browseagent/mcp/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/browseagent/mcp/discussions)
- 📧 **Email**: hello@browseagent.pro
- 🐦 **Twitter**: [@Browseagent](https://twitter.com/browseagent)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** - For MCP protocol
- **Chrome Extension API** - For enabling secure browser automation
- **Open Source Community** - For tools and inspiration

---

<div align="center">

**[🐦 Follow updates](https://twitter.com/browseagent)** • **[📖 Read docs](https://docs.browseagent.pro)**

Made with ❤️ by the <a href="https://boostgpt.co">BoostGPT</a> team

</div>