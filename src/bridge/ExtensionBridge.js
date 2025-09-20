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
    this.connectionTimeout =  options.connectionTimeout || 90000; // 90 seconds
    this.heartbeatIntervalTime = options.heartbeatInterval || 30000; // 30 seconds
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
    this.maxRetries = options.maxRetries || 5;

    this.toolTimeout = options.toolTimeout || 60000; // 60 seconds

    this.pendingConnections = new Map();   // Track unvalidated connections
    this.handshakeTimeout = 3000;    // 3 seconds for handshake validation
    
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
      try {
        await this.startWebSocketServer();
      } catch (error) {
        this.logger.error('Failed to initialize WebSocket server:', error);
        
        // If we can't start the WebSocket server, we can still continue in limited mode
        if (error.code === 'EADDRINUSE') {
          this.logger.warn('Continuing without WebSocket server - extension features will be limited');
          this.logger.warn('To fix this: kill existing processes using the port or restart your system');
        } else {
          throw error; // Re-throw non-port-conflict errors
        }
      }
    } else {
      // For native messaging, we don't need a server
      this.logger.info('Extension bridge initialized (native messaging mode)');
    }
    
    this.isInitialized = true;
    this.startHeartbeat();
    
    this.logger.info('Extension bridge initialized successfully');
  }

  async startWebSocketServer() {
    let currentPort = this.port;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        await this.tryStartServer(currentPort);
        this.port = currentPort; // Update the port if it changed
        return;
      } catch (error) {
        if (error.code === 'EADDRINUSE') {
          this.logger.warn(`Port ${currentPort} is in use, trying port ${currentPort + 1}...`);
          currentPort++;
        } else {
          throw error;
        }
      }
    }
    
    throw new Error(`Failed to start WebSocket server after ${this.maxRetries} attempts. All ports from ${this.port} to ${currentPort - 1} are in use.`);
  }

  async tryStartServer(port) {
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocketServer({
          port: port,
          host: '127.0.0.1'
        });
        
        this.server.on('connection', this.handleConnection);
        this.server.on('error', (error) => {
          reject(error);
        });
        
        this.server.on('listening', () => {
          this.logger.info(`Extension bridge WebSocket server listening on port ${port}`);
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
    
    // Clean up pending connections
    for (const [connectionId, pendingConnection] of this.pendingConnections) {
      if (pendingConnection.handshakeTimer) {
        clearTimeout(pendingConnection.handshakeTimer);
      }
      pendingConnection.ws.close();
    }
    this.pendingConnections.clear();
    
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


  handleConnection(ws, request) {
    const connectionId = this.generateConnectionId();
    const clientInfo = this.extractClientInfo(request);
    
    this.logger.info(`New WebSocket connection from ${clientInfo.origin || 'unknown'} (${connectionId})`);
    this.logger.debug('Connection details:', clientInfo);
    
    // Store pending connection
    this.pendingConnections.set(connectionId, {
      ws,
      connectionId,
      clientInfo,
      connectedAt: Date.now(),
      validated: false
    });
    
    // Set up basic event handlers for pending connection
    ws.on('message', (data) => this.handlePendingMessage(connectionId, data));
    ws.on('close', () => this.handlePendingDisconnection(connectionId));
    ws.on('error', (error) => this.handlePendingError(connectionId, error));
    
    // Set handshake timeout
    const handshakeTimer = setTimeout(() => {
      this.logger.warn(`Handshake timeout for connection ${connectionId}`);
      this.rejectConnection(connectionId, 'Handshake timeout');
    }, this.handshakeTimeout);
    
    // Store timer for cleanup
    this.pendingConnections.get(connectionId).handshakeTimer = handshakeTimer;
    
    // Send initial challenge/welcome
    this.sendToPendingConnection(connectionId, {
      type: 'connection-challenge',
      message: 'BrowseAgent MCP Server - Send handshake to authenticate',
      timestamp: Date.now(),
      connectionId,
      requiredFields: ['type', 'extensionId', 'version', 'capabilities']
    });
  }


  generateConnectionId() {
    return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  extractClientInfo(request) {
    return {
      userAgent: request.headers['user-agent'],
      origin: request.headers.origin,
      host: request.headers.host,
      remoteAddress: request.connection?.remoteAddress,
      remotePort: request.connection?.remotePort
    };
  }

  handlePendingMessage(connectionId, data) {
    try {
      const message = JSON.parse(data.toString('utf8'));
      this.logger.debug(`Pending connection ${connectionId} message:`, message);
      
      if (message.type === 'handshake') {
        this.processHandshake(connectionId, message);
      } else {
        this.logger.warn(`Unexpected message type from pending connection ${connectionId}: ${message.type}`);
        this.rejectConnection(connectionId, 'Invalid message sequence - expected handshake');
      }
      
    } catch (error) {
      this.logger.error(`Failed to parse message from pending connection ${connectionId}:`, error);
      this.rejectConnection(connectionId, 'Invalid message format');
    }
  }


  async processHandshake(connectionId, handshakeMessage) {
    const pendingConnection = this.pendingConnections.get(connectionId);
    if (!pendingConnection) {
      this.logger.warn(`Handshake for unknown connection: ${connectionId}`);
      return;
    }

    this.logger.info(`Processing handshake for connection ${connectionId}`);
    this.logger.debug('Handshake data:', handshakeMessage);

    try {
      // Validate handshake structure
      const validationResult = this.validateHandshake(handshakeMessage);
      if (!validationResult.valid) {
        this.rejectConnection(connectionId, `Handshake validation failed: ${validationResult.reason}`);
        return;
      }

      // Check for duplicate connections
      if (this.registeredExtensions.has(handshakeMessage.extensionId)) {
        this.logger.warn(`Extension ${handshakeMessage.extensionId} already connected, closing previous connection`);
        this.disconnectExtension(handshakeMessage.extensionId);
      }

      // Accept the connection
      await this.acceptConnection(connectionId, handshakeMessage);

    } catch (error) {
      this.logger.error(`Error processing handshake for ${connectionId}:`, error);
      this.rejectConnection(connectionId, 'Internal handshake processing error');
    }
  }


  validateHandshake(message) {
    const required = ['type', 'extensionId', 'version', 'capabilities'];
    
    for (const field of required) {
      if (!message[field]) {
        return { valid: false, reason: `Missing required field: ${field}` };
      }
    }

    if (message.type !== 'handshake') {
      return { valid: false, reason: 'Invalid message type' };
    }

    if (typeof message.extensionId !== 'string' || message.extensionId.length === 0) {
      return { valid: false, reason: 'Invalid extensionId' };
    }

    if (typeof message.version !== 'string' || message.version.length === 0) {
      return { valid: false, reason: 'Invalid version' };
    }

    if (typeof message.capabilities !== 'object' || message.capabilities === null) {
      return { valid: false, reason: 'Invalid capabilities object' };
    }

    return { valid: true };
  }


  async acceptConnection(connectionId, handshakeMessage) {
    const pendingConnection = this.pendingConnections.get(connectionId);
    if (!pendingConnection) {
      return;
    }

    const { ws, handshakeTimer } = pendingConnection;
    const { extensionId, version, capabilities, timestamp, userAgent, platform } = handshakeMessage;

    // Clear handshake timeout
    if (handshakeTimer) {
      clearTimeout(handshakeTimer);
    }

    // Remove from pending connections
    this.pendingConnections.delete(connectionId);

    // Store validated connection
    this.extensionSocket = ws;
    this.lastHeartbeat = Date.now();
    this.activeExtensionId = extensionId;

    // Register extension
    this.registeredExtensions.add(extensionId);
    this.extensionManifests.set(extensionId, {
      id: extensionId,
      version,
      capabilities,
      userAgent,
      platform,
      connectedAt: timestamp || Date.now(),
      lastSeen: Date.now(),
      connectionId
    });

    // Set up validated connection handlers
    ws.removeAllListeners(); // Remove pending handlers
    ws.on('message', this.handleMessage);
    ws.on('close', this.handleDisconnection);
    ws.on('error', this.handleError);

    // Send success response
    this.sendMessage({
      type: 'handshake-response',
      success: true,
      message: 'Connected to Browseagent MCP Server',
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

    // Log successful connection
    this.logger.info(`✅ Extension ${extensionId} connected successfully`);
    this.logger.info(`   Version: ${version}`);
    this.logger.info(`   Platform: ${platform || 'unknown'}`);
    this.logger.info(`   Capabilities: ${Object.keys(capabilities).join(', ')}`);

    // Emit validated connection event
    this.emit('extension-connected', {
      extensionId,
      version,
      capabilities,
      userAgent,
      platform,
      timestamp: Date.now()
    });

    this.emit('extension-registered', { extensionId, version });
  }

  
  rejectConnection(connectionId, reason) {
    const pendingConnection = this.pendingConnections.get(connectionId);
    if (!pendingConnection) {
      return;
    }

    const { ws, handshakeTimer } = pendingConnection;

    this.logger.warn(`Rejecting connection ${connectionId}: ${reason}`);

    // Clear timeout
    if (handshakeTimer) {
      clearTimeout(handshakeTimer);
    }

    // Send rejection message
    try {
      ws.send(JSON.stringify({
        type: 'connection-rejected',
        reason,
        timestamp: Date.now()
      }));
    } catch (error) {
      // Ignore send errors for rejected connections
    }

    // Close connection
    ws.close(1008, reason); // Policy violation close code

    // Clean up
    this.pendingConnections.delete(connectionId);
  }


  handlePendingDisconnection(connectionId) {
    this.logger.debug(`Pending connection ${connectionId} disconnected`);
    const pendingConnection = this.pendingConnections.get(connectionId);
    
    if (pendingConnection?.handshakeTimer) {
      clearTimeout(pendingConnection.handshakeTimer);
    }
    
    this.pendingConnections.delete(connectionId);
  }

  handlePendingError(connectionId, error) {
    this.logger.error(`Pending connection ${connectionId} error:`, error);
    this.rejectConnection(connectionId, 'Connection error');
  }

  sendToPendingConnection(connectionId, message) {
    const pendingConnection = this.pendingConnections.get(connectionId);
    if (!pendingConnection) {
      return false;
    }

    try {
      const messageStr = JSON.stringify(message);
      pendingConnection.ws.send(messageStr);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to pending connection ${connectionId}:`, error);
      return false;
    }
  }

  disconnectExtension(extensionId) {
    if (this.activeExtensionId === extensionId && this.extensionSocket) {
      this.extensionSocket.close();
      this.extensionSocket = null;
    }
    
    this.registeredExtensions.delete(extensionId);
    this.extensionManifests.delete(extensionId);
    
    if (this.activeExtensionId === extensionId) {
      this.activeExtensionId = null;
    }
  }


  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString('utf8'));
      this.logger.debug('Received message from extension:', message);
      
      this.lastHeartbeat = Date.now();
      
      switch (message.type) {
          
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
      }, this.toolTimeout); // 60 second timeout
      
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
        if (this.lastHeartbeat && (now - this.lastHeartbeat) > this.connectionTimeout) {
          this.logger.warn(`Extension appears unresponsive (no heartbeat for ${this.connectionTimeout}ms)`);
          this.emit('extension-unresponsive');
        }
      }
    }, this.heartbeatIntervalTime);
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      extensionConnected: !!this.extensionSocket,
      pendingConnections: this.pendingConnections.size,
      pendingRequests: this.pendingRequests.size,
      registeredExtensions: Array.from(this.registeredExtensions),
      activeExtension: this.activeExtensionId,
      lastHeartbeat: this.lastHeartbeat,
      useWebSocket: this.useWebSocket,
      port: this.port
    };
  }

  
}