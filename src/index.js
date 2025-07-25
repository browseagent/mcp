#!/usr/bin/env node

/**
 * BrowseAgent Native Host
 * 
 * Acts as a bridge between MCP client and the Chrome Extension.
 * Implements the MCP (Model Context Protocol) server specification.
 * Supports dynamic extension connection/disconnection.
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

// Global state
let server = null;
let bridge = null;
let config = null;
let isShuttingDown = false;

// Global error handlers
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  if (!isShuttingDown) {
    cleanup().then(() => process.exit(1));
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (!isShuttingDown) {
    cleanup().then(() => process.exit(1));
  }
});

// Graceful shutdown
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
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  try {
    logger.info('🛑 Shutting down services...');
    
    if (bridge) {
      await bridge.disconnect();
      logger.debug('✅ Extension bridge disconnected');
    }
    
    if (server) {
      await server.shutdown();
      logger.debug('✅ MCP server shut down');
    }
    
    logger.info('✅ Cleanup completed');
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}

/**
 * Setup extension bridge with flexible connection handling
 */
function setupExtensionBridge() {
  const useStdio = !program.opts().websocket && process.stdin.isTTY === false;
  
  bridge = new ExtensionBridge({
    port: config.get('port'),
    debug: config.get('debug'),
    useWebSocket: !useStdio,
    logger: logger.createChild('Bridge')
  });

  // Handle extension connection events
  bridge.on('extension-connected', (extensionInfo) => {
    logger.info(chalk.green(`🔗 Extension connected: ${extensionInfo.extensionId}`));
    logger.info(chalk.gray(`   Version: ${extensionInfo.version}`));
    logger.info(chalk.gray(`   Capabilities: ${Object.keys(extensionInfo.capabilities || {}).join(', ')}`));
    
    // Notify MCP server about extension availability
    if (server) {
      server.setExtensionAvailable(true, extensionInfo);
    }
  });

  bridge.on('extension-disconnected', (extensionInfo) => {
    logger.info(chalk.yellow(`🔌 Extension disconnected: ${extensionInfo?.extensionId || 'unknown'}`));
    
    // Notify MCP server about extension unavailability
    if (server) {
      server.setExtensionAvailable(false);
    }
  });

  bridge.on('extension-error', (error) => {
    logger.error('Extension error:', error);
  });

  bridge.on('extension-registered', (extensionInfo) => {
    logger.info(chalk.cyan(`📝 Extension registered: ${extensionInfo.extensionId}`));
  });

  return bridge;
}

/**
 * Setup MCP server with flexible extension support
 */
function setupMCPServer() {
  const useStdio = !program.opts().websocket && process.stdin.isTTY === false;
  
  const server = createServer({
    bridge,
    config,
    logger: logger.createChild('MCP'),
    useStdio,
    // Enable flexible mode - server works with or without extension
    flexibleMode: true
  });

  // console.log({
  //   server
  // });

  // Handle server events
  // server.on('client-connected', (clientInfo) => {
  //   logger.info(chalk.green(`🎯 MCP client connected: ${clientInfo?.name || 'Unknown'}`));
  // });

  // server.on('client-disconnected', () => {
  //   logger.info(chalk.yellow('👋 MCP client disconnected'));
  // });

  // server.on('tool-executed', (toolInfo) => {
  //   const icon = toolInfo.success ? '✅' : '❌';
  //   logger.info(`${icon} Tool: ${toolInfo.name} (${toolInfo.duration}ms)`);
  // });

  return server;
}

/**
 * Main application entry point
 */
async function main() {
  try {
    // Parse command line arguments
    program
      .name('browseagent-host')
      .description('BrowseAgent Native Host - Flexible Extension Connection')
      .version('1.0.0')
      .option('-d, --debug', 'Enable debug logging')
      .option('-p, --port <port>', 'WebSocket port for extension communication', '8765')
      .option('-c, --config <path>', 'Configuration file path')
      .option('--stdio', 'Use stdio communication (default for native messaging)')
      .option('--websocket', 'Use WebSocket communication (for testing)')
      .option('--wait-extension', 'Wait for extension before starting (default: false)')
      .parse();

    const options = program.opts();

    // Initialize configuration
    config = new Config(options.config);
    await config.load();

    // Override config with command line options
    if (options.debug) config.set('debug', true);
    if (options.port) config.set('port', parseInt(options.port));

    // Configure logger
    logger.setLevel(config.get('debug') ? 'debug' : 'info');

    // Show startup banner
    logger.info(chalk.blue.bold('🤖 BrowseAgent Native Host'));
    logger.info(`Version: ${chalk.green('1.0.0')}`);
    logger.info(`Node.js: ${chalk.green(process.version)}`);
    logger.info(`Platform: ${chalk.green(process.platform)} ${process.arch}`);

    // Determine communication mode
    const useStdio = options.stdio || (!options.websocket && process.stdin.isTTY === false);
    
    if (useStdio) {
      logger.info('Communication: ' + chalk.yellow('STDIO (Native Messaging)'));
    } else {
      logger.info('Communication: ' + chalk.yellow(`WebSocket (port ${config.get('port')})`));
    }

    logger.info('Mode: ' + chalk.cyan('Flexible Extension Connection'));

    // Initialize extension bridge
    logger.info('🔧 Initializing extension bridge...');
    setupExtensionBridge();
    await bridge.initialize();
    logger.info('✅ Extension bridge ready');

    // Initialize MCP server
    logger.info('🔧 Initializing MCP server...');
    const server = setupMCPServer();
    await server.start();
    logger.info('✅ MCP server ready');

    // Show operational status
    logger.info(chalk.green.bold('\n🚀 BrowseAgent Native Host is running'));
    
    if (useStdio) {
      logger.info(chalk.cyan('📡 Ready for MCP client connection via stdin/stdout'));
    } else {
      logger.info(chalk.cyan(`📡 Ready for extension connection on ws://localhost:${config.get('port')}`));
    }

    // Show extension connection status
    logger.info(chalk.blue('\n🔌 Extension Connection:'));
    logger.info(chalk.gray('   • Extension can connect/disconnect at any time'));
    logger.info(chalk.gray('   • Click "Connect" in extension popup to connect'));
    logger.info(chalk.gray('   • Full browser automation available when connected'));
    logger.info(chalk.gray('   • Limited tools available when disconnected'));

    // Show available tools based on current state
    logAvailableTools();

    // Optional: Wait for extension if requested
    if (options.waitExtension) {
      logger.info(chalk.yellow('\n⏳ Waiting for extension connection...'));
      await waitForExtensionConnection();
    }

    // Keep the process running and monitor connections
    startConnectionMonitoring();

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
    
    showTroubleshootingTips();
    process.exit(1);
  }
}

