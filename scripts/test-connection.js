#!/usr/bin/env node

/**
 * Test Connection Script
 * 
 * Tests the connection between Chrome extension and native host
 */

import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import chalk from 'chalk';

class ConnectionTester {
  constructor() {
    this.nativeHostProcess = null;
    this.websocket = null;
  }

  async test() {
    console.log(chalk.blue.bold('🧪 Testing BrowseAgent MCP Connection\n'));

    try {
      // Test 1: Native Host Startup
      console.log(chalk.cyan('📋 Test 1: Native Host Startup'));
      await this.testNativeHostStartup();
      console.log(chalk.green('✅ Native host startup: PASSED\n'));

      // Test 2: WebSocket Connection
      console.log(chalk.cyan('📋 Test 2: WebSocket Connection'));
      await this.testWebSocketConnection();
      console.log(chalk.green('✅ WebSocket connection: PASSED\n'));

      // Test 3: MCP Protocol
      console.log(chalk.cyan('📋 Test 3: MCP Protocol'));
      await this.testMCPProtocol();
      console.log(chalk.green('✅ MCP protocol: PASSED\n'));

      // Test 4: Tool Execution
      console.log(chalk.cyan('📋 Test 4: Tool Execution'));
      await this.testToolExecution();
      console.log(chalk.green('✅ Tool execution: PASSED\n'));

      console.log(chalk.green.bold('🎉 All tests passed! Connection is working properly.'));

    } catch (error) {
      console.error(chalk.red('❌ Test failed:', error.message));
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async testNativeHostStartup() {
    return new Promise((resolve, reject) => {
      console.log(chalk.gray('  Starting native host...'));

      this.nativeHostProcess = spawn('node', [
        'native-host/src/index.js',
        '--websocket',
        '--debug'
      ], {
        stdio: 'pipe'
      });

      let output = '';
      this.nativeHostProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      this.nativeHostProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      this.nativeHostProcess.on('error', (error) => {
        reject(new Error(`Failed to start native host: ${error.message}`));
      });

      // Wait for startup
      setTimeout(() => {
        if (output.includes('started successfully') || 
            output.includes('listening') || 
            output.includes('ready')) {
          console.log(chalk.gray('  ✓ Native host started'));
          resolve();
        } else {
          reject(new Error('Native host failed to start properly'));
        }
      }, 3000);
    });
  }

  async testWebSocketConnection() {
    return new Promise((resolve, reject) => {
      console.log(chalk.gray('  Connecting to WebSocket...'));

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);

      this.websocket = new WebSocket('ws://localhost:8765');

      this.websocket.on('open', () => {
        clearTimeout(timeout);
        console.log(chalk.gray('  ✓ WebSocket connected'));
        resolve();
      });

      this.websocket.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      });
    });
  }

  async testMCPProtocol() {
    return new Promise((resolve, reject) => {
      console.log(chalk.gray('  Testing MCP initialize...'));

      const timeout = setTimeout(() => {
        reject(new Error('MCP initialize timeout'));
      }, 5000);

      const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          }
        }
      };

      this.websocket.once('message', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          if (response.id === 1 && response.result) {
            console.log(chalk.gray('  ✓ MCP initialize successful'));
            console.log(chalk.gray(`  ✓ Server: ${response.result.serverInfo?.name || 'Unknown'}`));
            resolve();
          } else {
            reject(new Error('Invalid MCP initialize response'));
          }
        } catch (error) {
          reject(new Error('Failed to parse MCP response'));
        }
      });

      this.websocket.send(JSON.stringify(initMessage));
    });
  }

  async testToolExecution() {
    return new Promise((resolve, reject) => {
      console.log(chalk.gray('  Testing tools/list...'));

      const timeout = setTimeout(() => {
        reject(new Error('Tools list timeout'));
      }, 5000);

      const toolsMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      };

      this.websocket.once('message', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          if (response.id === 2 && response.result && response.result.tools) {
            const toolCount = response.result.tools.length;
            console.log(chalk.gray(`  ✓ Found ${toolCount} tools`));
            
            // List some tools
            const tools = response.result.tools.slice(0, 3);
            tools.forEach(tool => {
              console.log(chalk.gray(`    • ${tool.name}`));
            });
            
            resolve();
          } else {
            reject(new Error('Invalid tools list response'));
          }
        } catch (error) {
          reject(new Error('Failed to parse tools response'));
        }
      });

      this.websocket.send(JSON.stringify(toolsMessage));
    });
  }

  async cleanup() {
    console.log(chalk.gray('\n🧹 Cleaning up...'));

    if (this.websocket) {
      this.websocket.close();
    }

    if (this.nativeHostProcess) {
      this.nativeHostProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise((resolve) => {
        this.nativeHostProcess.on('close', resolve);
        setTimeout(resolve, 2000); // Force close after 2s
      });
    }

    console.log(chalk.gray('✅ Cleanup completed'));
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ConnectionTester();
  tester.test().catch(console.error);
}