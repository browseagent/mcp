/**
 * MCP (Model Context Protocol) Server Implementation
 * 
 * Handles communication with MCP client and implements the MCP specification.
 * Acts as a bridge between MCP client and the browser extension.
 */

import { EventEmitter } from 'events';
import { StdioTransport } from './transports/StdioTransport.js';
import { WebSocketTransport } from './transports/WebSocketTransport.js';
import { MCP_TOOLS } from '../tools/ToolRegistry.js';
import { Logger } from '../utils/Logger.js';

const MCP_PROTOCOL_VERSION = "2024-11-05";

export class MCPServer extends EventEmitter {
  constructor(options = {}) {
    super(); // Initialize EventEmitter
    
    this.bridge = options.bridge;
    this.config = options.config;
    this.logger = new Logger('MCPServer');
    this.useStdio = options.useStdio !== false;
    this.flexibleMode = options.flexibleMode || false;
    
    this.transport = null;
    this.isInitialized = false;
    this.clientInfo = null;
    this.extensionAvailable = false;
    this.capabilities = {
      tools: {},
      resources: {},
      prompts: {}
    };
    
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.startTime = Date.now();
    
    // Bind methods
    this.handleMessage = this.handleMessage.bind(this);
    this.handleTransportError = this.handleTransportError.bind(this);
    this.handleTransportClose = this.handleTransportClose.bind(this);
  }

  async start() {
    try {
      this.logger.info('Starting MCP server...');
      
      // Create appropriate transport
      if (this.useStdio) {
        this.transport = new StdioTransport({
          logger: this.logger.createChild('STDIO')
        });
      } else {
        this.transport = new WebSocketTransport({
          port: this.config.get('mcp_port', 8766),
          logger: this.logger.createChild('WebSocket')
        });
      }
      
      // Set up transport event handlers
      this.transport.on('message', this.handleMessage);
      this.transport.on('error', this.handleTransportError);
      this.transport.on('close', this.handleTransportClose);
      
      // Start transport
      await this.transport.start();
      
      this.logger.info(`MCP server started successfully (${this.useStdio ? 'STDIO' : 'WebSocket'} mode)`);
      this.emit('server-started', { 
        transport: this.useStdio ? 'stdio' : 'websocket',
        flexibleMode: this.flexibleMode
      });
      
    } catch (error) {
      this.logger.error('Failed to start MCP server:', error);
      this.emit('server-error', error);
      throw error;
    }
  }

  async shutdown() {
    try {
      this.logger.info('Shutting down MCP server...');
      
      // Emit client disconnection if we had a client
      if (this.clientInfo) {
        this.emit('client-disconnected', this.clientInfo);
        this.clientInfo = null;
      }
      
      if (this.transport) {
        await this.transport.stop();
      }
      
      // Clear pending requests
      this.pendingRequests.clear();
      
      this.isInitialized = false;
      this.logger.info('MCP server shut down successfully');
      this.emit('server-stopped');
      
    } catch (error) {
      this.logger.error('Error during MCP server shutdown:', error);
      this.emit('server-error', error);
      throw error;
    }
  }