/**
 * Wait for extension connection (optional)
 */
async function waitForExtensionConnection(timeout = 60000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      logger.warn('⚠️  Extension connection timeout - continuing without extension');
      resolve(false);
    }, timeout);

    bridge.once('extension-connected', () => {
      clearTimeout(timeoutId);
      logger.info('✅ Extension connected - full functionality available');
      resolve(true);
    });
  });
}

/**
 * Monitor and log connection status changes
 */
function startConnectionMonitoring() {
  let lastExtensionStatus = false;
  let lastMCPClientStatus = false;

  setInterval(() => {
    const bridgeStatus = bridge?.getStatus();
    const serverStatus = server?.getStatus();
    
    const extensionConnected = bridgeStatus?.extensionConnected || false;
    const mcpClientConnected = serverStatus?.initialized || false;

    // Log extension status changes
    if (extensionConnected !== lastExtensionStatus) {
      if (extensionConnected) {
        logger.info(chalk.green('🔗 Extension connection established'));
        logAvailableTools();
      } else {
        logger.info(chalk.yellow('🔌 Extension connection lost'));
        logAvailableTools();
      }
      lastExtensionStatus = extensionConnected;
    }

    // Log MCP client status changes  
    if (mcpClientConnected !== lastMCPClientStatus) {
      if (mcpClientConnected) {
        logger.info(chalk.green('🎯 MCP client connected'));
      } else {
        logger.info(chalk.yellow('👋 MCP client disconnected'));
      }
      lastMCPClientStatus = mcpClientConnected;
    }

    // Log periodic status in debug mode
    if (config?.get('debug') && Math.floor(Date.now() / 30000) % 2 === 0) {
      logger.debug(`Status: Extension=${extensionConnected}, MCP=${mcpClientConnected}`);
    }

  }, 5000); // Check every 5 seconds
}

/**
 * Log currently available tools
 */
function logAvailableTools() {
  const extensionConnected = bridge?.getStatus()?.extensionConnected || false;
  
  if (extensionConnected) {
    logger.info(chalk.green('\n🛠️  Available Tools (Full Mode):'));
    logger.info(chalk.gray('   • browser_navigate - Navigate to URLs'));
    logger.info(chalk.gray('   • browser_click - Click elements'));
    logger.info(chalk.gray('   • browser_type - Type text'));
    logger.info(chalk.gray('   • browser_screenshot - Take screenshots'));
    logger.info(chalk.gray('   • browser_snapshot - Get page structure'));
    logger.info(chalk.gray('   • browser_hover - Hover over elements'));
    logger.info(chalk.gray('   • browser_drag_drop - Drag and drop'));
    logger.info(chalk.gray('   • browser_wait - Wait/pause'));
    logger.info(chalk.gray('   • browser_press_key - Press keys'));
    logger.info(chalk.gray('   • browser_get_console_logs - Get console logs'));
  } else {
    logger.info(chalk.yellow('\n🛠️  Available Tools (Limited Mode):'));
    logger.info(chalk.gray('   • browser_wait - Wait/pause'));
    logger.info(chalk.gray('   • system_info - Get system information'));
    logger.info(chalk.gray('   Note: Install and connect Chrome extension for full browser automation'));
  }
}

/**
 * Show troubleshooting tips
 */
function showTroubleshootingTips() {
  console.error(chalk.blue('\n💡 Troubleshooting:'));
  console.error('  • Make sure Node.js version is 18.0.0 or higher');
  console.error('  • For full functionality, install the BrowseAgent Chrome extension');
  console.error('  • Check that MCP client is configured with the correct MCP server path');
  console.error('  • Run with --debug flag for more detailed logging');
  console.error('  • Use --websocket flag for testing without MCP client');
}

/**
 * Health check function for monitoring
 */
export function healthCheck() {
  const bridgeStatus = bridge?.getStatus() || {};
  const serverStatus = server?.getStatus() || {};
  
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0',
    bridge: {
      initialized: bridgeStatus.initialized || false,
      extensionConnected: bridgeStatus.extensionConnected || false,
      activeExtensions: bridgeStatus.registeredExtensions || []
    },
    server: {
      initialized: serverStatus.initialized || false,
      clientConnected: serverStatus.clientConnected || false
    },
    mode: 'flexible'
  };
}

// Start the application
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}