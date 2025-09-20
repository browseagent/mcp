# Browseagent MCP Tools Reference

> **Complete Tools documentation for Browseagent MCP Server** - Detailed schemas, examples, and usage patterns for all browser automation tools.

## 📋 Table of Contents

- [Overview](#overview)
- [MCP Protocol Implementation](#mcp-protocol-implementation)
- [Tool Categories](#tool-categories)
- [Navigation Tools](#navigation-tools)
- [Interaction Tools](#interaction-tools)
- [Inspection Tools](#inspection-tools)
- [Utility Tools](#utility-tools)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

## Overview

Browseagent MCP Server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) specification to provide browser automation capabilities to AI applications. All tools follow the MCP tool schema format and return structured responses.

### Protocol Details

- **Protocol Version**: `2024-11-05`
- **Capabilities**: `tools`
- **Transport**: `stdio` (primary), `websocket` (extension bridge)
- **Total Tools**: 12 browser automation tools

## MCP Protocol Implementation

### Server Information

```json
{
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "tools": {}
  },
  "serverInfo": {
    "name": "browseagent-mcp",
    "version": "1.0.0",
    "description": "Browser automation MCP server for MCP clients"
  }
}
```

### Tool Response Format

All tools return responses in MCP content format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Tool execution result or description"
    },
    {
      "type": "image", 
      "data": "base64-encoded-image-data",
      "mimeType": "image/png"
    }
  ]
}
```

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| **Navigation** | `browser_navigate`, `browser_go_back`, `browser_go_forward` | URL navigation and history |
| **Interaction** | `browser_click`, `browser_hover`, `browser_type`, `browser_drag_drop` | Page element interaction |
| **Inspection** | `browser_snapshot`, `browser_screenshot`, `browser_get_console_logs` | Page analysis and debugging |
| **Utility** | `browser_wait`, `browser_press_key` | Helper functions and timing |

---

## Navigation Tools

### `browser_navigate`

Navigate to a URL in a new or existing browser tab.

#### Schema
```json
{
  "name": "browser_navigate",
  "description": "Navigate to a URL in a new or existing tab",
  "inputSchema": {
    "type": "object",
    "properties": {
      "url": {
        "type": "string",
        "description": "The URL to navigate to"
      },
      "tabId": {
        "type": "number",
        "description": "Existing tab ID (optional)"
      }
    },
    "required": ["url"]
  }
}
```

#### Examples

**Basic Navigation:**
```json
{
  "name": "browser_navigate",
  "arguments": {
    "url": "https://github.com"
  }
}
```

**Navigate in Specific Tab:**
```json
{
  "name": "browser_navigate", 
  "arguments": {
    "url": "https://github.com/browse-agent/mcp",
    "tabId": 123
  }
}
```

#### Response
```json
{
  "content": [
    {
      "type": "text",
      "text": "Successfully navigated to https://github.com in tab 456"
    }
  ]
}
```

### `browser_go_back`

Navigate back to the previous page in browser history.

#### Schema
```json
{
  "name": "browser_go_back",
  "description": "Go back to the previous page",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tabId": {
        "type": "number",
        "description": "Tab ID (optional, uses active tab if not provided)"
      }
    }
  }
}
```

#### Examples

**Go Back in Active Tab:**
```json
{
  "name": "browser_go_back",
  "arguments": {}
}
```

**Go Back in Specific Tab:**
```json
{
  "name": "browser_go_back",
  "arguments": {
    "tabId": 123
  }
}
```

### `browser_go_forward`

Navigate forward to the next page in browser history.

#### Schema
```json
{
  "name": "browser_go_forward",
  "description": "Go forward to the next page", 
  "inputSchema": {
    "type": "object",
    "properties": {
      "tabId": {
        "type": "number",
        "description": "Tab ID (optional, uses active tab if not provided)"
      }
    }
  }
}
```

---

## Interaction Tools

### `browser_click`

Perform a click action on a web page element.

#### Schema
```json
{
  "name": "browser_click",
  "description": "Perform click on a web page",
  "inputSchema": {
    "type": "object", 
    "properties": {
      "element": {
        "type": "string",
        "description": "Human-readable element description used to obtain permission to interact with the element"
      },
      "ref": {
        "type": "string", 
        "description": "Exact target element reference from the page snapshot"
      },
      "tabId": {
        "type": "number",
        "description": "Tab ID (optional, uses active tab if not provided)"
      }
    },
    "required": ["element", "ref"]
  }
}
```

#### Examples

**Click a Button:**
```json
{
  "name": "browser_click",
  "arguments": {
    "element": "Submit button",
    "ref": "button#submit-btn-1"
  }
}
```

**Click a Link:**
```json
{
  "name": "browser_click",
  "arguments": {
    "element": "Documentation link in navigation",
    "ref": "nav a[href='/docs']"
  }
}
```

#### Best Practices
- Always take a `browser_snapshot` first to get accurate element references
- Use descriptive `element` descriptions for better AI understanding
- The `ref` should be the exact selector from the snapshot

### `browser_type`

Type text into an editable element (input, textarea, contenteditable).

#### Schema
```json
{
  "name": "browser_type",
  "description": "Type text into editable element",
  "inputSchema": {
    "type": "object",
    "properties": {
      "element": {
        "type": "string",
        "description": "Human-readable element description used to obtain permission to interact with the element"
      },
      "ref": {
        "type": "string",
        "description": "Exact target element reference from the page snapshot" 
      },
      "text": {
        "type": "string",
        "description": "Text to type into the element"
      },
      "submit": {
        "type": "boolean",
        "description": "Whether to submit entered text (press Enter after)",
        "default": false
      },
      "tabId": {
        "type": "number",
        "description": "Tab ID (optional, uses active tab if not provided)"
      }
    },
    "required": ["element", "ref", "text"]
  }
}
```

#### Examples

**Type in Search Box:**
```json
{
  "name": "browser_type",
  "arguments": {
    "element": "Search input field",
    "ref": "input#search-query",
    "text": "browser automation"
  }
}
```

**Type and Submit:**
```json
{
  "name": "browser_type",
  "arguments": {
    "element": "Search box",
    "ref": "input[name='q']",
    "text": "MCP protocol documentation",
    "submit": true
  }
}
```

**Form Field Entry:**
```json
{
  "name": "browser_type",
  "arguments": {
    "element": "Email address input",
    "ref": "input[type='email']#email",
    "text": "user@example.com"
  }
}
```

### `browser_hover`

Hover over an element to trigger hover states or reveal hidden content.

#### Schema
```json
{
  "name": "browser_hover",
  "description": "Hover over element on page",
  "inputSchema": {
    "type": "object",
    "properties": {
      "element": {
        "type": "string",
        "description": "Human-readable element description used to obtain permission to interact with the element"
      },
      "ref": {
        "type": "string",
        "description": "Exact target element reference from the page snapshot"
      },
      "tabId": {
        "type": "number",
        "description": "Tab ID (optional, uses active tab if not provided)"
      }
    },
    "required": ["element", "ref"]
  }
}
```

#### Examples

**Hover over Menu:**
```json
{
  "name": "browser_hover",
  "arguments": {
    "element": "Main navigation menu",
    "ref": "nav#main-menu"
  }
}
```

### `browser_drag_drop`

Perform drag and drop operation between two elements.

#### Schema
```json
{
  "name": "browser_drag_drop",
  "description": "Perform drag and drop between two elements",
  "inputSchema": {
    "type": "object",
    "properties": {
      "sourceElement": {
        "type": "string",
        "description": "Human-readable description of the source element"
      },
      "sourceRef": {
        "type": "string",
        "description": "Source element reference from the page snapshot"
      },
      "targetElement": {
        "type": "string", 
        "description": "Human-readable description of the target element"
      },
      "targetRef": {
        "type": "string",
        "description": "Target element reference from the page snapshot"
      },
      "tabId": {
        "type": "number",
        "description": "Tab ID (optional, uses active tab if not provided)"
      }
    },
    "required": ["sourceElement", "sourceRef", "targetElement", "targetRef"]
  }
}
```

#### Examples

**File Upload Drag & Drop:**
```json
{
  "name": "browser_drag_drop",
  "arguments": {
    "sourceElement": "File item in file list",
    "sourceRef": ".file-item[data-name='document.pdf']",
    "targetElement": "Upload drop zone",
    "targetRef": ".upload-dropzone"
  }
}
```

---

## Inspection Tools

### `browser_snapshot`

Capture the accessibility snapshot of the current page to analyze structure and get element references.

#### Schema
```json
{
  "name": "browser_snapshot",
  "description": "Capture accessibility snapshot of the current page. Use this for getting references to elements to interact with.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tabId": {
        "type": "number",
        "description": "Tab ID (optional, uses active tab if not provided)"
      }
    }
  }
}
```

#### Examples

**Basic Snapshot:**
```json
{
  "name": "browser_snapshot",
  "arguments": {}
}
```

#### Response Format
```json
{
  "content": [
    {
      "type": "text",
      "text": "Page accessibility snapshot:\n\n<html>\n  <body>\n    <nav id=\"main-nav\">\n      <a href=\"/home\" ref=\"nav#main-nav a[href='/home']\">Home</a>\n      <a href=\"/about\" ref=\"nav#main-nav a[href='/about']\">About</a>\n    </nav>\n    <main>\n      <h1 ref=\"h1\">Welcome to Our Site</h1>\n      <button id=\"cta-button\" ref=\"button#cta-button\">Get Started</button>\n      <input type=\"search\" placeholder=\"Search...\" ref=\"input[type='search']\"/>\n    </main>\n  </body>\n</html>"
    }
  ]
}
```

#### Usage Pattern
Always use `browser_snapshot` before interacting with page elements to get accurate `ref` values:

```
1. browser_snapshot → Get page structure and element refs
2. browser_click → Use ref from snapshot
```

### `browser_screenshot`

Take a screenshot of the current page or specific element.

#### Schema
```json
{
  "name": "browser_screenshot",
  "description": "Take a screenshot of the current page",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tabId": {
        "type": "number",
        "description": "Tab ID (optional, uses active tab if not provided)"
      },
      "fullPage": {
        "type": "boolean",
        "description": "Whether to capture the full page",
        "default": false
      },
      "element": {
        "type": "string",
        "description": "Human-readable element description (optional)"
      },
      "ref": {
        "type": "string",
        "description": "Element reference to screenshot (optional)"
      }
    }
  }
}
```

#### Examples

**Viewport Screenshot:**
```json
{
  "name": "browser_screenshot",
  "arguments": {}
}
```

**Full Page Screenshot:**
```json
{
  "name": "browser_screenshot",
  "arguments": {
    "fullPage": true
  }
}
```

**Element Screenshot:**
```json
{
  "name": "browser_screenshot",
  "arguments": {
    "element": "Main content area",
    "ref": "main#content"
  }
}
```

#### Response Format
```json
{
  "content": [
    {
      "type": "image",
      "data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
      "mimeType": "image/png"
    },
    {
      "type": "text", 
      "text": "Screenshot captured successfully (1920x1080)"
    }
  ]
}
```

### `browser_get_console_logs`

Retrieve console logs from the browser for debugging purposes.

#### Schema
```json
{
  "name": "browser_get_console_logs",
  "description": "Get the console logs from the browser",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tabId": {
        "type": "number",
        "description": "Tab ID (optional, uses active tab if not provided)"
      }
    }
  }
}
```

#### Examples

**Get Console Logs:**
```json
{
  "name": "browser_get_console_logs",
  "arguments": {}
}
```

#### Response Format
```json
{
  "content": [
    {
      "type": "text",
      "text": "Console logs:\n\n[INFO] Page loaded successfully\n[ERROR] Failed to load resource: net::ERR_BLOCKED_BY_CLIENT\n[WARNING] Deprecated API usage detected\n[DEBUG] User interaction tracked"
    }
  ]
}
```

---

## Utility Tools

### `browser_wait`

Wait for a specified amount of time before proceeding.

#### Schema
```json
{
  "name": "browser_wait",
  "description": "Wait for a specified time in seconds",
  "inputSchema": {
    "type": "object",
    "properties": {
      "time": {
        "type": "number",
        "description": "The time to wait in seconds",
        "minimum": 0.1,
        "maximum": 30
      }
    },
    "required": ["time"]
  }
}
```

#### Examples

**Wait 2 seconds:**
```json
{
  "name": "browser_wait",
  "arguments": {
    "time": 2
  }
}
```

**Wait 500ms:**
```json
{
  "name": "browser_wait", 
  "arguments": {
    "time": 0.5
  }
}
```

### `browser_press_key`

Press a keyboard key or key combination.

#### Schema
```json
{
  "name": "browser_press_key",
  "description": "Press a key on the keyboard",
  "inputSchema": {
    "type": "object",
    "properties": {
      "key": {
        "type": "string",
        "description": "Name of the key to press or a character to generate, such as `ArrowLeft` or `a`"
      },
      "tabId": {
        "type": "number",
        "description": "Tab ID (optional, uses active tab if not provided)"
      }
    },
    "required": ["key"]
  }
}
```

#### Examples

**Press Enter:**
```json
{
  "name": "browser_press_key",
  "arguments": {
    "key": "Enter"
  }
}
```

**Press Escape:**
```json
{
  "name": "browser_press_key",
  "arguments": {
    "key": "Escape"
  }
}
```

**Press Character:**
```json
{
  "name": "browser_press_key",
  "arguments": {
    "key": "a"
  }
}
```

#### Supported Keys
- **Characters**: `a`, `b`, `c`, etc.
- **Special Keys**: `Enter`, `Escape`, `Tab`, `Space`, `Backspace`, `Delete`
- **Arrow Keys**: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- **Function Keys**: `F1`, `F2`, ..., `F12`
- **Modifier Keys**: `Shift`, `Control`, `Alt`, `Meta`

---

## Response Formats

### Success Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "Action completed successfully"
    }
  ]
}
```

