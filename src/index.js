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
const logger = new Logger('MCPServer');

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
 * Setup extension bridge with dual-mode support
 * Always enables WebSocket for extension, regardless of MCP mode
 */
function setupExtensionBridge() {
  // Always use WebSocket for extension bridge
  bridge = new ExtensionBridge({
    port: config.get('port'),
    debug: config.get('debug'),
    useWebSocket: true, // Always enable WebSocket for extension
    logger: logger.createChild('Bridge')
  });

  // Handle extension connection events
  bridge.on('extension-connected', (extensionInfo) => {
    logger.info(chalk.green(`🔗 Extension connected: ${extensionInfo?.extensionId}`));
    logger.info(chalk.gray(`   Version: ${extensionInfo?.version}`));
    logger.info(chalk.gray(`   Capabilities: ${Object.keys(extensionInfo?.capabilities || {}).join(', ')}`));
    
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
 * Setup MCP server with correct mode detection
 */
function setupMCPServer() {
  // Fixed mode detection: Default to STDIO unless explicitly using WebSocket
  const useStdio = !program.opts().websocket;
  
  const server = createServer({
    bridge,
    config,
    logger: logger.createChild('MCP'),
    useStdio,
    // Enable flexible mode - server works with or without extension
    flexibleMode: true
  });

  // Handle server lifecycle events
  server.on('server-started', (info) => {
    logger.info(chalk.green(`🚀 MCP server started (${info.transport} mode)`));
    if (info.flexibleMode) {
      logger.info(chalk.cyan('🔄 Flexible mode enabled - works with or without extension'));
    }
  });

  server.on('server-stopped', () => {
    logger.info(chalk.yellow('🛑 MCP server stopped'));
  });

  server.on('server-error', (error) => {
    logger.error('MCP server error:', error);
  });

  // Handle client connection events
  server.on('client-connected', (clientInfo) => {
    logger.info(chalk.green(`🎯 MCP client connected: ${clientInfo.clientInfo?.name || 'Unknown'} v${clientInfo.clientInfo?.version || 'Unknown'}`));
    logger.info(chalk.gray(`   Protocol: ${clientInfo.protocolVersion}`));
    logger.info(chalk.gray(`   Capabilities: ${Object.keys(clientInfo.capabilities || {}).join(', ') || 'none'}`));
    
    if (clientInfo.previousClient) {
      logger.info(chalk.gray(`   Replaced previous client: ${clientInfo.previousClient.name}`));
    }
  });

  server.on('client-initialized', (info) => {
    logger.info(chalk.green(`✅ MCP client initialization complete: ${info.clientInfo?.name || 'Unknown'}`));
  });

  server.on('client-disconnected', (info) => {
    if (info.clientInfo) {
      logger.info(chalk.yellow(`👋 MCP client disconnected: ${info.clientInfo.name || 'Unknown'}`));
    } else {
      logger.info(chalk.yellow('👋 MCP client disconnected'));
    }
  });

  // Handle request cancellation
  server.on('request-cancelled', (info) => {
    logger.debug(chalk.yellow(`🚫 Request cancelled: ${info.requestId} (${info.reason})`));
  });

  // Handle tool execution events
  server.on('tool-executed', (toolInfo) => {
    const icon = toolInfo.success ? '✅' : '❌';
    const extensionStatus = toolInfo.requiresExtension 
      ? (toolInfo.extensionAvailable ? '🔗' : '🔌') 
      : '🔧';
    
    logger.info(`${icon} ${extensionStatus} Tool: ${toolInfo.name} (${toolInfo.duration}ms)`);
    
    if (!toolInfo.success) {
      logger.debug(`   Error: ${toolInfo.error}`);
    }
    
    if (toolInfo.requiresExtension && !toolInfo.extensionAvailable) {
      logger.debug('   Note: Tool requires extension but extension not connected');
    }
  });

  // Handle method execution events
  server.on('method-executed', (methodInfo) => {
    if (methodInfo.method !== 'ping') { // Reduce noise from ping requests
      const icon = methodInfo.success ? '📥' : '📥❌';
      logger.debug(`${icon} Method: ${methodInfo.method} (${methodInfo.duration}ms)`);
      
      if (!methodInfo.success) {
        logger.debug(`   Error: ${methodInfo.error}`);
      }
    }
  });

  // Handle extension availability changes
  server.on('extension-availability-changed', (info) => {
    if (info.available) {
      logger.info(chalk.green('🔗 Extension connected - full browser automation available'));
      if (info.extensionInfo) {
        logger.info(chalk.gray(`   Extension: ${info.extensionInfo.id} v${info.extensionInfo.version}`));
      }
    } else {
      logger.info(chalk.yellow('🔌 Extension disconnected - limited mode active'));
    }
  });

  // Handle tools list requests
  server.on('tools-listed', (info) => {
    logger.debug(`📋 Tools listed: ${info.toolCount} tools sent to ${info.clientInfo?.name || 'client'}`);
  });

  // Handle transport events
  server.on('transport-error', (error) => {
    logger.error('Transport error:', error);
  });

  server.on('transport-closed', () => {
    logger.info('Transport connection closed');
  });

  // Handle message errors
  server.on('message-error', (errorInfo) => {
    logger.error(`Message processing error: ${errorInfo.error}`);
    if (errorInfo.message?.method) {
      logger.debug(`Failed method: ${errorInfo.message.method}`);
    }
  });

  return server;
}


/**
 * Main application entry point - Updated for dual mode
 */
async function main() {
  try {
    // Parse command line arguments
    program
      .name('browseagent-mcp')
      .description('BrowseAgent MCP Server - Dual Mode Operation')
      .version('1.0.0')
      .option('-d, --debug', 'Enable debug logging')
      .option('-p, --port <port>', 'WebSocket port for extension communication', '8765')
      .option('-c, --config <path>', 'Configuration file path')
      .option('--stdio', 'Force STDIO communication (default unless --websocket used)')
      .option('--websocket', 'Force WebSocket communication for MCP (for testing)')
      .option('--wait-extension', 'Wait for extension before starting (default: false)')
      .parse();

    const options = program.opts();

    // Initialize configuration
    config = new Config();

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

    // Determine MCP communication mode
    const useMCPWebSocket = options.websocket;
    
    if (useMCPWebSocket) {
      logger.info('MCP Communication: ' + chalk.yellow('WebSocket (Testing Mode)'));
    } else {
      logger.info('MCP Communication: ' + chalk.yellow('STDIO (Production Mode)'));
    }
    
    logger.info('Extension Communication: ' + chalk.cyan(`WebSocket (port ${config.get('port')})`));
    logger.info('Mode: ' + chalk.cyan('Dual Mode - STDIO + WebSocket'));

    // Initialize extension bridge (always WebSocket for extensions)
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
    logger.info(chalk.green.bold('\n🚀 BrowseAgent MCP Server is running'));
    
    if (useMCPWebSocket) {
      logger.info(chalk.cyan('📡 MCP: Ready for client connection via WebSocket'));
      logger.info(chalk.cyan(`📡 Extension: Ready for connection on ws://localhost:${config.get('port')}`));
    } else {
      logger.info(chalk.cyan('📡 MCP: Ready for client connection via stdin/stdout'));
      logger.info(chalk.cyan(`📡 Extension: Ready for connection on ws://localhost:${config.get('port')}`));
    }
    
    logger.info(chalk.blue('\n🔌 Dual Mode Operation:'));
    logger.info(chalk.gray('   • Claude Desktop connects via STDIO'));
    logger.info(chalk.gray('   • Chrome Extension connects via WebSocket'));
    logger.info(chalk.gray('   • Both can operate simultaneously'));
    logger.info(chalk.gray('   • Full browser automation when extension connected'));

    // Optional: Wait for extension if requested
    if (options.waitExtension) {
      logger.info(chalk.yellow('\n⏳ Waiting for extension connection...'));
      await waitForExtensionConnection();
    }

    // In STDIO mode, the process stays alive handling MCP requests
    if (!useMCPWebSocket) {
      logger.info(chalk.gray('\n📡 Listening for MCP requests on stdin...'));
      logger.info(chalk.gray('📡 Listening for extension connections on WebSocket...'));
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