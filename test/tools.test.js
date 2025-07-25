#!/usr/bin/env node

/**
 * Tools Test Script
 * 
 * Tests MCP tool definitions, validation, and execution paths
 */

import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import chalk from 'chalk';
import { MCP_TOOLS, validateToolArgs } from '../src/tools/ToolRegistry.js';

class ToolsTester {
  constructor() {
    this.nativeHostProcess = null;
    this.websocket = null;
    this.testResults = {
      toolRegistry: false,
      toolValidation: false,
      toolsList: false,
      limitedModeTools: false
    };
  }

  async runTests() {
    console.log(chalk.blue.bold('🧪 BrowseAgent MCP Tools Tests\n'));

    const tests = [
      { name: 'Tool Registry Loading', fn: () => this.testToolRegistry() },
      { name: 'Tool Argument Validation', fn: () => this.testToolValidation() },
      { name: 'MCP Tools List', fn: () => this.testMCPToolsList() },
      { name: 'Limited Mode Tools', fn: () => this.testLimitedModeTools() }
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
      console.log(chalk.green.bold('🎉 All tool tests passed!'));
      console.log(chalk.cyan('✅ Your tool definitions are valid and ready\n'));
    } else {
      console.log(chalk.yellow.bold('⚠️  Some tool tests failed'));
      this.showToolIssues();
    }

    await this.cleanup();
    process.exit(failed > 0 ? 1 : 0);
  }

  async testToolRegistry() {
    console.log(chalk.gray('   Checking tool registry structure...'));

    // Test that tool registry exports correctly
    if (!MCP_TOOLS || typeof MCP_TOOLS !== 'object') {
      throw new Error('MCP_TOOLS not exported or invalid');
    }

    const toolCount = Object.keys(MCP_TOOLS).length;
    console.log(chalk.gray(`   ✓ Found ${toolCount} tools in registry`));

    // Test each tool has required properties
    const requiredProps = ['name', 'description', 'inputSchema'];
    let validTools = 0;

    for (const [key, tool] of Object.entries(MCP_TOOLS)) {
      for (const prop of requiredProps) {
        if (!tool[prop]) {
          throw new Error(`Tool ${key} missing required property: ${prop}`);
        }
      }

      // Test schema structure
      if (!tool.inputSchema.type || tool.inputSchema.type !== 'object') {
        throw new Error(`Tool ${key} has invalid input schema type`);
      }

      validTools++;
    }

    console.log(chalk.gray(`   ✓ All ${validTools} tools have valid structure`));
    this.testResults.toolRegistry = true;
  }

  async testToolValidation() {
    console.log(chalk.gray('   Testing tool argument validation...'));

    // Test valid arguments
    const validTests = [
      {
        tool: 'browser_navigate',
        args: { url: 'https://example.com' }
      },
      {
        tool: 'browser_click',
        args: { element: 'Submit button', ref: 'button#submit' }
      },
      {
        tool: 'browser_type',
        args: { element: 'Search box', ref: 'input#search', text: 'hello world' }
      },
      {
        tool: 'browser_wait',
        args: { time: 2.5 }
      }
    ];

    for (const test of validTests) {
      try {
        validateToolArgs(test.tool, test.args);
        console.log(chalk.gray(`   ✓ ${test.tool}: valid args accepted`));
      } catch (error) {
        throw new Error(`Valid args rejected for ${test.tool}: ${error.message}`);
      }
    }

    // Test invalid arguments
    const invalidTests = [
      {
        tool: 'browser_navigate',
        args: {}, // Missing required 'url'
        expectedError: 'Missing required field'
      },
      {
        tool: 'browser_wait',
        args: { time: 'invalid' }, // Wrong type
        expectedError: 'must be a number'
      }
    ];

    for (const test of invalidTests) {
      try {
        validateToolArgs(test.tool, test.args);
        throw new Error(`Invalid args accepted for ${test.tool}`);
      } catch (error) {
        if (error.message.includes(test.expectedError)) {
          console.log(chalk.gray(`   ✓ ${test.tool}: invalid args correctly rejected`));
        } else {
          throw new Error(`Wrong error for ${test.tool}: ${error.message}`);
        }
      }
    }

    this.testResults.toolValidation = true;
  }

