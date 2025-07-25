/**
 * STDIO Transport for MCP Protocol
 * 
 * Implements JSON-RPC over STDIO for MCP clients.
 * Claude Desktop uses JSON-RPC format, not Chrome Native Messaging format.
 */

import { EventEmitter } from 'events';
import process from 'process';

export class StdioTransport extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = options.logger;
    this.isStarted = false;
    this.inputBuffer = '';
    
    // Bind methods
    this.handleStdinData = this.handleStdinData.bind(this);
    this.handleStdinEnd = this.handleStdinEnd.bind(this);
    this.handleStdinError = this.handleStdinError.bind(this);
  }

  async start() {
    if (this.isStarted) {
      return;
    }
    
    this.logger.debug('Starting STDIO transport (JSON-RPC format)...');
    
    // Configure stdin for JSON-RPC (line-based) communication
    process.stdin.setEncoding('utf8'); // Use UTF-8 encoding for JSON-RPC
    process.stdin.on('data', this.handleStdinData);
    process.stdin.on('end', this.handleStdinEnd);
    process.stdin.on('error', this.handleStdinError);
    
    // Configure stdout
    process.stdout.on('error', (error) => {
      this.logger.error('STDOUT error:', error);
      this.emit('error', error);
    });
    
    this.isStarted = true;
    this.logger.debug('STDIO transport started (JSON-RPC mode)');
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
      // JSON-RPC format: serialize as JSON and add newline
      const messageStr = JSON.stringify(message);
      
      this.logger.debug('Sending message:', message);
      this.logger.debug(`Message length: ${messageStr.length} characters`);
      
      // Write JSON message followed by newline
      process.stdout.write(messageStr + '\n');
      
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      this.emit('error', error);
      throw error;
    }
  }

  handleStdinData(chunk) {
    try {
      // Add chunk to input buffer
      this.inputBuffer += chunk;
      
      this.logger.debug(`Received chunk: ${chunk.length} chars, buffer size: ${this.inputBuffer.length}`);
      
      // Process complete lines (JSON-RPC messages are line-delimited)
      let lines = this.inputBuffer.split('\n');
      
      // Keep the last incomplete line in the buffer
      this.inputBuffer = lines.pop() || '';
      
      // Process each complete line
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          this.processMessage(trimmedLine);
        }
      }
      
    } catch (error) {
      this.logger.error('Error processing stdin data:', error);
      this.emit('error', error);
    }
  }

  processMessage(messageStr) {
    try {
      this.logger.debug('Processing message string:', messageStr.slice(0, 200) + (messageStr.length > 200 ? '...' : ''));
      
      // Parse JSON message
      const message = JSON.parse(messageStr);
      
      this.logger.debug('Parsed message:', message);
      this.emit('message', message);
      
    } catch (parseError) {
      this.logger.error('Failed to parse JSON message:', parseError);
      this.logger.error('Raw message:', messageStr.slice(0, 500));
      
      // Don't emit error for malformed messages - just log and continue
      // This makes the transport more resilient
      this.logger.warn('Skipping malformed message');
    }
  }

  handleStdinEnd() {
    this.logger.info('STDIN stream ended');
    
    // Process any remaining data in buffer
    if (this.inputBuffer.trim()) {
      this.processMessage(this.inputBuffer.trim());
    }
    
    this.emit('close');
  }

  handleStdinError(error) {
    this.logger.error('STDIN error:', error);
    this.emit('error', error);
  }

  getStatus() {
    return {
      type: 'stdio',
      format: 'json-rpc',
      started: this.isStarted,
      bufferSize: this.inputBuffer.length
    };
  }
}