### Response with Image

```json
{
  "content": [
    {
      "type": "image",
      "data": "base64-encoded-png-data",
      "mimeType": "image/png"
    },
    {
      "type": "text",
      "text": "Screenshot captured (1920x1080)"
    }
  ]
}
```

### Response with Structured Data

```json
{
  "content": [
    {
      "type": "text", 
      "text": "{\n  \"url\": \"https://example.com\",\n  \"title\": \"Example Page\",\n  \"elements\": [\n    {\n      \"tag\": \"button\",\n      \"ref\": \"button#submit\",\n      \"text\": \"Submit\"\n    }\n  ]\n}"
    }
  ]
}
```

---

## Error Handling

### Common Error Types

#### Extension Not Connected
```json
{
  "error": {
    "code": -32603,
    "message": "Tool browser_navigate requires Chrome extension, but extension is not connected"
  }
}
```

#### Invalid Arguments
```json
{
  "error": {
    "code": -32602,
    "message": "Missing required argument: url"
  }
}
```

#### Element Not Found
```json
{
  "error": {
    "code": -32603,
    "message": "Element not found: button#submit-btn-1"
  }
}
```

#### Navigation Failed
```json
{
  "error": {
    "code": -32603,
    "message": "Navigation failed: net::ERR_NAME_NOT_RESOLVED"
  }
}
```