  setExtensionAvailable(available, extensionInfo = null) {
    const wasAvailable = this.extensionAvailable;
    this.extensionAvailable = available;
    
    if (available !== wasAvailable) {
      this.logger.info(`Extension availability changed: ${available}`);
      this.emit('extension-availability-changed', { 
        available, 
        extensionInfo,
        timestamp: Date.now()
      });
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
      const startTime = Date.now();
      
      try {
        switch (method) {
          case 'initialize':
            result = await this.handleInitialize(params);
            break;
            
          case 'notifications/initialized':
            await this.handleInitializedNotification(params);
            // Notifications don't return results
            return;
            
          case 'notifications/cancelled':
            await this.handleCancelledNotification(params);
            return;
            
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
        
        const duration = Date.now() - startTime;
        this.emit('method-executed', {
          method,
          success: true,
          duration,
          clientInfo: this.clientInfo
        });
        
      } catch (methodError) {
        const duration = Date.now() - startTime;
        this.emit('method-executed', {
          method,
          success: false,
          duration,
          error: methodError.message,
          clientInfo: this.clientInfo
        });
        throw methodError;
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
      
      this.emit('message-error', {
        error: error.message,
        message,
        clientInfo: this.clientInfo
      });
    }
  }

  async handleInitializedNotification(params) {
    this.logger.info('Client initialization complete');
    
    // Emit event for notification handlers
    this.emit('client-initialized', {
      clientInfo: this.clientInfo,
      timestamp: Date.now()
    });
  }

  async handleCancelledNotification(params) {
    this.logger.debug('Request cancelled by client:', params);
    
    // Handle request cancellation if needed
    const { requestId, reason } = params;
    
    // Remove from pending requests if we're tracking them
    if (this.pendingRequests.has(requestId)) {
      this.pendingRequests.delete(requestId);
      this.logger.debug(`Cancelled pending request: ${requestId}`);
    }
    
    this.emit('request-cancelled', {
      requestId,
      reason,
      clientInfo: this.clientInfo,
      timestamp: Date.now()
    });
  }

  async handleInitialize(params) {
    this.logger.info('Handling initialize request');
    
    const previousClientInfo = this.clientInfo;
    this.clientInfo = params.clientInfo;
    this.isInitialized = true;
    
    // Emit client connected event
    this.emit('client-connected', {
      clientInfo: this.clientInfo,
      protocolVersion: params.protocolVersion,
      capabilities: params.capabilities,
      previousClient: previousClientInfo,
      timestamp: Date.now()
    });
    
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
    
    this.emit('tools-listed', {
      toolCount: tools.length,
      clientInfo: this.clientInfo,
      timestamp: Date.now()
    });
    
    return { tools };
  }

  async handleToolCall(params) {
    const { name, arguments: args } = params;
    
    this.logger.info(`Executing tool: ${name}`);
    this.logger.debug('Tool arguments:', args);
    
    // Validate tool exists
    if (!MCP_TOOLS[name]) {
      const error = new Error(`Unknown tool: ${name}`);
      this.emit('tool-executed', {
        name,
        success: false,
        error: error.message,
        duration: 0,
        clientInfo: this.clientInfo,
        timestamp: Date.now()
      });
      throw error;
    }
    
    // Validate arguments
    const tool = MCP_TOOLS[name];
    this.validateToolArguments(tool, args);
    
    try {
      const startTime = Date.now();
      
      // Check if tool requires extension and if extension is available
      const requiresExtension = this.toolRequiresExtension(name);
      if (requiresExtension && !this.extensionAvailable && !this.flexibleMode) {
        throw new Error(`Tool ${name} requires Chrome extension, but extension is not connected`);
      }
      
      let result;

      console.log({
        message: `YESSSSS: Preparing to execute tool ${name}`,
        requiresExtension,
        flexibleMode: this.flexibleMode,
        extensionAvailable: this.extensionAvailable,
        args,
        clientInfo: this.clientInfo,
        bridge: this.bridge
      });
      
      if (requiresExtension && this.extensionAvailable) {
        // Execute tool via extension bridge
        result = await this.bridge.executeTool(name, args);
      } else if (!requiresExtension) {
        // Execute limited mode tool locally
        result = await this.executeLocalTool(name, args);
      } else if (this.flexibleMode) {
        // In flexible mode, provide helpful error message

        console.log({
          message: `NOOOOOO: Preparing to execute tool`,
          requiresExtension,
          extensionAvailable: this.extensionAvailable,
          flexibleMode: this.flexibleMode,
          args,
          clientInfo: this.clientInfo,
          bridge: this.bridge
        });


        result = {
          content: [{
            type: "text",
            text: `Tool "${name}" requires Chrome extension connection. Please install and connect the BrowseAgent Chrome extension to use browser automation features.`
          }]
        };
      } else {
        throw new Error(`Tool ${name} is not available in current mode`);
      }
      
      const duration = Date.now() - startTime;
      
      this.logger.info(`Tool ${name} executed successfully in ${duration}ms`);
      this.logger.debug('Tool result:', result);
      
      // Emit tool execution event
      this.emit('tool-executed', {
        name,
        success: true,
        duration,
        requiresExtension,
        extensionAvailable: this.extensionAvailable,
        clientInfo: this.clientInfo,
        timestamp: Date.now()
      });
      
      // Format result according to MCP specification
      return this.formatToolResult(result);
      
    } catch (error) {
      const duration = Date.now() - Date.now(); // This will be 0 for immediate errors
      
      this.logger.error(`Tool ${name} execution failed:`, error);
      
      this.emit('tool-executed', {
        name,
        success: false,
        duration,
        error: error.message,
        requiresExtension: this.toolRequiresExtension(name),
        extensionAvailable: this.extensionAvailable,
        clientInfo: this.clientInfo,
        timestamp: Date.now()
      });
      
      throw new Error(`Tool execution failed: ${error.message}`);
    }
  }

  toolRequiresExtension(toolName) {
    const localTools = ['browser_wait', 'ping', 'system_info'];
    return !localTools.includes(toolName);
  }

  async executeLocalTool(toolName, args) {
    switch (toolName) {
      case 'browser_wait':
        const waitTime = args.time * 1000; // Convert to milliseconds
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return {
          content: [{
            type: "text",
            text: `Waited for ${args.time} seconds`
          }]
        };
        
      case 'ping':
        return {
          content: [{
            type: "text",
            text: `Pong! Server uptime: ${Math.round((Date.now() - this.startTime) / 1000)}s`
          }]
        };
        
      case 'system_info':
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              platform: process.platform,
              nodeVersion: process.version,
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              extensionConnected: this.extensionAvailable
            }, null, 2)
          }]
        };
        
      default:
        throw new Error(`Local tool not implemented: ${toolName}`);
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
    this.emit('transport-error', error);
  }

  handleTransportClose() {
    this.logger.info('Transport connection closed');
    
    if (this.clientInfo) {
      this.emit('client-disconnected', {
        clientInfo: this.clientInfo,
        timestamp: Date.now()
      });
      this.clientInfo = null;
    }
    
    this.isInitialized = false;
    this.emit('transport-closed');
  }

  isValidMCPMessage(message) {
    return (
      message &&
      typeof message === 'object' &&
      message.jsonrpc === '2.0' &&
      (message.method || message.result !== undefined || message.error !== undefined)
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
      clientConnected: !!this.clientInfo,
      transport: this.transport?.getStatus() || 'not-started',
      pendingRequests: this.pendingRequests.size,
      extensionAvailable: this.extensionAvailable,
      flexibleMode: this.flexibleMode,
      uptime: Date.now() - this.startTime
    };
  }
}

/**
 * Factory function to create MCP server instance
 */
export function createServer(options) {
  return new MCPServer(options);
}