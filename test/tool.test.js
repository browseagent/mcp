#!/usr/bin/env node

/**
 * Tool Call Test
 * 
 * Interactive script for manually testing specific tool calls
 * Useful for debugging specific tool execution flows
 */

import { createServer } from '../src/server/MCPServer.js';
import { ExtensionBridge } from '../src/bridge/ExtensionBridge.js';
import { Config } from '../src/config/Config.js';
import { Logger } from '../src/utils/Logger.js';
import { WebSocket } from 'ws';
import chalk from 'chalk';
import readline from 'readline';

class ToolTester {
  constructor() {
    this.config = new Config();
    this.logger = new Logger('ManualTest');
    this.bridge = null;
    this.server = null;
    this.rl = null;
  }

  async start() {
    console.log(chalk.blue.bold('🔧 Manual Tool Call Tester\n'));
    
    try {
      await this.setupEnvironment();
      await this.startInteractiveSession();
    } catch (error) {
      console.error(chalk.red('Setup failed:'), error);
      process.exit(1);
    }
  }

  async setupEnvironment() {
    console.log(chalk.cyan('Setting up test environment...'));
    
    // Setup extension bridge
    this.bridge = new ExtensionBridge({
      port: 8765,
      debug: true,
      useWebSocket: true
    });
    
    await this.bridge.initialize();
    console.log(chalk.green('✅ Extension bridge ready'));
    
    // Setup MCP server
    this.server = createServer({
      bridge: this.bridge,
      config: this.config,
      useStdio: false,
      flexibleMode: false // Require extension for this test
    });
    
    // Connect bridge events to server
    this.setupBridgeToServerCommunication();
    
    //Setup readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    console.log(chalk.green('✅ Test environment ready'));
  }

  setupBridgeToServerCommunication() {
    // Connect bridge events to server
    this.bridge.on('extension-connected', (extensionInfo) => {
      console.log(chalk.green('🔗 Bridge notified server of extension connection'));
      this.server.setExtensionAvailable(true, extensionInfo);
    });
    
    this.bridge.on('extension-disconnected', (extensionInfo) => {
      console.log(chalk.yellow('🔌 Bridge notified server of extension disconnection'));
      this.server.setExtensionAvailable(false);
    });
  }


  async startInteractiveSession() {
    console.log(chalk.blue.bold('\n🎮 Interactive Tool Testing Session'));
    console.log(chalk.gray('Commands:'));
    console.log(chalk.gray('  test <tool_name> - Test a specific tool'));
    console.log(chalk.gray('  list - List available tools'));
    console.log(chalk.gray('  status - Show connection status'));
    console.log(chalk.gray('  quit - Exit the tester\n'));
    
    while (true) {
      const command = await this.askUser('> ');
      
      if (command === 'quit' || command === 'exit') {
        break;
      } else if (command === 'list') {
        this.listAvailableTools();
      } else if (command === 'status') {
        this.showConnectionStatus();
      } else if (command.startsWith('test ')) {
        const toolName = command.substring(5).trim();
        await this.testTool(toolName);
      } else {
        console.log(chalk.yellow('Unknown command. Type "list", "status", or "test <tool_name>"'));
      }
    }
    
    await this.cleanup();
  }

  showConnectionStatus() {
    console.log(chalk.blue('\n📊 Connection Status:'));
    
    const bridgeStatus = this.bridge.getStatus();
    const serverStatus = this.server.getStatus();
    
    console.log(chalk.cyan('Bridge:'));
    console.log(chalk.gray(`  • Initialized: ${bridgeStatus.initialized}`));
    console.log(chalk.gray(`  • Extension Connected: ${bridgeStatus.extensionConnected}`));
    console.log(chalk.gray(`  • Active Extension: ${bridgeStatus.activeExtension || 'none'}`));
    console.log(chalk.gray(`  • Registered Extensions: ${bridgeStatus.registeredExtensions.join(', ') || 'none'}`));
    
    console.log(chalk.cyan('MCP Server:'));
    console.log(chalk.gray(`  • Extension Available: ${serverStatus.extensionAvailable}`));
    console.log(chalk.gray(`  • Flexible Mode: ${serverStatus.flexibleMode}`));
    
    if (bridgeStatus.extensionConnected && !serverStatus.extensionAvailable) {
      console.log(chalk.red('⚠️  Bridge shows extension connected but server shows unavailable!'));
      console.log(chalk.yellow('   This indicates a communication issue between bridge and server.'));
    }
    
    console.log('');
  }

