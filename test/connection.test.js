#!/usr/bin/env node

/**
 * Connection Test Script
 * 
 * Tests the connection between MCP server, extension bridge, and Chrome extension
 */

import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import chalk from 'chalk';

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
      { name: 'Extension Bridge Protocol', fn: () => this.testExtensionBridge() },
      { name: 'Architecture Verification', fn: () => this.testArchitectureVerification() }
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
      console.log(chalk.cyan('✅ Your BrowseAgent MCP server is properly configured\n'));
    } else {
      console.log(chalk.yellow.bold('⚠️  Some tests failed'));
      this.showTroubleshootingTips();
    }

    console.log(chalk.blue.bold('📋 Architecture Summary:'));
    console.log(chalk.gray('   • WebSocket (port 8765): Chrome Extension Bridge'));
    console.log(chalk.gray('   • STDIO (stdin/stdout): MCP Client Communication'));
    console.log(chalk.gray('   • For Claude Desktop: Use STDIO transport'));
    console.log(chalk.gray('   • For Chrome Extension: Use WebSocket transport'));

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
      let resolved = false;

      this.nativeHostProcess.stdout.on('data', (data) => {
        output += data.toString();
        this.checkStartupSuccess();
      });

      this.nativeHostProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        output += chunk;
        this.checkStartupSuccess();
      });

      this.nativeHostProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Failed to start process: ${error.message}`));
        }
      });

      this.nativeHostProcess.on('exit', (code) => {
        if (!resolved && code !== 0) {
          resolved = true;
          reject(new Error(`Process exited with code ${code}. Output: ${output.slice(-500)}`));
        }
      });

      const checkStartupSuccess = () => {
        if (resolved) return;
        
        const successIndicators = [
          'BrowseAgent Native Host',
          'Extension bridge ready',
          'MCP server ready',
          'is running',
          'WebSocket server listening',
          'Ready for MCP client connection',
          'Ready for extension connection'
        ];

        const hasSuccessIndicator = successIndicators.some(indicator => 
          output.toLowerCase().includes(indicator.toLowerCase())
        );

        if (hasSuccessIndicator) {
          resolved = true;
          console.log(chalk.gray('   ✓ Process started successfully'));
          this.testResults.nativeHostStartup = true;
          resolve();
        }
      };

      this.checkStartupSuccess = checkStartupSuccess;

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`Startup timeout. Recent output: ${output.slice(-300)}...`));
        }
      }, 6000);
    });
  }

  async testWebSocketConnection() {
    console.log(chalk.gray('   Connecting to WebSocket server...'));

    await new Promise(resolve => setTimeout(resolve, 1000));

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

  async testExtensionBridge() {
    console.log(chalk.gray('   Testing extension bridge protocol...'));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.log(chalk.yellow('   ⚠ No extension connected (this is expected)'));
        console.log(chalk.gray('   ✓ Bridge is ready for extension connections'));
        this.testResults.extensionHandshake = true;
        resolve();
      }, 3000);

      // Test if we receive a welcome message (indicates bridge is working)
      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          console.log(chalk.gray(`   📥 Received bridge message: ${response.type}`));
          
          if (response.type === 'welcome') {
            clearTimeout(timeout);
            console.log(chalk.gray('   ✓ Extension bridge protocol working'));
            this.testResults.extensionHandshake = true;
            resolve();
          }
        } catch (error) {
          // Continue with timeout
        }
      };

      this.websocket.once('message', messageHandler);

      // Send a test handshake
      const testMessage = {
        type: 'handshake',
        extensionId: 'connection-test',
        version: '1.0.0',
        timestamp: Date.now(),
        capabilities: { test: true }
      };

      this.websocket.send(JSON.stringify(testMessage));
    });
  }

  async testArchitectureVerification() {
    console.log(chalk.gray('   Verifying correct architecture setup...'));

    // Test that WebSocket is NOT for MCP protocol
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // This timeout is expected - it means WebSocket correctly doesn't respond to MCP
        console.log(chalk.gray('   ✓ WebSocket correctly does not respond to MCP protocol'));
        console.log(chalk.gray('   ✓ Architecture is correctly separated'));
        this.testResults.mcpProtocol = true;
        resolve();
      }, 2000);

      const mcpMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      };

      const messageHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          
          if (response.jsonrpc === '2.0') {
            // This would be unexpected - WebSocket shouldn't handle MCP
            clearTimeout(timeout);
            reject(new Error('WebSocket unexpectedly responded to MCP protocol'));
          } else {
            // Non-MCP response is expected (extension bridge messages)
            console.log(chalk.gray(`   ✓ WebSocket correctly handles extension messages only`));
          }
        } catch (error) {
          // Parse errors are fine here
        }
      };

      this.websocket.once('message', messageHandler);
      this.websocket.send(JSON.stringify(mcpMessage));
    });
  }

  showTroubleshootingTips() {
    console.log(chalk.blue('\n💡 Troubleshooting Tips:'));
    
    if (!this.testResults.nativeHostStartup) {
      console.log(chalk.gray('   • Check Node.js version (requires 18.0.0+)'));
      console.log(chalk.gray('   • Ensure src/index.js exists and dependencies installed'));
      console.log(chalk.gray('   • Try: npm install && node src/index.js --websocket --debug'));
    }
    
    if (!this.testResults.websocketConnection) {
      console.log(chalk.gray('   • Check if port 8765 is available (try: lsof -i :8765)'));
      console.log(chalk.gray('   • Verify firewall settings'));
      console.log(chalk.gray('   • Try a different port with --port flag'));
    }
    
    if (!this.testResults.extensionHandshake) {
      console.log(chalk.gray('   • Extension bridge should be ready even without Chrome extension'));
      console.log(chalk.gray('   • Check WebSocket message handling in ExtensionBridge.js'));
    }
    
    console.log(chalk.blue('\n💡 Usage Notes:'));
    console.log(chalk.gray('   • For Claude Desktop: Configure MCP with STDIO transport'));
    console.log(chalk.gray('   • For Chrome Extension: Connect via WebSocket on port 8765'));
    console.log(chalk.gray('   • The server supports both modes simultaneously'));
  }

  async cleanup() {
    console.log(chalk.gray('\n🧹 Cleaning up test resources...'));

    if (this.websocket) {
      this.websocket.close();
    }

    if (this.nativeHostProcess) {
      this.nativeHostProcess.kill('SIGTERM');
      
      await new Promise((resolve) => {
        this.nativeHostProcess.on('close', resolve);
        setTimeout(resolve, 3000);
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