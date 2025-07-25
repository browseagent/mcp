/**
 * Tool Registry
 * 
 * Defines all available browser automation tools and their schemas.
 * This matches the tools defined in the Chrome extension.
 */

export const MCP_TOOLS = {
  browser_navigate: {
    name: 'browser_navigate',
    description: 'Navigate to a URL in a new or existing tab',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to navigate to'
        },
        tabId: {
          type: 'number',
          description: 'Existing tab ID (optional)'
        }
      },
      required: ['url']
    }
  },

  browser_go_back: {
    name: 'browser_go_back',
    description: 'Go back to the previous page',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'Tab ID (optional, uses active tab if not provided)'
        }
      }
    }
  },

  browser_go_forward: {
    name: 'browser_go_forward',
    description: 'Go forward to the next page',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'Tab ID (optional, uses active tab if not provided)'
        }
      }
    }
  },

  browser_wait: {
    name: 'browser_wait',
    description: 'Wait for a specified time in seconds',
    inputSchema: {
      type: 'object',
      properties: {
        time: {
          type: 'number',
          description: 'The time to wait in seconds',
          minimum: 0.1,
          maximum: 30
        }
      },
      required: ['time']
    }
  },

  browser_press_key: {
    name: 'browser_press_key',
    description: 'Press a key on the keyboard',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Name of the key to press or a character to generate, such as `ArrowLeft` or `a`'
        },
        tabId: {
          type: 'number',
          description: 'Tab ID (optional, uses active tab if not provided)'
        }
      },
      required: ['key']
    }
  },

  browser_snapshot: {
    name: 'browser_snapshot',
    description: 'Capture accessibility snapshot of the current page. Use this for getting references to elements to interact with.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'Tab ID (optional, uses active tab if not provided)'
        }
      }
    }
  },

  browser_click: {
    name: 'browser_click',
    description: 'Perform click on a web page',
    inputSchema: {
      type: 'object',
      properties: {
        element: {
          type: 'string',
          description: 'Human-readable element description used to obtain permission to interact with the element'
        },
        ref: {
          type: 'string',
          description: 'Exact target element reference from the page snapshot'
        },
        tabId: {
          type: 'number',
          description: 'Tab ID (optional, uses active tab if not provided)'
        }
      },
      required: ['element', 'ref']
    }
  },

  browser_drag_drop: {
    name: 'browser_drag_drop',
    description: 'Perform drag and drop between two elements',
    inputSchema: {
      type: 'object',
      properties: {
        sourceElement: {
          type: 'string',
          description: 'Human-readable description of the source element'
        },
        sourceRef: {
          type: 'string',
          description: 'Source element reference from the page snapshot'
        },
        targetElement: {
          type: 'string',
          description: 'Human-readable description of the target element'
        },
        targetRef: {
          type: 'string',
          description: 'Target element reference from the page snapshot'
        },
        tabId: {
          type: 'number',
          description: 'Tab ID (optional, uses active tab if not provided)'
        }
      },
      required: ['sourceElement', 'sourceRef', 'targetElement', 'targetRef']
    }
  },

  browser_hover: {
    name: 'browser_hover',
    description: 'Hover over element on page',
    inputSchema: {
      type: 'object',
      properties: {
        element: {
          type: 'string',
          description: 'Human-readable element description used to obtain permission to interact with the element'
        },
        ref: {
          type: 'string',
          description: 'Exact target element reference from the page snapshot'
        },
        tabId: {
          type: 'number',
          description: 'Tab ID (optional, uses active tab if not provided)'
        }
      },
      required: ['element', 'ref']
    }
  },

  browser_type: {
    name: 'browser_type',
    description: 'Type text into editable element',
    inputSchema: {
      type: 'object',
      properties: {
        element: {
          type: 'string',
          description: 'Human-readable element description used to obtain permission to interact with the element'
        },
        ref: {
          type: 'string',
          description: 'Exact target element reference from the page snapshot'
        },
        text: {
          type: 'string',
          description: 'Text to type into the element'
        },
        submit: {
          type: 'boolean',
          description: 'Whether to submit entered text (press Enter after)',
          default: false
        },
        tabId: {
          type: 'number',
          description: 'Tab ID (optional, uses active tab if not provided)'
        }
      },
      required: ['element', 'ref', 'text']
    }
  },

  browser_get_console_logs: {
    name: 'browser_get_console_logs',
    description: 'Get the console logs from the browser',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'Tab ID (optional, uses active tab if not provided)'
        }
      }
    }
  },

  browser_screenshot: {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'Tab ID (optional, uses active tab if not provided)'
        },
        fullPage: {
          type: 'boolean',
          description: 'Whether to capture the full page',
          default: false
        },
        element: {
          type: 'string',
          description: 'Human-readable element description (optional)'
        },
        ref: {
          type: 'string',
          description: 'Element reference to screenshot (optional)'
        }
      }
    }
  }
};

