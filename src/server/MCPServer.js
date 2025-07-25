/**
 * MCP (Model Context Protocol) Server Implementation
 * 
 * Handles communication with MCP client and implements the MCP specification.
 * Acts as a bridge between MCP client and the browser extension.
 */

import { StdioTransport } from './transports/StdioTransport.js';
import { WebSocketTransport } from './transports/WebSocketTransport.js';
import { MCP_TOOLS } from '../tools/ToolRegistry.js';
import { Logger } from '../utils/Logger.js';

const MCP_PROTOCOL_VERSION = "2024-11-05";

export class MCPServer {
  constructor(options = {}) {
    this.bridge = options.bridge;
    this.config = options.config;
    this.logger = new Logger('MCPServer');
    this.useStdio = options.useStdio !== false;
    
    this.transport = null;
    this.isInitialized = false;
    this.clientInfo = null;
    this.capabilities = {
      tools: {},
      resources: {},
      prompts: {}
    };
    
    this.requestId = 0;
    this.pendingRequests = new Map();
    
    // Bind methods
    this.handleMessage = this.handleMessage.bind(this);
    this.handleTransportError = this.handleTransportError.bind(this);
  }

  async start() {
    try {
      this.logger.info('Starting MCP server...');
      
      // Create appropriate transport
      if (this.useStdio) {
        this.transport = new StdioTransport({
          logger: this.logger
        });
      } else {
        this.transport = new WebSocketTransport({
          port: this.config.get('mcp_port', 8766),
          logger: this.logger
        });
      }
      
      // Set up transport event handlers
      this.transport.on('message', this.handleMessage);
      this.transport.on('error', this.handleTransportError);
      this.transport.on('close', () => {
        this.logger.info('Transport connection closed');
      });
      
      // Start transport
      await this.transport.start();
      
      this.logger.info('MCP server started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start MCP server:', error);
      throw error;
    }
  }

  async shutdown() {
    try {
      this.logger.info('Shutting down MCP server...');
      
      if (this.transport) {
        await this.transport.stop();
      }
      
      // Clear pending requests
      this.pendingRequests.clear();
      
      this.logger.info('MCP server shut down successfully');
      
    } catch (error) {
      this.logger.error('Error during MCP server shutdown:', error);
      throw error;
    }
  }

  async handleMessage(message) {
    try {
      this.logger.debug('Received message:', message);
      
      // Validate message format
      if (!this.isValidMCPMessage(message)) {
        this.logger.warn('Invalid MCP message format:', message);
        return;
      }
      
      const { method, params, id } = message;
      
      // Handle different MCP methods
      let result;
      
      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params);
          break;
          
        case 'tools/list':
          result = await this.handleToolsList();
          break;
          
        case 'tools/call':
          result = await this.handleToolCall(params);
          break;
          
        case 'resources/list':
          result = await this.handleResourcesList();
          break;
          
        case 'resources/read':
          result = await this.handleResourceRead(params);
          break;
          
        case 'prompts/list':
          result = await this.handlePromptsList();
          break;
          
        case 'prompts/get':
          result = await this.handlePromptGet(params);
          break;
          
        case 'ping':
          result = { pong: true, timestamp: Date.now() };
          break;
          
        default:
          throw new Error(`Unknown method: ${method}`);
      }
      