  listAvailableTools() {
    const tools = [
      'browser_navigate',
      'browser_click', 
      'browser_type',
      'browser_screenshot',
      'browser_snapshot',
      'browser_hover',
      'browser_wait',
      'browser_press_key',
      'browser_go_back',
      'browser_go_forward',
      'browser_get_console_logs',
      'browser_drag_drop'
    ];
    
    console.log(chalk.cyan('\n📋 Available Tools:'));
    tools.forEach(tool => {
      console.log(chalk.gray(`  • ${tool}`));
    });
    console.log('');
  }

  async testTool(toolName) {
    console.log(chalk.cyan(`\n🔧 Testing tool: ${toolName}`));
    
    // Get tool arguments interactively
    const args = await this.getToolArguments(toolName);
    
    try {
      console.log(chalk.yellow('⏳ Executing tool call...'));
      const startTime = Date.now();
      
      // Call the handleToolCall method directly
      const result = await this.server.handleToolCall({
        name: toolName,
        arguments: args
      });
      
      const duration = Date.now() - startTime;
      
      console.log(chalk.green(`✅ Tool executed successfully (${duration}ms)`));
      console.log(chalk.gray('Result:'), JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.log(chalk.red(`❌ Tool execution failed: ${error.message}`));
    }
    
    console.log('');
  }

  async getToolArguments(toolName) {
    const toolSchemas = {
      browser_navigate: ['url', 'tabId?'],
      browser_click: ['element', 'ref', 'tabId?'],
      browser_type: ['element', 'ref', 'text', 'submit?', 'tabId?'],
      browser_screenshot: ['tabId?', 'fullPage?', 'element?', 'ref?'],
      browser_snapshot: ['tabId?'],
      browser_hover: ['element', 'ref', 'tabId?'],
      browser_wait: ['time'],
      browser_press_key: ['key', 'tabId?'],
      browser_go_back: ['tabId?'],
      browser_go_forward: ['tabId?'],
      browser_get_console_logs: ['tabId?'],
      browser_drag_drop: ['sourceElement', 'sourceRef', 'targetElement', 'targetRef', 'tabId?']
    };
    
    const schema = toolSchemas[toolName];
    if (!schema) {
      console.log(chalk.yellow('Using default empty arguments'));
      return {};
    }
    
    console.log(chalk.gray(`Required arguments: ${schema.join(', ')}`));
    
    const args = {};
    for (const arg of schema) {
      const isOptional = arg.endsWith('?');
      const argName = isOptional ? arg.slice(0, -1) : arg;
      
      if (isOptional) {
        const value = await this.askUser(`${argName} (optional): `);
        if (value.trim()) {
          args[argName] = this.parseValue(value);
        }
      } else {
        const value = await this.askUser(`${argName}: `);
        args[argName] = this.parseValue(value);
      }
    }
    
    return args;
  }

  parseValue(value) {
    // Try to parse as number
    if (!isNaN(value) && value.trim() !== '') {
      return Number(value);
    }
    
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Return as string
    return value;
  }

  askUser(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  async cleanup() {
    console.log(chalk.gray('\n🧹 Cleaning up...'));
    
    if (this.rl) {
      this.rl.close();
    }
    
    if (this.bridge) {
      await this.bridge.disconnect();
    }
    
    console.log(chalk.gray('✅ Cleanup completed'));
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ToolTester();
  tester.start().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { ToolTester };