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
  constructor(configPath = null) {
    this.configPath = configPath || this.getDefaultConfigPath();
    this.config = this.getDefaultConfig();
    this.loaded = false;
  }

  getDefaultConfigPath() {
    // Use platform-specific config directory
    const configDir = process.platform === 'win32' 
      ? join(homedir(), 'AppData', 'Local', 'BrowseAgent')
      : join(homedir(), '.config', 'browse-agent');
    
    return join(configDir, 'config.json');
  }

  getDefaultConfig() {
    return {
      // Logging configuration
      debug: false,
      logLevel: 'info',
      logFile: null,
      
      // Server configuration
      port: 8765,
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
        'chrome-extension://*'
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

  async load() {
    try {
      // Check if config file exists
      await access(this.configPath);
      
      // Read and parse config file
      const configData = await readFile(this.configPath, 'utf8');
      const fileConfig = JSON.parse(configData);
      
      // Merge with defaults
      this.config = { ...this.config, ...fileConfig };
      
      this.loaded = true;
      return true;
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Config file doesn't exist, use defaults
        this.loaded = true;
        return false;
      } else {
        throw new Error(`Failed to load config: ${error.message}`);
      }
    }
  }

  async save() {
    try {
      // Ensure config directory exists
      const configDir = dirname(this.configPath);
      await this.ensureDirectory(configDir);
      
      // Write config file
      const configData = JSON.stringify(this.config, null, 2);
      await writeFile(this.configPath, configData, 'utf8');
      
      return true;
      
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
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

  async ensureDirectory(dirPath) {
    try {
      await access(dirPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const { mkdir } = await import('fs/promises');
        await mkdir(dirPath, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  // Environment-specific configurations
  isDevelopment() {
    return this.get('nodeEnv') === 'development';
  }

  isProduction() {
    return this.get('nodeEnv') === 'production';
  }

  isDebugEnabled() {
    return this.get('debug') || this.isDevelopment();
  }

  // Platform-specific configurations
  getPlatformConfig() {
    const platform = process.platform;
    const platformConfigs = {
      win32: {
        manifestPath: join(homedir(), 'AppData', 'Local', 'BrowseAgent', 'manifest.json'),
        tempDir: join(homedir(), 'AppData', 'Local', 'Temp', 'BrowseAgent')
      },
      darwin: {
        manifestPath: join(homedir(), 'Library', 'Application Support', 'BrowseAgent', 'manifest.json'),
        tempDir: join('/tmp', 'browse-agent')
      },
      linux: {
        manifestPath: join(homedir(), '.local', 'share', 'browse-agent', 'manifest.json'),
        tempDir: join('/tmp', 'browse-agent')
      }
    };
    
    return platformConfigs[platform] || platformConfigs.linux;
  }

  // Get effective configuration (with platform overrides)
  getEffectiveConfig() {
    const platformConfig = this.getPlatformConfig();
    return {
      ...this.config,
      ...platformConfig,
      // Override with explicitly set platform values
      manifestPath: this.get('manifestPath') || platformConfig.manifestPath,
      tempDir: this.get('tempDir') || platformConfig.tempDir
    };
  }

  // Configuration presets
  static getDevelopmentPreset() {
    return {
      debug: true,
      logLevel: 'debug',
      nodeEnv: 'development',
      enableCursor: true,
      heartbeatInterval: 10000, // More frequent in dev
      toolTimeout: 120000 // Longer timeout for debugging
    };
  }

  static getProductionPreset() {
    return {
      debug: false,
      logLevel: 'info',
      nodeEnv: 'production',
      enableCursor: false, // Disabled by default in production
      heartbeatInterval: 30000,
      toolTimeout: 60000
    };
  }

  static getTestingPreset() {
    return {
      debug: true,
      logLevel: 'debug',
      nodeEnv: 'test',
      port: 8766, // Different port for testing
      timeout: 10000,
      toolTimeout: 30000
    };
  }

  // Apply preset configuration
  applyPreset(presetName) {
    const presets = {
      development: Config.getDevelopmentPreset(),
      production: Config.getProductionPreset(),
      testing: Config.getTestingPreset()
    };
    
    const preset = presets[presetName];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }
    
    this.merge(preset);
  }

  // Export configuration for debugging
  export() {
    return {
      ...this.config,
      configPath: this.configPath,
      loaded: this.loaded,
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
    newConfig.configPath = this.configPath;
    newConfig.loaded = this.loaded;
    return newConfig;
  }
}