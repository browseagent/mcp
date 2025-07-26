#!/usr/bin/env node

/**
 * Debug Connection Issue
 * 
 * Specifically tests the bridge <-> server communication
 */

import { createServer } from '../src/server/MCPServer.js';
import { ExtensionBridge } from '../src/bridge/ExtensionBridge.js';
import { Config } from '../src/config/Config.js';
import { Logger } from '../src/utils/Logger.js';
import { WebSocket } from 'ws';
import chalk from 'chalk';

async function debugConnection() {
  console.log(chalk.blue.bold('🔍 Debugging Connection Issue\n'));
  
  const config = new Config();
  const logger = new Logger('Debug');
  
  // 1. Create bridge
  console.log(chalk.cyan('1. Creating extension bridge...'));
  const bridge = new ExtensionBridge({
    port: 8765,
    debug: true,
    useWebSocket: true
  });
  
  await bridge.initialize();
  console.log(chalk.green('✅ Bridge initialized'));
  
  // 2. Create server
  console.log(chalk.cyan('2. Creating MCP server...'));
  const server = createServer({
    bridge,
    config,
    useStdio: false,
    flexibleMode: false
  });
  
  console.log(chalk.green('✅ Server created'));
  
  // 3. Connect bridge events to server
  console.log(chalk.cyan('3. Connecting bridge events to server...'));
  bridge.on('extension-connected', (extensionInfo) => {
    console.log(chalk.green('🔗 Bridge event: extension-connected'));
    console.log(chalk.gray('   Extension info:'), extensionInfo);
    server.setExtensionAvailable(true, extensionInfo);
    console.log(chalk.green('✅ Server notified of extension connection'));
  });
  
  bridge.on('extension-disconnected', (extensionInfo) => {
    console.log(chalk.yellow('🔌 Bridge event: extension-disconnected'));
    server.setExtensionAvailable(false);
    console.log(chalk.yellow('⚠️  Server notified of extension disconnection'));
  });
  
  // 4. Check initial status
  console.log(chalk.cyan('4. Initial status check...'));
  const bridgeStatus = bridge.getStatus();
  const serverStatus = server.getStatus();
  
  console.log(chalk.gray('Bridge status:'), {
    initialized: bridgeStatus.initialized,
    extensionConnected: bridgeStatus.extensionConnected,
    registeredExtensions: bridgeStatus.registeredExtensions
  });
  
  console.log(chalk.gray('Server status:'), {
    extensionAvailable: serverStatus.extensionAvailable,
    flexibleMode: serverStatus.flexibleMode
  });
  
  // 5. Connect mock extension
  console.log(chalk.cyan('5. Connecting mock extension...'));
  
  const mockExtension = new WebSocket('ws://localhost:8765');
  
  mockExtension.on('open', () => {
    console.log(chalk.gray('   WebSocket opened, sending handshake...'));
    
    const handshake = {
      type: 'handshake',
      extensionId: 'debug-test-extension',
      version: '1.0.0',
      timestamp: Date.now(),
      capabilities: {
        browserAutomation: true,
        screenshots: true,
        pageInteraction: true
      },
      userAgent: 'Chrome/91.0 Debug Test',
      platform: 'debug'
    };
    
    mockExtension.send(JSON.stringify(handshake));
  });
  
  mockExtension.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log(chalk.gray(`   Received: ${message.type}`));
    
    if (message.type === 'handshake-response' && message.success) {
      console.log(chalk.green('✅ Extension handshake successful'));
      
      // Wait a moment then check status
      setTimeout(() => {
        checkFinalStatus();
      }, 1000);
    }
  });
  
  function checkFinalStatus() {
    console.log(chalk.cyan('6. Final status check...'));
    
    const finalBridgeStatus = bridge.getStatus();
    const finalServerStatus = server.getStatus();
    
    console.log(chalk.blue('Bridge final status:'));
    console.log(chalk.gray(`  • Extension Connected: ${finalBridgeStatus.extensionConnected}`));
    console.log(chalk.gray(`  • Active Extension: ${finalBridgeStatus.activeExtension}`));
    console.log(chalk.gray(`  • Registered Extensions: ${finalBridgeStatus.registeredExtensions.join(', ')}`));
    
    console.log(chalk.blue('Server final status:'));
    console.log(chalk.gray(`  • Extension Available: ${finalServerStatus.extensionAvailable}`));
    
    // Test tool call
    if (finalServerStatus.extensionAvailable) {
      console.log(chalk.green('\n🎉 SUCCESS! Extension is available to server.'));
      testToolCall();
    } else {
      console.log(chalk.red('\n❌ FAILURE! Extension not available to server.'));
      console.log(chalk.yellow('The issue is in the bridge -> server communication.'));
    }
  }
  
  async function testToolCall() {
    console.log(chalk.cyan('\n7. Testing tool call...'));
    
    try {
      // Set up a mock response handler
      mockExtension.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'tool-request') {
          console.log(chalk.green(`📥 Extension received tool request: ${message.toolName}`));
          
          // Send mock response
          const response = {
            type: 'tool-response',
            requestId: message.requestId,
            success: true,
            result: {
              content: [{
                type: 'text',
                text: `Successfully executed ${message.toolName}`
              }]
            }
          };
          
          mockExtension.send(JSON.stringify(response));
          console.log(chalk.green('📤 Extension sent success response'));
        }
      });
      
      const result = await server.handleToolCall({
        name: 'browser_navigate',
        arguments: { url: 'https://example.com' }
      });
      
      console.log(chalk.green('✅ Tool call successful!'));
      console.log(chalk.gray('Result:'), result);
      
    } catch (error) {
      console.log(chalk.red('❌ Tool call failed:'), error.message);
    }
    
    // Cleanup
    setTimeout(() => {
      mockExtension.close();
      bridge.disconnect();
      process.exit(0);
    }, 1000);
  }
}

debugConnection().catch(console.error);