/**
 * Get list of all tools in MCP format
 */
export function getToolsList() {
  return Object.values(MCP_TOOLS).map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
  }));
}

/**
 * Validate tool arguments against schema
 */
export function validateToolArgs(toolName, args) {
  const tool = MCP_TOOLS[toolName];
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const schema = tool.inputSchema;
  const required = schema.required || [];

  // Check required fields
  for (const field of required) {
    if (!(field in args)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Basic type and constraint validation
  const properties = schema.properties || {};
  for (const [key, value] of Object.entries(args)) {
    const propSchema = properties[key];
    if (propSchema) {
      validateProperty(key, value, propSchema);
    }
  }

  return true;
}

/**
 * Validate individual property against schema
 */
function validateProperty(key, value, schema) {
  const { type, minimum, maximum } = schema;

  // Type validation
  if (type) {
    const actualType = typeof value;
    
    if (type === 'number' && actualType !== 'number') {
      throw new Error(`Property ${key} must be a number, got ${actualType}`);
    }
    if (type === 'string' && actualType !== 'string') {
      throw new Error(`Property ${key} must be a string, got ${actualType}`);
    }
    if (type === 'boolean' && actualType !== 'boolean') {
      throw new Error(`Property ${key} must be a boolean, got ${actualType}`);
    }
    if (type === 'array' && !Array.isArray(value)) {
      throw new Error(`Property ${key} must be an array, got ${actualType}`);
    }
    if (type === 'object' && (actualType !== 'object' || Array.isArray(value))) {
      throw new Error(`Property ${key} must be an object, got ${actualType}`);
    }
  }

  // Number constraints
  if (type === 'number') {
    if (minimum !== undefined && value < minimum) {
      throw new Error(`Property ${key} must be >= ${minimum}, got ${value}`);
    }
    if (maximum !== undefined && value > maximum) {
      throw new Error(`Property ${key} must be <= ${maximum}, got ${value}`);
    }
  }

  // String constraints
  if (type === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw new Error(`Property ${key} must be at least ${schema.minLength} characters long`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      throw new Error(`Property ${key} must be at most ${schema.maxLength} characters long`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      throw new Error(`Property ${key} does not match required pattern`);
    }
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    throw new Error(`Property ${key} must be one of: ${schema.enum.join(', ')}`);
  }
}

/**
 * Get tool metadata
 */
export function getToolMetadata(toolName) {
  const tool = MCP_TOOLS[toolName];
  if (!tool) {
    return null;
  }

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    category: getToolCategory(toolName),
    examples: getToolExamples(toolName)
  };
}

/**
 * Categorize tools for better organization
 */
function getToolCategory(toolName) {
  const categories = {
    navigation: ['browser_navigate', 'browser_go_back', 'browser_go_forward'],
    interaction: ['browser_click', 'browser_hover', 'browser_type', 'browser_drag_drop'],
    utility: ['browser_wait', 'browser_press_key'],
    inspection: ['browser_snapshot', 'browser_screenshot', 'browser_get_console_logs']
  };

  for (const [category, tools] of Object.entries(categories)) {
    if (tools.includes(toolName)) {
      return category;
    }
  }

  return 'other';
}

/**
 * Get example usage for tools
 */
function getToolExamples(toolName) {
  const examples = {
    browser_navigate: [
      { url: 'https://example.com' },
      { url: 'https://github.com', tabId: 123 }
    ],
    browser_click: [
      { element: 'Submit button', ref: 'button#submit-btn-1' }
    ],
    browser_type: [
      { element: 'Email input', ref: 'input#email-2', text: 'user@example.com' },
      { element: 'Search box', ref: 'input#search-3', text: 'hello world', submit: true }
    ],
    browser_wait: [
      { time: 2.5 },
      { time: 1 }
    ]
  };

  return examples[toolName] || [];
}