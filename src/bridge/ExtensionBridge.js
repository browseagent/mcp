/**
 * Extension Bridge
 * 
 * Handles communication between the native host and Chrome extension.
 * Manages tool execution requests and responses.
 */

import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';
import { Logger } from '../utils/Logger.js';

export class ExtensionBridge extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.registeredExtensions = new Set(); // Track connected extensions
    this.extensionManifests = new Map();   // Store extension manifests
    this.activeExtensionId = null;         // Currently active extension

    this.port = options.port || 8765;
    this.debug = options.debug || false;
    this.useWebSocket = options.useWebSocket || false;
    this.logger = new Logger('ExtensionBridge');
    
    this.server = null;
    this.extensionSocket = null;
    this.isInitialized = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
    
    // Connection timeout
    this.connectionTimeout = 30000; // 30 seconds
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
    
    // Bind methods
    this.handleConnection = this.handleConnection.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleDisconnection = this.handleDisconnection.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }
    
    this.logger.info('Initializing extension bridge...');
    
    if (this.useWebSocket) {
      await this.startWebSocketServer();
    } else {
      // For native messaging, we don't need a server
      // The extension will connect directly via Chrome APIs
      this.logger.info('Extension bridge initialized (native messaging mode)');
    }
    
    this.isInitialized = true;
    this.startHeartbeat();
    
    this.logger.info('Extension bridge initialized successfully');
  }

  async startWebSocketServer() {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({
          port: this.port,
          host: '127.0.0.1'
        });
        
        this.server.on('connection', this.handleConnection);
        this.server.on('error', this.handleError);
        
        this.server.on('listening', () => {
          this.logger.info(`Extension bridge WebSocket server listening on port ${this.port}`);
          resolve();
        });
        
      } catch (error) {
        this.logger.error('Failed to start WebSocket server:', error);
        reject(error);
      }
    });
  }

  async disconnect() {
    this.logger.info('Disconnecting extension bridge...');
    
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    // Close extension connection
    if (this.extensionSocket) {
      this.extensionSocket.close();
      this.extensionSocket = null;
    }
    
    // Close server
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(() => {
          this.logger.info('Extension bridge WebSocket server closed');
          resolve();
        });
      });
      this.server = null;
    }
    
    // Reject pending requests
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error('Extension bridge disconnected'));
    }
    this.pendingRequests.clear();
    
    this.isInitialized = false;
    this.logger.info('Extension bridge disconnected');
  }

  handleConnection(ws) {
    this.logger.info('Extension connected via WebSocket');
    
    // Close existing connection if any
    if (this.extensionSocket) {
      this.extensionSocket.close();
    }
    
    this.extensionSocket = ws;
    this.lastHeartbeat = Date.now();
    
    // Set up event handlers
    ws.on('message', this.handleMessage);
    ws.on('close', this.handleDisconnection);
    ws.on('error', this.handleError);
    
    // Send welcome message
    this.sendMessage({
      type: 'welcome',
      message: 'Connected to Browse Agent MCP Server',
      timestamp: new Date().toISOString(),
      capabilities: {
        tools: true,
        heartbeat: true,
        version: '1.0.0'
      }
    });
    
    this.emit('extension-connected');
  }


  async handleExtensionHandshake(message) {
    const { extensionId, version, timestamp, capabilities } = message;
    
    this.logger.info(`Handshake received from extension: ${extensionId}`);
    
    try {
      // Register this extension
      this.registeredExtensions.add(extensionId);
      this.activeExtensionId = extensionId;
      
      // Store extension info
      this.extensionManifests.set(extensionId, {
        id: extensionId,
        version,
        capabilities,
        connectedAt: timestamp,
        lastSeen: Date.now()
      });
      
      // Create/update native messaging manifest for this extension
      await this.createNativeManifestForExtension(extensionId);
      
      // Send handshake response
      this.sendMessage({
        type: 'handshake-response',
        success: true,
        message: 'Connected to BrowseAgent MCP Server',
        timestamp: Date.now(),
        serverInfo: {
          name: 'browseagent-mcp',
          version: '1.0.0',
          capabilities: {
            browserAutomation: true,
            mcpProtocol: true
          }
        }
      });
      
      this.logger.info(`✅ Extension ${extensionId} connected successfully`);
      this.emit('extension-registered', { extensionId, version });
      
    } catch (error) {
      this.logger.error('Failed to handle extension handshake:', error);
      
      this.sendMessage({
        type: 'connection-error',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }


  async createNativeManifestForExtension(extensionId) {
    try {
      const manifestDir = this.getNativeManifestDirectory();
      await mkdir(manifestDir, { recursive: true });
      
      const manifest = {
        name: 'com.browseagent.mcp',
        description: 'BrowseAgent MCP Native Host',
        path: process.argv[1], // Current script path
        type: 'stdio',
        allowed_origins: [
          `chrome-extension://${extensionId}/`
        ]
      };
      
      const manifestPath = join(manifestDir, 'com.browseagent.mcp.json');
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      
      this.logger.info(`Native manifest created for extension: ${extensionId}`);
      this.logger.debug(`Manifest path: ${manifestPath}`);
      
    } catch (error) {
      this.logger.error('Failed to create native manifest:', error);
      throw error;
    }
  }

  getNativeManifestDirectory() {
    const home = homedir();
    
    switch (process.platform) {
      case 'win32':
        return join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts');
      case 'darwin':
        return join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
      case 'linux':
        return join(home, '.config', 'google-chrome', 'NativeMessagingHosts');
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
  }


  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString('utf8'));
      this.logger.debug('Received message from extension:', message);
      
      this.lastHeartbeat = Date.now();
      
      switch (message.type) {
        case 'handshake':
          this.handleExtensionHandshake(message);
          break;
          
        case 'disconnect':
          this.handleExtensionDisconnect(message);
          break;

        case 'tool-response':
          this.handleToolResponse(message);
          break;
          
        case 'heartbeat':
          this.handleHeartbeat(message);
          break;
          
        case 'error':
          this.handleExtensionError(message);
          break;
          
        case 'status':
          this.handleStatusUpdate(message);
          break;
          
        default:
          this.logger.warn('Unknown message type from extension:', message.type);
      }
      
    } catch (error) {
      this.logger.error('Failed to parse extension message:', error);
    }
  }

  handleExtensionDisconnect(message) {
    const { extensionId } = message;
    
    if (extensionId && this.registeredExtensions.has(extensionId)) {
      this.registeredExtensions.delete(extensionId);
      this.extensionManifests.delete(extensionId);
      
      if (this.activeExtensionId === extensionId) {
        this.activeExtensionId = null;
      }
      
      this.logger.info(`Extension ${extensionId} disconnected`);
      this.emit('extension-disconnected', { extensionId });
    }
  }

  getConnectionStatus() {
    return {
      initialized: this.isInitialized,
      extensionsConnected: this.registeredExtensions.size,
      activeExtension: this.activeExtensionId,
      registeredExtensions: Array.from(this.registeredExtensions),
      lastHeartbeat: this.lastHeartbeat,
      uptime: Date.now() - this.startTime
    };
  }

   async waitForExtensionConnection(timeout = 30000) {
    if (this.registeredExtensions.size > 0) {
      return Array.from(this.registeredExtensions)[0];
    }
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Extension connection timeout'));
      }, timeout);
      
      this.once('extension-registered', ({ extensionId }) => {
        clearTimeout(timeoutId);
        resolve(extensionId);
      });
    });
  }

  handleDisconnection(code, reason) {
    this.logger.warn(`Extension disconnected: ${code} ${reason}`);
    this.extensionSocket = null;
    this.emit('extension-disconnected');
    
    // Reject pending requests
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error('Extension disconnected'));
    }
    this.pendingRequests.clear();
  }

  handleError(error) {
    this.logger.error('Extension bridge error:', error);
    this.emit('error', error);
  }

  handleToolResponse(message) {
    const { requestId, success, result, error } = message;
    
    if (this.pendingRequests.has(requestId)) {
      const { resolve, reject } = this.pendingRequests.get(requestId);
      this.pendingRequests.delete(requestId);
      
      if (success) {
        resolve(result);
      } else {
        reject(new Error(error || 'Tool execution failed'));
      }
    } else {
      this.logger.warn('Received response for unknown request ID:', requestId);
    }
  }

  handleHeartbeat(message) {
    this.logger.debug('Received heartbeat from extension');
    
    // Send heartbeat response
    this.sendMessage({
      type: 'heartbeat-response',
      timestamp: Date.now()
    });
  }

  handleExtensionError(message) {
    this.logger.error('Extension error:', message.error);
  }

  handleStatusUpdate(message) {
    this.logger.debug('Extension status update:', message.status);
    this.emit('status-update', message.status);
  }

  async executeTool(toolName, args) {
    if (!this.extensionSocket) {
      throw new Error('Extension not connected');
    }
    
    const requestId = ++this.requestId;
    
    this.logger.info(`Executing tool: ${toolName} (request ${requestId})`);
    this.logger.debug('Tool arguments:', args);
    
    return new Promise((resolve, reject) => {
      // Store pending request
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Tool execution timeout: ${toolName}`));
      }, 60000); // 60 second timeout
      
      this.pendingRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        toolName,
        timestamp: Date.now()
      });
      
      // Send tool execution request
      this.sendMessage({
        type: 'tool-request',
        requestId,
        toolName,
        args
      });
    });
  }

  sendMessage(message) {
    if (!this.extensionSocket) {
      this.logger.warn('Cannot send message: extension not connected');
      return false;
    }
    
    try {
      const messageStr = JSON.stringify(message);
      this.extensionSocket.send(messageStr);
      this.logger.debug('Sent message to extension:', message);
      return true;
    } catch (error) {
      this.logger.error('Failed to send message to extension:', error);
      return false;
    }
  }

  startHeartbeat() {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.extensionSocket) {
        this.sendMessage({
          type: 'heartbeat',
          timestamp: Date.now()
        });
        
        // Check if extension is responsive
        const now = Date.now();
        if (this.lastHeartbeat && (now - this.lastHeartbeat) > 90000) {
          this.logger.warn('Extension appears unresponsive (no heartbeat for 90s)');
          this.emit('extension-unresponsive');
        }
      }
    }, 30000);
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      extensionConnected: !!this.extensionSocket,
      pendingRequests: this.pendingRequests.size,
      lastHeartbeat: this.lastHeartbeat,
      useWebSocket: this.useWebSocket,
      port: this.port
    };
  }

  // Method for native messaging mode (used by Chrome extension)
  handleNativeMessage(message) {
    this.handleMessage(Buffer.from(JSON.stringify(message)));
  }

  // Method to send response back in native messaging mode
  sendNativeResponse(response) {
    // This would be handled by the calling MCP server
    return response;
  }
  
  
}