### Error Recovery Strategies

1. **Element Not Found**: Take a new snapshot and use updated refs
2. **Navigation Timeout**: Wait and retry with increased timeout
3. **Extension Disconnected**: Reconnect extension and retry
4. **Invalid Selector**: Use browser_snapshot to get valid selectors

---

## Best Practices

### 🎯 Element Interaction Workflow

1. **Always snapshot first**: Get current page structure
2. **Use descriptive element names**: Help AI understand context
3. **Wait for dynamic content**: Use `browser_wait` after navigation
4. **Verify actions**: Take screenshots to confirm results

```json
// 1. Get page structure
{"name": "browser_snapshot", "arguments": {}}

// 2. Click with accurate ref
{
  "name": "browser_click",
  "arguments": {
    "element": "Login button in header",
    "ref": "header button[data-action='login']"
  }
}

// 3. Verify result
{"name": "browser_screenshot", "arguments": {}}
```

### 🔄 Common Automation Patterns

#### Form Filling
```json
// 1. Snapshot to see form structure
{"name": "browser_snapshot", "arguments": {}}

// 2. Fill each field
{
  "name": "browser_type",
  "arguments": {
    "element": "Email input",
    "ref": "input[type='email']",
    "text": "user@example.com"
  }
}

// 3. Submit form
{
  "name": "browser_click",
  "arguments": {
    "element": "Submit button", 
    "ref": "button[type='submit']"
  }
}
```

