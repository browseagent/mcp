/**
 * WebSocket Transport for Testing and Development
 * 
 * Alternative transport for testing the MCP server without native messaging.
 * Useful for development and debugging.
 */

import { EventEmitter } from 'events';
import { WebSocketServer } from 'ws';

export class WebSocketTransport extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.port = options.port || 8765;
    this.logger = options.logger;
    this.server = null;
    this.client = null;
    this.isStarted = false;
    
    // Bind methods
    this.handleConnection = this.handleConnection.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  async start() {
    if (this.isStarted) {
      return;
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.logger.debug(`Starting WebSocket transport on port ${this.port}...`);
        
        this.server = new WebSocketServer({
          port: this.port,
          host: '127.0.0.1'
        });
        
        this.server.on('connection', this.handleConnection);
        this.server.on('error', this.handleError);
        
        this.server.on('listening', () => {
          this.isStarted = true;
          this.logger.debug(`WebSocket transport started on port ${this.port}`);
          resolve();
        });
        
      } catch (error) {
        this.logger.error('Failed to start WebSocket transport:', error);
        reject(error);
      }
    });
  }

  async stop() {
    if (!this.isStarted) {
      return;
    }
    
    return new Promise((resolve) => {
      this.logger.debug('Stopping WebSocket transport...');
      
      if (this.client) {
        this.client.close();
        this.client = null;
      }
      
      if (this.server) {
        this.server.close(() => {
          this.isStarted = false;
          this.logger.debug('WebSocket transport stopped');
          this.emit('close');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async send(message) {
    if (!this.client || this.client.readyState !== this.client.OPEN) {
      throw new Error('WebSocket client not connected');
    }
    
    try {
      const messageStr = JSON.stringify(message);
      this.logger.debug('Sending WebSocket message:', message);
      
      this.client.send(messageStr);
      
    } catch (error) {
      this.logger.error('Failed to send WebSocket message:', error);
      this.emit('error', error);
      throw error;
    }
  }
    
  handleConnection(ws) {
    this.logger.info('WebSocket client connected');
    
    // Close existing client if any
    if (this.client) {
      this.client.close();
    }
    
    this.client = ws;
    
    // Set up client event handlers
    this.client.on('message', this.handleMessage);
    this.client.on('close', this.handleClose);
    this.client.on('error', this.handleError);
    
    // Send welcome message
    this.send({
      type: 'welcome',
      message: 'Connected to Browser MCP Native Host',
      timestamp: new Date().toISOString()
    }).catch(error => {
      this.logger.error('Failed to send welcome message:', error);
    });
  }

  handleMessage(data) {
    try {
      const messageStr = data.toString('utf8');
      const message = JSON.parse(messageStr);
      
      this.logger.debug('Received WebSocket message:', message);
      this.emit('message', message);
      
    } catch (error) {
      this.logger.error('Failed to parse WebSocket message:', error);
      this.emit('error', new Error(`JSON parse error: ${error.message}`));
    }
  }

  handleClose(code, reason) {
    this.logger.info(`WebSocket client disconnected: ${code} ${reason}`);
    this.client = null;
  }

  handleError(error) {
    this.logger.error('WebSocket error:', error);
    this.emit('error', error);
  }

  getStatus() {
    return {
      type: 'websocket',
      started: this.isStarted,
      port: this.port,
      clientConnected: this.client?.readyState === this.client?.OPEN
    };
  }
}