  async testMCPToolsList() {
    console.log(chalk.gray('   Testing MCP tools/list endpoint...'));

    // Start the server for this test
    await this.startTestServer();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tools list request timeout'));
      }, 8000);

      const toolsListMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      };

      this.websocket.once('message', (data) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(data.toString());
          
          if (response.id === 2 && response.result && response.result.tools) {
            const tools = response.result.tools;
            console.log(chalk.gray(`   ✓ Received ${tools.length} tools from MCP server`));
            
            // Verify some key tools are present
            const expectedTools = ['browser_navigate', 'browser_click', 'browser_screenshot'];
            for (const expectedTool of expectedTools) {
              const found = tools.find(t => t.name === expectedTool);
              if (!found) {
                throw new Error(`Expected tool not found: ${expectedTool}`);
              }
              console.log(chalk.gray(`   ✓ Found expected tool: ${expectedTool}`));
            }
            
            this.testResults.toolsList = true;
            resolve();
          } else {
            reject(new Error('Invalid tools/list response format'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse tools/list response: ${error.message}`));
        }
      });

      this.websocket.send(JSON.stringify(toolsListMessage));
    });
  }

  async testLimitedModeTools() {
    console.log(chalk.gray('   Testing limited mode tool availability...'));

    // Test that basic tools work without extension
    const limitedModeTools = ['browser_wait'];
    
    for (const toolName of limitedModeTools) {
      if (!MCP_TOOLS[toolName]) {
        throw new Error(`Limited mode tool not found: ${toolName}`);
      }
      console.log(chalk.gray(`   ✓ Limited mode tool available: ${toolName}`));
    }

    // Test that browser tools require extension
    const extensionTools = ['browser_navigate', 'browser_click', 'browser_screenshot'];
    
    for (const toolName of extensionTools) {
      if (!MCP_TOOLS[toolName]) {
        throw new Error(`Extension tool not found: ${toolName}`);
      }
      console.log(chalk.gray(`   ✓ Extension tool defined: ${toolName}`));
    }

    this.testResults.limitedModeTools = true;
  }

  async startTestServer() {
    if (this.nativeHostProcess) return; // Already started

    console.log(chalk.gray('   Starting test server...'));

    return new Promise((resolve, reject) => {
      this.nativeHostProcess = spawn('node', ['src/index.js', '--websocket', '--debug'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let output = '';
      this.nativeHostProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      this.nativeHostProcess.on('error', reject);

      // Wait for startup
      setTimeout(() => {
        if (output.includes('started') || output.includes('ready')) {
          // Connect WebSocket
          this.websocket = new WebSocket('ws://localhost:8765');
          this.websocket.on('open', () => {
            console.log(chalk.gray('   ✓ Test server started and connected'));
            resolve();
          });
          this.websocket.on('error', reject);
        } else {
          reject(new Error('Test server failed to start'));
        }
      }, 4000);
    });
  }

  showToolIssues() {
    console.log(chalk.blue('\n💡 Tool Issues:'));
    
    if (!this.testResults.toolRegistry) {
      console.log(chalk.gray('   • Check src/tools/ToolRegistry.js exists and exports correctly'));
      console.log(chalk.gray('   • Verify all tools have name, description, and inputSchema'));
    }
    
    if (!this.testResults.toolValidation) {
      console.log(chalk.gray('   • Review tool argument validation logic'));
      console.log(chalk.gray('   • Check required fields and type validation'));
    }
    
    if (!this.testResults.toolsList) {
      console.log(chalk.gray('   • Verify MCP server tools/list endpoint'));
      console.log(chalk.gray('   • Check that server starts correctly'));
    }
    
    console.log(chalk.gray('\n   Run individual tool tests for more details'));
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
        setTimeout(resolve, 2000);
      });
    }

    console.log(chalk.gray('✅ Cleanup completed'));
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new ToolsTester();
  tester.runTests().catch((error) => {
    console.error(chalk.red('Fatal test error:'), error);
    process.exit(1);
  });
}

export { ToolsTester };