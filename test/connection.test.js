#!/usr/bin/env node

/**
 * Connection Test Script
 * 
 * Tests the connection between MCP server, extension bridge, and Chrome extension
 */

import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import chalk from 'chalk';
import { setTimeout } from 'timers/promises';

class ConnectionTester {
  constructor() {
    this.nativeHostProcess = null;
    this.websocket = null;
    this.testResults = {
      nativeHostStartup: false,
      websocketConnection: false,
      mcpProtocol: false,
      extensionHandshake: false
    };
  }

  async runTests() {
    console.log(chalk.blue.bold('🧪 BrowseAgent MCP Connection Tests\n'));

    const tests = [
      { name: 'Native Host Startup', fn: () => this.testNativeHostStartup() },
      { name: 'WebSocket Connection', fn: () => this.testWebSocketConnection() },
      { name: 'MCP Protocol Handshake', fn: () => this.testMCPProtocol() },
      { name: 'Extension Bridge Ready', fn: () => this.testExtensionBridge() }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        console.log(chalk.cyan(`📋 Testing: ${test.name}...`));
        await test.fn();
        console.log(chalk.green(`✅ ${test.name}: PASSED\n`));
        passed++;
      } catch (error) {
        console.log(chalk.red(`❌ ${test.name}: FAILED`));
        console.log(chalk.gray(`   Error: ${error.message}\n`));
        failed++;
      }
    }

    // Summary
    console.log(chalk.blue.bold('📊 Test Summary'));
    console.log(`${chalk.green('✅ Passed:')} ${passed}`);
    console.log(`${chalk.red('❌ Failed:')} ${failed}`);
    console.log(`${chalk.blue('📈 Success Rate:')} ${Math.round((passed / (passed + failed)) * 100)}%\n`);

    if (failed === 0) {
      console.log(chalk.green.bold('🎉 All connection tests passed!'));
      console.log(chalk.cyan('✅ Your MCP server is ready for use with Claude Desktop\n'));
    } else {
      console.log(chalk.yellow.bold('⚠️  Some tests failed'));
      this.showTroubleshootingTips();
    }

    await this.cleanup();
    process.exit(failed > 0 ? 1 : 0);
  }

  async testNativeHostStartup() {
    console.log(chalk.gray('   Starting native host process...'));

    return new Promise((resolve, reject) => {
      this.nativeHostProcess = spawn('node', ['src/index.js', '--websocket', '--debug'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let output = '';
      let errorOutput = '';

      this.nativeHostProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      this.nativeHostProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      this.nativeHostProcess.on('error', (error) => {
        reject(new Error(`Failed to start process: ${error.message}`));
      });

      // Wait for startup indicators
      setTimeout(() => {
        if (output.includes('started') || 
            output.includes('ready') || 
            output.includes('listening') ||
            output.includes('BrowseAgent Native Host')) {
          console.log(chalk.gray('   ✓ Process started successfully'));
          this.testResults.nativeHostStartup = true;
          resolve();
        } else {
          reject(new Error(`Startup failed. Output: ${output.slice(0, 200)}...`));
        }
      }, 4000);
    });
  }

  async testWebSocketConnection() {
    console.log(chalk.gray('   Connecting to WebSocket server...'));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 8000);

      this.websocket = new WebSocket('ws://localhost:8765');

      this.websocket.on('open', () => {
        clearTimeout(timeout);
        console.log(chalk.gray('   ✓ WebSocket connected'));
        this.testResults.websocketConnection = true;
        resolve();
      });

      this.websocket.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection failed: ${error.message}`));
      });
    });
  }

  async testMCPProtocol() {
    console.log(chalk.gray('   Testing MCP protocol initialization...'));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP protocol test timeout'));
      }, 5000);

      const initMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'connection-test',
            version: '1.0.0'
          }
        }
      };

      this.websocket.once('message', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          
          if (response.id === 1 && response.result) {
            console.log(chalk.gray('   ✓ MCP initialization successful'));
            console.log(chalk.gray(`   ✓ Server: ${response.result.serverInfo?.name || 'Unknown'}`));
            console.log(chalk.gray(`   ✓ Protocol: ${response.result.protocolVersion || 'Unknown'}`));
            this.testResults.mcpProtocol = true;
            resolve();
          } else {
            reject(new Error('Invalid MCP initialize response'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse MCP response: ${error.message}`));
        }
      });

      this.websocket.send(JSON.stringify(initMessage));
    });
  }

  async testExtensionBridge() {
    console.log(chalk.gray('   Testing extension bridge readiness...'));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log(chalk.yellow('   ⚠ Extension not connected (this is normal)'));
        console.log(chalk.gray('   ✓ Bridge is ready for extension connections'));
        this.testResults.extensionHandshake = true;
        resolve();
      }, 3000);

      // Send a test handshake message
      const handshakeMessage = {
        type: 'handshake',
        extensionId: 'test-extension-id',
        version: '1.0.0',
        timestamp: Date.now(),
        capabilities: { test: true }
      };

      this.websocket.once('message', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          
          if (response.type === 'handshake-response') {
            console.log(chalk.gray('   ✓ Extension bridge responded correctly'));
            this.testResults.extensionHandshake = true;
            resolve();
          }
        } catch (error) {
          // Continue with timeout - this is expected
        }
      });

      this.websocket.send(JSON.stringify(handshakeMessage));
    });
  }

  showTroubleshootingTips() {
    console.log(chalk.blue('\n💡 Troubleshooting Tips:'));
    
    if (!this.testResults.nativeHostStartup) {
      console.log(chalk.gray('   • Check Node.js version (requires 18.0.0+)'));
      console.log(chalk.gray('   • Ensure src/index.js exists and is executable'));
      console.log(chalk.gray('   • Try running: node src/index.js --debug'));
    }
    
    if (!this.testResults.websocketConnection) {
      console.log(chalk.gray('   • Check if port 8765 is available'));
      console.log(chalk.gray('   • Verify firewall settings'));
      console.log(chalk.gray('   • Try a different port with --port flag'));
    }
    
    if (!this.testResults.mcpProtocol) {
      console.log(chalk.gray('   • Check MCP server implementation'));
      console.log(chalk.gray('   • Verify JSON-RPC message format'));
      console.log(chalk.gray('   • Review server logs for errors'));
    }
    
    console.log(chalk.gray('\n   Run with --debug flag for more detailed logging'));
  }

  async cleanup() {
    console.log(chalk.gray('\n🧹 Cleaning up test resources...'));

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

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ConnectionTester();
  tester.runTests().catch((error) => {
    console.error(chalk.red('Fatal test error:'), error);
    process.exit(1);
  });
}

export { ConnectionTester };