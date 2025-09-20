#!/usr/bin/env node

/**
 * BrowseAgent MCP Server
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
let bridgeUsers = 0
let config = null;
let isShuttingDown = false;

// Track active MCP servers for notifications
const activeMCPServers = new Set();

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
    
    if (server) {
      activeMCPServers.delete(server);
      await server.shutdown();
      logger.debug('✅ MCP server shut down');
    }
    
    // Only disconnect bridge if no other users
    if (bridge) {
      bridgeUsers--;
      logger.debug(`Bridge users remaining: ${bridgeUsers}`);
      
      if (bridgeUsers <= 0) {
        await bridge.disconnect();
        logger.debug('✅ Extension bridge disconnected');
        bridge = null;
        bridgeUsers = 0;
      } else {
        logger.debug('✅ Bridge kept alive for other instances');
      }
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

  // If bridge already exists, reuse it
  if (bridge && bridge.isInitialized) {
    bridgeUsers++;
    logger.info(chalk.cyan(`🔗 Reusing existing extension bridge (users: ${bridgeUsers})`));
    return bridge;
  }

  // Always use WebSocket for extension bridge
  bridge = new ExtensionBridge({
    port: config.get('port'),
    debug: config.get('debug'),
    connectionTimeout: config.get('connectionTimeout'),
    heartbeatInterval: config.get('heartbeatInterval'),
    maxRetries: config.get('maxRetries'),
    toolTimeout: config.get('toolTimeout'),
    useWebSocket: true, // Always enable WebSocket for extension
    logger: logger.createChild('Bridge')
  });

  bridgeUsers = 1;

  // Handle extension connection events
  bridge.on('extension-connected', (extensionInfo) => {
    logger.info(chalk.green(`🔗 Extension connected: ${extensionInfo?.extensionId}`));
    logger.info(chalk.gray(`   Version: ${extensionInfo?.version}`));
    logger.info(chalk.gray(`   Capabilities: ${Object.keys(extensionInfo?.capabilities || {}).join(', ')}`));
    
    // Notify all active MCP servers about extension availability
    notifyAllServersOfExtensionStatus(true, extensionInfo);
  });

  bridge.on('extension-disconnected', (extensionInfo) => {
    logger.info(chalk.yellow(`🔌 Extension disconnected: ${extensionInfo?.extensionId || 'unknown'}`));
    
    // Notify all active MCP servers about extension unavailability
    notifyAllServersOfExtensionStatus(false);
  });

  bridge.on('extension-error', (error) => {
    logger.error('Extension error:', error);
  });

  bridge.on('extension-registered', (extensionInfo) => {
    logger.info(chalk.cyan(`📝 Extension registered: ${extensionInfo.extensionId}`));
  });

  return bridge;
}


function notifyAllServersOfExtensionStatus(available, extensionInfo = null) {
  for (const server of activeMCPServers) {
    server.setExtensionAvailable(available, extensionInfo);
  }
}

/**
 * Setup MCP server with correct mode detection
 */
function setupMCPServer() {
  // Fixed mode detection: Default to STDIO unless explicitly using WebSocket
  const useStdio = !program.opts().websocket;
  
  server = createServer({
    bridge,
    config,
    logger: logger.createChild('MCP'),
    useStdio,
    // Enable flexible mode - server works with or without extension
    flexibleMode: true
  });

  // Add to active servers set
  activeMCPServers.add(server);

  // Handle server lifecycle events
  server.on('server-started', (info) => {
    logger.info(chalk.green(`🚀 MCP server started (${info.transport} mode)`));
    if (info.flexibleMode) {
      logger.info(chalk.cyan('🔄 Flexible mode enabled - works with or without extension'));
    }
  });

  server.on('server-stopped', () => {
    logger.info(chalk.yellow('🛑 MCP server stopped'));
    // Remove from active servers when stopped
    activeMCPServers.delete(server);
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
      .parse();

    const options = program.opts();

    // Initialize configuration
    config = new Config();

    // Override config with command line options
    if (options.debug) config.set('debug', true);
    if (options.port) config.set('port', parseInt(options.port));
    if (options.config) config.loadFromFile(options.config);

    // Configure logger
    logger.setLevel(config.get('debug') ? 'debug' : 'info');

    // Show startup banner
    logger.info(chalk.blue.bold('🤖 BrowseAgent MCP Server'));
    logger.info(`Version: ${chalk.green('1.0.0')}`);
    logger.info(`Node.js: ${chalk.green(process.version)}`);
    logger.info(`Platform: ${chalk.green(process.platform)} ${process.arch}`);

    // Determine MCP communication mode
    const useMCPWebSocket = options.websocket;

    logger.info('MCP Commands: '+ options);
    
    if (useMCPWebSocket) {
      logger.info('MCP Communication: ' + chalk.yellow('WebSocket (Testing Mode)'));
    } else {
      logger.info('MCP Communication: ' + chalk.yellow('STDIO (Production Mode)'));
    }
    
    logger.info('Extension Communication: ' + chalk.cyan(`WebSocket (port ${config.get('port')})`));
    logger.info('Mode: ' + chalk.cyan('Dual Mode - STDIO + WebSocket'));

    // Initialize extension bridge (always WebSocket for extensions)
    logger.info('🔧 Initializing extension bridge...');
    bridge = setupExtensionBridge();

    // Only initialize if not already initialized
    if (!bridge.isInitialized) {
      await bridge.initialize();
      logger.info('✅ Extension bridge ready');
    } else {
      logger.info('✅ Extension bridge already ready');
    }

    // Initialize MCP server
    logger.info('🔧 Initializing MCP server...');
    server = setupMCPServer();
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

    // In STDIO mode, the process stays alive handling MCP requests
    if (!useMCPWebSocket) {
      logger.info(chalk.gray('\n📡 Listening for MCP requests on stdin...'));
      logger.info(chalk.gray('📡 Listening for extension connections on WebSocket...'));
    }

  } catch (error) {
    logger.error('Failed to start BrowseAgent MCP Server:', error);
    
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