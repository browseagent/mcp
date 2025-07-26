/**
 * Configuration Manager
 * 
 * Handles configuration loading, validation, and management for the native host.
 */

import { readFile, writeFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Config {
  constructor() {
    this.config = this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      // Logging configuration
      debug: false,
      logLevel: 'info',
      logFile: null,
      
      // Server configuration
      port: 8765,
      mcp_port: 8766,
      host: '127.0.0.1',
      timeout: 30000,
      
      // Extension communication
      heartbeatInterval: 30000,
      connectionTimeout: 60000,
      maxRetries: 3,
      retryDelay: 5000,
      
      // Tool execution
      toolTimeout: 60000,
      maxConcurrentTools: 5,
      screenshotQuality: 0.8,
      
      // Security
      allowedOrigins: [
        'chrome-extension://*',
        'ws://localhost:*',
        'wss://localhost:*'
      ],
      maxMessageSize: 10485760, // 10MB
      
      // Performance
      maxMemoryUsage: 536870912, // 512MB
      gcInterval: 300000, // 5 minutes
      
      // Features
      enableCursor: true,
      enableSnapshots: true,
      enableScreenshots: true,
      enableConsoleCapture: true,
      
      // Paths
      manifestPath: null,
      tempDir: null,
      
      // Environment
      nodeEnv: process.env.NODE_ENV || 'production',
      version: '1.0.0'
    };
  }

  get(key, defaultValue = undefined) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    let current = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }

  merge(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  validate() {
    const errors = [];
    
    // Validate port
    const port = this.get('port');
    if (typeof port !== 'number' || port < 1 || port > 65535) {
      errors.push('Port must be a number between 1 and 65535');
    }
    
    // Validate timeouts
    const timeout = this.get('timeout');
    if (typeof timeout !== 'number' || timeout < 1000) {
      errors.push('Timeout must be a number >= 1000ms');
    }
    
    // Validate log level
    const logLevel = this.get('logLevel');
    const validLevels = ['error', 'warn', 'info', 'debug'];
    if (!validLevels.includes(logLevel)) {
      errors.push(`Log level must be one of: ${validLevels.join(', ')}`);
    }
    
    // Validate memory limits
    const maxMemory = this.get('maxMemoryUsage');
    if (typeof maxMemory !== 'number' || maxMemory < 67108864) { // 64MB minimum
      errors.push('Max memory usage must be at least 64MB');
    }
    
    // Validate screenshot quality
    const quality = this.get('screenshotQuality');
    if (typeof quality !== 'number' || quality < 0.1 || quality > 1.0) {
      errors.push('Screenshot quality must be between 0.1 and 1.0');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    
    return true;
  }



  // Export configuration for debugging
  export() {
    return {
      ...this.config,
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  // Reset to defaults
  reset() {
    this.config = this.getDefaultConfig();
  }

  // Clone configuration
  clone() {
    const newConfig = new Config();
    newConfig.config = JSON.parse(JSON.stringify(this.config));
    return newConfig;
  }
}