#### Search and Navigate
```json
// 1. Type search query
{
  "name": "browser_type",
  "arguments": {
    "element": "Search box",
    "ref": "input[name='search']",
    "text": "query here",
    "submit": true
  }
}

// 2. Wait for results
{"name": "browser_wait", "arguments": {"time": 2}}

// 3. Screenshot results
{"name": "browser_screenshot", "arguments": {}}
```

### ⚡ Performance Tips

- **Minimize snapshots**: Only when page structure changes
- **Use specific selectors**: Prefer IDs and unique attributes
- **Wait appropriately**: Don't over-wait, but account for loading
- **Batch related actions**: Group logically related operations

### 🛡️ Error Prevention

- **Validate URLs**: Ensure proper format before navigation
- **Check element existence**: Always snapshot before interaction
- **Handle dynamic content**: Wait for AJAX/loading to complete
- **Use fallback selectors**: Have backup element identification

### 📱 Cross-Browser Considerations

- **Selector compatibility**: Use standard CSS selectors
- **Timing differences**: Adjust waits for different browser speeds
- **Feature detection**: Some tools may behave differently per browser

---

## Changelog

### Version 1.0.0
- ✅ Initial release with 12 core tools
- ✅ Full MCP protocol compliance
- ✅ Chrome extension integration
- ✅ Comprehensive error handling
- ✅ Screenshot and snapshot capabilities

---

## Support

- 📖 **README**: [README.md](../README.md)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/browseagent/mcp/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/browseagent/mcp/discussions)
- 📧 **Email**: hello@browseagent.pro