/**
 * STDIO Transport for Native Messaging
 * 
 * Implements the Chrome Native Messaging protocol using stdin/stdout.
 * This is the primary communication channel with Claude Desktop.
 */

import { EventEmitter } from 'events';
import process from 'process';

export class StdioTransport extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = options.logger;
    this.messageBuffer = Buffer.alloc(0);
    this.isStarted = false;
    
    // Bind methods
    this.handleStdinData = this.handleStdinData.bind(this);
    this.handleStdinEnd = this.handleStdinEnd.bind(this);
    this.handleStdinError = this.handleStdinError.bind(this);
  }

  async start() {
    if (this.isStarted) {
      return;
    }
    
    this.logger.debug('Starting STDIO transport...');
    
    // Configure stdin
    process.stdin.setEncoding(null); // Keep as buffer
    process.stdin.on('data', this.handleStdinData);
    process.stdin.on('end', this.handleStdinEnd);
    process.stdin.on('error', this.handleStdinError);
    
    // Configure stdout
    process.stdout.on('error', (error) => {
      this.logger.error('STDOUT error:', error);
      this.emit('error', error);
    });
    
    this.isStarted = true;
    this.logger.debug('STDIO transport started');
  }

  async stop() {
    if (!this.isStarted) {
      return;
    }
    
    this.logger.debug('Stopping STDIO transport...');
    
    // Remove event listeners
    process.stdin.removeListener('data', this.handleStdinData);
    process.stdin.removeListener('end', this.handleStdinEnd);
    process.stdin.removeListener('error', this.handleStdinError);
    
    this.isStarted = false;
    this.logger.debug('STDIO transport stopped');
    
    this.emit('close');
  }

  async send(message) {
    if (!this.isStarted) {
      throw new Error('Transport not started');
    }
    
    try {
      const messageStr = JSON.stringify(message);
      const messageBuffer = Buffer.from(messageStr, 'utf8');
      const lengthBuffer = Buffer.allocUnsafe(4);
      
      // Write message length as 32-bit unsigned integer (little-endian)
      lengthBuffer.writeUInt32LE(messageBuffer.length, 0);
      
      this.logger.debug('Sending message:', message);
      this.logger.debug(`Message length: ${messageBuffer.length} bytes`);
      
      // Write length header + message
      process.stdout.write(lengthBuffer);
      process.stdout.write(messageBuffer);
      
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      this.emit('error', error);
      throw error;
    }
  }

  handleStdinData(chunk) {
    try {
      // Append new data to buffer
      this.messageBuffer = Buffer.concat([this.messageBuffer, chunk]);
      
      // Process complete messages
      while (this.messageBuffer.length >= 4) {
        // Read message length (first 4 bytes, little-endian)
        const messageLength = this.messageBuffer.readUInt32LE(0);
        
        this.logger.debug(`Expected message length: ${messageLength} bytes`);
        
        // Check if we have the complete message
        if (this.messageBuffer.length >= 4 + messageLength) {
          // Extract message data
          const messageData = this.messageBuffer.slice(4, 4 + messageLength);
          
          // Remove processed message from buffer
          this.messageBuffer = this.messageBuffer.slice(4 + messageLength);
          
          try {
            // Parse JSON message
            const messageStr = messageData.toString('utf8');
            const message = JSON.parse(messageStr);
            
            this.logger.debug('Received message:', message);
            this.emit('message', message);
            
          } catch (parseError) {
            this.logger.error('Failed to parse message:', parseError);
            this.logger.error('Raw message data:', messageData.toString('utf8'));
            this.emit('error', new Error(`JSON parse error: ${parseError.message}`));
          }
        } else {
          // Wait for more data
          this.logger.debug(`Waiting for more data. Have ${this.messageBuffer.length}, need ${4 + messageLength}`);
          break;
        }
      }
      
    } catch (error) {
      this.logger.error('Error processing stdin data:', error);
      this.emit('error', error);
    }
  }

  handleStdinEnd() {
    this.logger.info('STDIN stream ended');
    this.emit('close');
  }

  handleStdinError(error) {
    this.logger.error('STDIN error:', error);
    this.emit('error', error);
  }

  getStatus() {
    return {
      type: 'stdio',
      started: this.isStarted,
      bufferSize: this.messageBuffer.length
    };
  }
}