      // Send response
      if (id !== undefined) {
        await this.sendResponse(id, result);
      }
      
    } catch (error) {
      this.logger.error('Error handling message:', error);
      
      if (message.id !== undefined) {
        await this.sendError(message.id, {
          code: -32603,
          message: error.message,
          data: error.stack
        });
      }
    }
  }

  async handleInitialize(params) {
    this.logger.info('Handling initialize request');
    
    this.clientInfo = params.clientInfo;
    this.isInitialized = true;
    
    this.logger.info(`Initialized with client: ${this.clientInfo?.name || 'Unknown'} v${this.clientInfo?.version || 'Unknown'}`);
    
    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: this.capabilities,
      serverInfo: {
        name: "browseagent-mcp",
        version: "1.0.0",
        description: "Browser automation MCP server for MCP clients"
      }
    };
  }

  async handleToolsList() {
    this.logger.debug('Handling tools/list request');
    
    const tools = Object.values(MCP_TOOLS).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    return { tools };
  }

  async handleToolCall(params) {
    const { name, arguments: args } = params;
    
    this.logger.info(`Executing tool: ${name}`);
    this.logger.debug('Tool arguments:', args);
    
    // Validate tool exists
    if (!MCP_TOOLS[name]) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    // Validate arguments
    const tool = MCP_TOOLS[name];
    this.validateToolArguments(tool, args);
    
    try {
      // Execute tool via extension bridge
      const startTime = Date.now();
      const result = await this.bridge.executeTool(name, args);
      const duration = Date.now() - startTime;
      
      this.logger.info(`Tool ${name} executed successfully in ${duration}ms`);
      this.logger.debug('Tool result:', result);
      
      // Format result according to MCP specification
      return this.formatToolResult(result);
      
    } catch (error) {
      this.logger.error(`Tool ${name} execution failed:`, error);
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  async handleResourcesList() {
    this.logger.debug('Handling resources/list request');
    
    // For now, return empty resources list
    // This could be extended to include browser state, screenshots, etc.
    return { resources: [] };
  }

  async handleResourceRead(params) {
    this.logger.debug('Handling resources/read request:', params);
    
    // Placeholder for resource reading
    throw new Error('Resource reading not implemented yet');
  }

  async handlePromptsList() {
    this.logger.debug('Handling prompts/list request');
    
    // Return predefined prompts for browser automation
    return {
      prompts: [
        {
          name: "analyze_page",
          description: "Analyze the structure and content of a web page",
          arguments: [
            {
              name: "url",
              description: "URL of the page to analyze",
              required: true
            }
          ]
        },
        {
          name: "fill_form",
          description: "Fill out a form on a web page",
          arguments: [
            {
              name: "form_data",
              description: "Form fields and values to fill",
              required: true
            }
          ]
        }
      ]
    };
  }

  async handlePromptGet(params) {
    this.logger.debug('Handling prompts/get request:', params);
    
    const { name, arguments: args } = params;
    
    switch (name) {
      case "analyze_page":
        return {
          description: "Analyze web page structure and content",
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Please analyze the web page at ${args.url}. Take a screenshot and accessibility snapshot, then provide insights about the page structure, interactive elements, and potential automation opportunities.`
              }
            }
          ]
        };
        
      case "fill_form":
        return {
          description: "Fill out form fields on a web page",
          messages: [
            {
              role: "user", 
              content: {
                type: "text",
                text: `Please fill out the form with the following data: ${JSON.stringify(args.form_data)}. First take a snapshot to identify form fields, then fill them out systematically.`
              }
            }
          ]
        };
        
      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  }

  handleTransportError(error) {
    this.logger.error('Transport error:', error);
  }

  isValidMCPMessage(message) {
    return (
      message &&
      typeof message === 'object' &&
      message.jsonrpc === '2.0' &&
      (message.method || message.result !== undefined || message.error)
    );
  }

  validateToolArguments(tool, args) {
    const schema = tool.inputSchema;
    const required = schema.required || [];
    
    // Check required fields
    for (const field of required) {
      if (!(field in args)) {
        throw new Error(`Missing required argument: ${field}`);
      }
    }
    
    // Basic type checking
    const properties = schema.properties || {};
    for (const [key, value] of Object.entries(args)) {
      const propSchema = properties[key];
      if (propSchema && propSchema.type) {
        const actualType = typeof value;
        const expectedType = propSchema.type;
        
        if (expectedType === 'number' && actualType !== 'number') {
          throw new Error(`Argument ${key} must be a number`);
        }
        if (expectedType === 'string' && actualType !== 'string') {
          throw new Error(`Argument ${key} must be a string`);
        }
        if (expectedType === 'boolean' && actualType !== 'boolean') {
          throw new Error(`Argument ${key} must be a boolean`);
        }
      }
    }
  }

  formatToolResult(result) {
    // Format result according to MCP content specification
    if (result && result.content) {
      return result;
    }
    
    // Convert simple results to MCP format
    return {
      content: [
        {
          type: "text",
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async sendResponse(id, result) {
    const response = {
      jsonrpc: '2.0',
      id,
      result
    };
    
    await this.transport.send(response);
  }

  async sendError(id, error) {
    const response = {
      jsonrpc: '2.0',
      id,
      error
    };
    
    await this.transport.send(response);
  }

  async sendNotification(method, params) {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };
    
    await this.transport.send(notification);
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      client: this.clientInfo?.name || null,
      transport: this.transport?.getStatus() || 'not-started',
      pendingRequests: this.pendingRequests.size
    };
  }
}

/**
 * Factory function to create MCP server instance
 */
export function createServer(options) {
  return new MCPServer(options);
}