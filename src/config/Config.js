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
      logFile: null,
      
      // Server configuration
      port: 8765,
      mcp_port: 8766,
      host: '127.0.0.1',
      timeout: 30000,
      
      // Extension communication
      heartbeatInterval: 30000,
      connectionTimeout: 90000,
      maxRetries: 5,

      // Tool execution
      toolTimeout: 120000,

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

  loadFromFile(filePath) {
    return readFile(filePath, 'utf-8')
      .then(data => {
        const parsed = JSON.parse(data);
        this.merge(parsed);
      })
      .catch(err => {
        throw new Error(`Failed to load config from ${filePath}: ${err.message}`);
      });
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

    const heartbeatInterval = this.get('heartbeatInterval');
    if (typeof heartbeatInterval !== 'number' || heartbeatInterval < 10000) {
      errors.push('Heartbeat interval must be a number >= 10000ms');
    }

    const connectionTimeout = this.get('connectionTimeout');
    if (typeof connectionTimeout !== 'number' || connectionTimeout < 30000) {
      errors.push('Connection timeout must be a number >= 30000ms');
    }

    const maxRetries = this.get('maxRetries');
    if (typeof maxRetries !== 'number' || maxRetries < 0 || maxRetries > 10) {
      errors.push('Max retries must be a number between 0 and 10');
    }

    const toolTimeout = this.get('toolTimeout');
    if (typeof toolTimeout !== 'number' || toolTimeout < 30000) {
      errors.push('Tool timeout must be a number >= 30000ms');
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