#!/usr/bin/env node

/**
 * BrowseAgent Native Host
 * 
 * Acts as a bridge between Claude Desktop (MCP client) and the Chrome Extension.
 * Implements the MCP (Model Context Protocol) server specification.
 */

import { createServer } from './server/MCPServer.js';
import { ExtensionBridge } from './bridge/ExtensionBridge.js';
import { Logger } from './utils/Logger.js';
import { Config } from './config/Config.js';
import process from 'process';
import { program } from 'commander';
import chalk from 'chalk';

// Initialize logger
const logger = new Logger('NativeHost');

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
let server = null;
let bridge = null;

process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await cleanup();
  process.exit(0);
});

async function cleanup() {
  try {
    if (bridge) {
      await bridge.disconnect();
    }
    if (server) {
      await server.shutdown();
    }
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

/**
 * Main application entry point
 */
async function main() {
  try {
    // Parse command line arguments
    program
      .name('browseagent-host')
      .description('BrowseAgent Native Host')
      .version('1.0.0')
      .option('-d, --debug', 'Enable debug logging')
      .option('-p, --port <port>', 'WebSocket port for extension communication', '8765')
      .option('-c, --config <path>', 'Configuration file path')
      .option('--stdio', 'Use stdio communication (default for native messaging)')
      .option('--websocket', 'Use WebSocket communication (for testing)')
      .parse();

    const options = program.opts();

    // Initialize configuration
    const config = new Config(options.config);
    await config.load();

    // Override config with command line options
    if (options.debug) config.set('debug', true);
    if (options.port) config.set('port', parseInt(options.port));

    // Configure logger
    logger.setLevel(config.get('debug') ? 'debug' : 'info');

    logger.info(chalk.blue('🤖 BrowseAgent Native Host starting...'));
    logger.info(`Version: ${chalk.green('1.0.0')}`);
    logger.info(`Node.js: ${chalk.green(process.version)}`);
    logger.info(`Platform: ${chalk.green(process.platform)} ${process.arch}`);

    // Determine communication mode
    const useStdio = options.stdio || (!options.websocket && process.stdin.isTTY === false);
    
    if (useStdio) {
      logger.info('Communication mode: ' + chalk.yellow('STDIO (Native Messaging)'));
    } else {
      logger.info('Communication mode: ' + chalk.yellow(`WebSocket (port ${config.get('port')})`));
    }

    // Create extension bridge
    bridge = new ExtensionBridge({
      port: config.get('port'),
      debug: config.get('debug'),
      useWebSocket: !useStdio
    });

    // Create MCP server
    server = createServer({
      bridge,
      config,
      logger,
      useStdio
    });

    // Initialize and start
    await bridge.initialize();
    await server.start();

    logger.info(chalk.green('✅ BrowseAgent Native Host started successfully'));
    
    if (useStdio) {
      logger.info(chalk.cyan('Waiting for Claude Desktop connection via stdin/stdout...'));
    } else {
      logger.info(chalk.cyan(`Waiting for extension connection on ws://localhost:${config.get('port')}`));
    }

    // Keep the process running
    if (!useStdio) {
      // For WebSocket mode, keep alive
      setInterval(() => {
        // Heartbeat to keep process alive
      }, 30000);
    }

  } catch (error) {
    logger.error('Failed to start BrowseAgent Native Host:', error);
    
    console.error(chalk.red('\n❌ Startup failed:'));
    console.error(chalk.red(error.message));
    
    if (error.code) {
      console.error(chalk.yellow(`Error code: ${error.code}`));
    }
    
    if (error.stack && program.opts().debug) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
    
    console.error(chalk.blue('\n💡 Troubleshooting:'));
    console.error('  • Make sure Chrome extension is installed and enabled');
    console.error('  • Check that native host manifest is properly installed');
    console.error('  • Verify Node.js version is 18.0.0 or higher');
    console.error('  • Run with --debug flag for more detailed logging');
    
    process.exit(1);
  }
}

/**
 * Health check function for monitoring
 */
export function healthCheck() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
    bridge: bridge?.getStatus() || 'not-initialized',
    server: server?.getStatus() || 'not-initialized'
  };
}

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}