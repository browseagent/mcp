# BrowseAgent MCP Server

[![npm version](https://badge.fury.io/js/%40browseagent%2Fmcp.svg)](https://www.npmjs.com/package/@browseagent/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

> **Browser automation MCP server for MCP clients** - Control web browsers directly through AI applications conversation interface using the Model Context Protocol (MCP).

## ✨ Features

- 🌐 **Full Browser Control** - Navigate, click, type, and interact with any website
- 📸 **Screenshots & Analysis** - Capture and analyze web pages visually  
- 🎯 **Smart Element Detection** - AI-powered element identification and interaction
- 🔄 **Real-time Automation** - Dynamic connection with Chrome extension
- 🛡️ **Secure Communication** - Native messaging protocol for safe browser access
- ⚡ **Zero Configuration** - Works out of the box with Claude, Cursor, Windsurf, VSCode, Aider, Zed Editor and other MCP compatiple clients.

## 🚀 Quick Start

### 1. Configure Claude Desktop

Add this to your Claude Desktop MCP settings:

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

### 2. Install Chrome Extension

Install the [BrowseAgent Chrome Extension](https://chrome.google.com/webstore/detail/browseagent) from the Chrome Web Store.

### 3. Connect & Use

1. **Restart Claude Desktop** after adding the MCP configuration
2. **Open the extension popup** and click "Connect"  
3. **Start automating** - try saying: *"Take a screenshot of google.com"*

That's it! 🎉

## 🛠️ Available Tools

| Tool | Description | Example Usage |
|------|-------------|---------------|
| `browser_navigate` | Navigate to any URL | *"Go to github.com"* |
| `browser_click` | Click elements on page | *"Click the search button"* |
| `browser_type` | Type text into inputs | *"Type 'hello world' in the search box"* |
| `browser_screenshot` | Capture page screenshots | *"Take a screenshot of this page"* |
| `browser_snapshot` | Get page structure | *"Analyze this page's layout"* |
| `browser_hover` | Hover over elements | *"Hover over the menu"* |
| `browser_drag_drop` | Drag and drop elements | *"Drag the file to the upload area"* |
| `browser_wait` | Wait/pause execution | *"Wait 3 seconds"* |
| `browser_press_key` | Press keyboard keys | *"Press Enter"* |
| `browser_go_back` | Navigate back | *"Go back to the previous page"* |
| `browser_go_forward` | Navigate forward | *"Go forward one page"* |
| `browser_get_console_logs` | Get console output | *"Check the console for errors"* |

## 💬 Example Conversations

### Basic Navigation
```
You: "Navigate to reddit.com and take a screenshot"
AI agent: I'll help you navigate to Reddit and take a screenshot.

*[Navigates to reddit.com and captures screenshot]*

Here's the current Reddit homepage. I can see the main feed with various posts...
```

### Form Automation  
```
You: "Go to the contact form and fill it out with my details"
AI agent: I'll help you fill out the contact form. Let me first take a screenshot to see the form...

*[Takes screenshot, identifies form fields, fills them out]*

I've successfully filled out the contact form with the provided information.
```

### Page Analysis
```
You: "Analyze this e-commerce page for usability issues"
AI agent: I'll analyze this page for usability. Let me take a screenshot and examine the structure...

*[Captures screenshot and page structure]*

Based on my analysis, I found several usability considerations:
1. The search bar could be more prominent...
2. Navigation could be simplified...
```

## ⚙️ Configuration

### MCP Server Options

You can customize the server behavior:

```json
{
  "mcpServers": {
    "browseagent": {
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

**Available flags:**
- `--debug` - Enable detailed logging
- `--port <number>` - WebSocket port (default: 8765)
- `--websocket` - Use WebSocket mode for testing
- `--wait-extension` - Wait for extension before starting

### Chrome Extension Settings

Open the extension popup to:
- ✅ Check connection status  
- 🔗 Manually connect/disconnect
- 🐛 Access debug information
- 📊 View usage statistics

## 🔧 Troubleshooting

### "Extension not connected"
1. **Install the Chrome extension** from the Web Store
2. **Click "Connect"** in the extension popup  
3. **Restart MCP client** if needed

### "MCP server not found"
1. **Check Node.js version** - Requires Node.js 18.0.0+
2. **Verify MCP configuration** in MCP client settings
3. **Try running manually**: `npx @browseagent/mcp@latest --debug`

### "Tools not working"
1. **Ensure extension is connected** (check popup)
2. **Check browser permissions** - Extension needs tab access
3. **Try refreshing the page** you're automating

### Common Issues

| Issue | Solution |
|-------|----------|
| `EACCES` permission error | Run with `sudo` on Linux/macOS |
| Extension not found | Install from Chrome Web Store |
| Connection timeout | Check firewall settings |
| Tools returning errors | Ensure page is fully loaded |

## 🔒 Security & Privacy

- ✅ **Local Communication** - All data stays on your machine
- ✅ **Secure Protocol** - Uses Chrome's native messaging API
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

# Run tests
npm test

# Run specific tests
npm run test:connection
npm run test:tools
```

### Building from Source

```bash
# Install from source
npm install -g .

# Or run directly
node src/index.js --debug
```

### Testing

```bash
# Run full test suite
npm test

# Test connection
npm run test:connection

# Test specific tools
npm run test:tools

# Manual MCP protocol test
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node src/index.js
```

#### Test STDIO mode (what Claude Desktop uses)
node src/index.js --debug

#### Test WebSocket mode (for extension testing)
node src/index.js --websocket --debug


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
- **Transport**: stdio (native messaging)

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

- 📖 [API Reference](./docs/api.md) 
- 🔧 [Configuration Guide](./docs/configuration.md)
- 🚀 [Advanced Usage](./docs/advanced.md)
- 🐛 [Troubleshooting Guide](./docs/troubleshooting.md)
- 🤝 [Contributing Guide](./CONTRIBUTING.md)

## 🆘 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/browseagent/mcp/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/browseagent/mcp/discussions)
- 📧 **Email**: hello@browseagent.pro
- 🐦 **Twitter**: [@BrowseAgent](https://twitter.com/browseagent)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** - For MCP protocol
- **Chrome Extension API** - For enabling secure browser automation
- **Open Source Community** - For tools and inspiration

---

<div align="center">

**[🌟 Star us on GitHub](https://github.com/browseagent/mcp)** • **[🐦 Follow updates](https://twitter.com/browseagent)** • **[📖 Read docs](./docs/)**

Made with ❤️ by the BoostGPT team

</div>