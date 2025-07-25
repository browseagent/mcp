/**
 * Logger Utility
 * 
 * Provides structured logging for the native host application.
 * Supports different log levels and colored output.
 */

import chalk from 'chalk';
import { format } from 'util';

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LEVEL_COLORS = {
  ERROR: chalk.red,
  WARN: chalk.yellow,
  INFO: chalk.blue,
  DEBUG: chalk.gray
};

const LEVEL_NAMES = {
  0: 'ERROR',
  1: 'WARN',
  2: 'INFO',
  3: 'DEBUG'
};

export class Logger {
  constructor(component = 'App') {
    this.component = component;
    this.level = LOG_LEVELS.INFO;
    this.startTime = Date.now();
  }

  setLevel(level) {
    if (typeof level === 'string') {
      const upperLevel = level.toUpperCase();
      if (upperLevel in LOG_LEVELS) {
        this.level = LOG_LEVELS[upperLevel];
      } else {
        throw new Error(`Invalid log level: ${level}`);
      }
    } else if (typeof level === 'number') {
      this.level = level;
    } else {
      throw new Error('Log level must be a string or number');
    }
  }

  error(...args) {
    this.log(LOG_LEVELS.ERROR, ...args);
  }

  warn(...args) {
    this.log(LOG_LEVELS.WARN, ...args);
  }

  info(...args) {
    this.log(LOG_LEVELS.INFO, ...args);
  }

  debug(...args) {
    this.log(LOG_LEVELS.DEBUG, ...args);
  }

  log(level, ...args) {
    if (level > this.level) {
      return;
    }

    const timestamp = this.getTimestamp();
    const levelName = LEVEL_NAMES[level];
    const colorFn = LEVEL_COLORS[levelName];
    
    // Format the message
    const message = args.length === 1 && typeof args[0] === 'string' 
      ? args[0] 
      : format(...args);

    // Create log entry
    const logEntry = `${chalk.gray(timestamp)} ${colorFn(levelName.padEnd(5))} ${chalk.cyan(`[${this.component}]`)} ${message}`;

    // Output to appropriate stream
    if (level <= LOG_LEVELS.WARN) {
      console.error(logEntry);
    } else {
      console.error(logEntry); // Use stderr for all logs to avoid interfering with stdout in native messaging
    }

    // For errors, also log the stack trace if available
    if (level === LOG_LEVELS.ERROR && args.length > 0) {
      const lastArg = args[args.length - 1];
      if (lastArg instanceof Error && lastArg.stack) {
        console.error(chalk.gray(lastArg.stack));
      }
    }
  }

  getTimestamp() {
    const now = new Date();
    const elapsed = now.getTime() - this.startTime;
    
    return `${now.toISOString().substring(11, 23)} (+${elapsed}ms)`;
  }

  createChild(childComponent) {
    const child = new Logger(`${this.component}:${childComponent}`);
    child.setLevel(this.level);
    child.startTime = this.startTime;
    return child;
  }

  // Performance timing helpers
  time(label) {
    this.debug(`⏱️  ${label} - start`);
    return {
      end: () => {
        this.debug(`⏱️  ${label} - end`);
      }
    };
  }

  // Request/response logging helpers
  logRequest(method, params) {
    this.debug(`📤 Request: ${method}`, params ? chalk.gray(JSON.stringify(params)) : '');
  }

  logResponse(method, result) {
    this.debug(`📥 Response: ${method}`, result ? chalk.gray(JSON.stringify(result).substring(0, 200) + '...') : '');
  }

  logError(method, error) {
    this.error(`❌ Error in ${method}:`, error);
  }

  // Memory usage logging
  logMemoryUsage() {
    const usage = process.memoryUsage();
    const formatBytes = (bytes) => {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(2)}MB`;
    };

    this.debug(
      `💾 Memory - RSS: ${formatBytes(usage.rss)}, ` +
      `Heap: ${formatBytes(usage.heapUsed)}/${formatBytes(usage.heapTotal)}, ` +
      `External: ${formatBytes(usage.external)}`
    );
  }

  // System information logging
  logSystemInfo() {
    this.info(`🖥️  System: ${process.platform} ${process.arch}`);
    this.info(`🟢 Node.js: ${process.version}`);
    this.info(`📁 Working Directory: ${process.cwd()}`);
    this.info(`🆔 Process ID: ${process.pid}`);
  }

  // Health check logging
  logHealthCheck(status) {
    const icon = status.healthy ? '✅' : '❌';
    this.info(`${icon} Health Check - Status: ${status.status}, Uptime: ${Math.round(status.uptime)}s`);
    
    if (status.errors && status.errors.length > 0) {
      status.errors.forEach(error => {
        this.warn(`⚠️  Health Issue: ${error}`);
      });
    }
  }

  // Connection status logging
  logConnection(type, status, details = {}) {
    const icons = {
      connected: '🔗',
      disconnected: '🔌',
      error: '❌',
      reconnecting: '🔄'
    };

    const icon = icons[status] || '📡';
    this.info(`${icon} ${type} connection ${status}`, details);
  }

  // Tool execution logging
  logToolExecution(toolName, args, duration, success) {
    const icon = success ? '✅' : '❌';
    const durationText = duration ? ` (${duration}ms)` : '';
    
    this.info(`${icon} Tool: ${toolName}${durationText}`);
    
    if (!success) {
      this.debug(`Tool args:`, args);
    }
  }

  // Static utility methods
  static createDefaultLogger(component = 'App', level = 'info') {
    const logger = new Logger(component);
    logger.setLevel(level);
    return logger;
  }

  static formatError(error) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code || undefined
      };
    }
    return String(error);
  }

  static formatObject(obj, maxLength = 500) {
    try {
      const str = JSON.stringify(obj, null, 2);
      return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    } catch (error) {
      return String(obj);
    }
  }
}