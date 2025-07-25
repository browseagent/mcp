#!/usr/bin/env node

/**
 * Tools Test Script
 * 
 * Tests MCP tool definitions, validation, and execution paths
 * Focuses on tool registry validation rather than STDIO MCP testing
 */

import { spawn } from 'child_process';
import chalk from 'chalk';
import { MCP_TOOLS, validateToolArgs } from '../src/tools/ToolRegistry.js';

class ToolsTester {
  constructor() {
    this.testResults = {
      toolRegistry: false,
      toolValidation: false,
      toolSchemas: false,
      toolCategories: false
    };
  }

  async runTests() {
    console.log(chalk.blue.bold('🧪 BrowseAgent MCP Tools Tests\n'));

    const tests = [
      { name: 'Tool Registry Loading', fn: () => this.testToolRegistry() },
      { name: 'Tool Argument Validation', fn: () => this.testToolValidation() },
      { name: 'Tool Schema Validation', fn: () => this.testToolSchemas() },
      { name: 'Tool Categories & Metadata', fn: () => this.testToolCategories() }
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
      
      // Show tool summary
      this.showToolSummary();
    } else {
      console.log(chalk.yellow.bold('⚠️  Some tool tests failed'));
      this.showToolIssues();
    }

    console.log(chalk.blue.bold('\n📋 Integration Notes:'));
    console.log(chalk.gray('   • Tools are properly defined and validated'));
    console.log(chalk.gray('   • MCP server will expose these tools to clients'));
    console.log(chalk.gray('   • Extension bridge will execute browser automation tools'));
    console.log(chalk.gray('   • Limited mode tools work without Chrome extension'));

    process.exit(failed > 0 ? 1 : 0);
  }

  async testToolRegistry() {
    console.log(chalk.gray('   Checking tool registry structure...'));

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

      // Test that name matches key
      if (tool.name !== key) {
        throw new Error(`Tool ${key} has mismatched name property: ${tool.name}`);
      }

      validTools++;
    }

    console.log(chalk.gray(`   ✓ All ${validTools} tools have valid structure`));
    console.log(chalk.gray(`   ✓ Tool names match registry keys`));
    
    this.testResults.toolRegistry = true;
  }

  async testToolValidation() {
    console.log(chalk.gray('   Testing tool argument validation...'));

    // Test valid arguments
    const validTests = [
      {
        tool: 'browser_navigate',
        args: { url: 'https://example.com' },
        description: 'Basic navigation'
      },
      {
        tool: 'browser_navigate', 
        args: { url: 'https://example.com', tabId: 123 },
        description: 'Navigation with tab ID'
      },
      {
        tool: 'browser_click',
        args: { element: 'Submit button', ref: 'button#submit' },
        description: 'Basic click'
      },
      {
        tool: 'browser_type',
        args: { element: 'Search box', ref: 'input#search', text: 'hello world' },
        description: 'Type without submit'
      },
      {
        tool: 'browser_type',
        args: { element: 'Search box', ref: 'input#search', text: 'hello', submit: true },
        description: 'Type with submit'
      },
      {
        tool: 'browser_wait',
        args: { time: 2.5 },
        description: 'Wait with decimal seconds'
      },
      {
        tool: 'browser_wait',
        args: { time: 0.1 },
        description: 'Minimum wait time'
      },
      {
        tool: 'browser_screenshot',
        args: {},
        description: 'Screenshot with no args'
      },
      {
        tool: 'browser_screenshot',
        args: { fullPage: true, element: 'Main div', ref: 'div#main' },
        description: 'Full page screenshot with element'
      }
    ];

    for (const test of validTests) {
      try {
        validateToolArgs(test.tool, test.args);
        console.log(chalk.gray(`   ✓ ${test.tool}: ${test.description}`));
      } catch (error) {
        throw new Error(`Valid args rejected for ${test.tool} (${test.description}): ${error.message}`);
      }
    }

    // Test invalid arguments
    const invalidTests = [
      {
        tool: 'browser_navigate',
        args: {},
        expectedError: 'Missing required field: url',
        description: 'Missing required URL'
      },
      {
        tool: 'browser_click',
        args: { element: 'Button' },
        expectedError: 'Missing required field: ref',
        description: 'Missing required ref'
      },
      {
        tool: 'browser_wait',
        args: { time: 'invalid' },
        expectedError: 'must be a number',
        description: 'Invalid time type'
      },
      {
        tool: 'browser_wait',
        args: { time: -1 },
        expectedError: 'must be >= 0.1',
        description: 'Time below minimum'
      },
      {
        tool: 'browser_wait',
        args: { time: 31 },
        expectedError: 'must be <= 30',
        description: 'Time above maximum'
      }
    ];

    for (const test of invalidTests) {
      try {
        validateToolArgs(test.tool, test.args);
        throw new Error(`Invalid args accepted for ${test.tool} (${test.description})`);
      } catch (error) {
        if (error.message.includes(test.expectedError)) {
          console.log(chalk.gray(`   ✓ ${test.tool}: ${test.description} correctly rejected`));
        } else {
          throw new Error(`Wrong error for ${test.tool} (${test.description}). Expected: ${test.expectedError}, Got: ${error.message}`);
        }
      }
    }

    this.testResults.toolValidation = true;
  }

  async testToolSchemas() {
    console.log(chalk.gray('   Testing tool schema completeness...'));

    for (const [toolName, tool] of Object.entries(MCP_TOOLS)) {
      const schema = tool.inputSchema;
      
      // Check schema has properties
      if (!schema.properties) {
        throw new Error(`Tool ${toolName} schema missing properties`);
      }

      // Check required fields exist in properties
      if (schema.required) {
        for (const requiredField of schema.required) {
          if (!schema.properties[requiredField]) {
            throw new Error(`Tool ${toolName} required field '${requiredField}' not in properties`);
          }
        }
      }

      // Check property types are valid
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propSchema.type && !['string', 'number', 'boolean', 'array', 'object'].includes(propSchema.type)) {
          throw new Error(`Tool ${toolName} property '${propName}' has invalid type: ${propSchema.type}`);
        }
      }

      console.log(chalk.gray(`   ✓ ${toolName}: schema is complete`));
    }

    this.testResults.toolSchemas = true;
  }

  async testToolCategories() {
    console.log(chalk.gray('   Testing tool categorization...'));

    const expectedCategories = {
      navigation: ['browser_navigate', 'browser_go_back', 'browser_go_forward'],
      interaction: ['browser_click', 'browser_hover', 'browser_type', 'browser_drag_drop'],
      utility: ['browser_wait', 'browser_press_key'],
      inspection: ['browser_snapshot', 'browser_screenshot', 'browser_get_console_logs']
    };

    let totalExpected = 0;
    for (const tools of Object.values(expectedCategories)) {
      totalExpected += tools.length;
    }

    const actualToolCount = Object.keys(MCP_TOOLS).length;
    console.log(chalk.gray(`   ✓ Expected ${totalExpected} tools, found ${actualToolCount}`));

    // Test each category
    for (const [category, expectedTools] of Object.entries(expectedCategories)) {
      for (const toolName of expectedTools) {
        if (!MCP_TOOLS[toolName]) {
          throw new Error(`Expected ${category} tool not found: ${toolName}`);
        }
      }
      console.log(chalk.gray(`   ✓ ${category}: ${expectedTools.length} tools present`));
    }

    // Test for unexpected tools
    const allExpectedTools = Object.values(expectedCategories).flat();
    const actualTools = Object.keys(MCP_TOOLS);
    const unexpectedTools = actualTools.filter(tool => !allExpectedTools.includes(tool));
    
    if (unexpectedTools.length > 0) {
      console.log(chalk.yellow(`   ⚠ Unexpected tools found: ${unexpectedTools.join(', ')}`));
      console.log(chalk.gray('   (This is not necessarily an error - new tools may have been added)'));
    }

    this.testResults.toolCategories = true;
  }

  showToolSummary() {
    console.log(chalk.blue.bold('🛠️  Tool Summary:'));
    
    const categories = {
      navigation: ['browser_navigate', 'browser_go_back', 'browser_go_forward'],
      interaction: ['browser_click', 'browser_hover', 'browser_type', 'browser_drag_drop'],
      utility: ['browser_wait', 'browser_press_key'],
      inspection: ['browser_snapshot', 'browser_screenshot', 'browser_get_console_logs']
    };

    for (const [category, tools] of Object.entries(categories)) {
      console.log(chalk.cyan(`\n📁 ${category.toUpperCase()}:`));
      for (const toolName of tools) {
        const tool = MCP_TOOLS[toolName];
        if (tool) {
          console.log(chalk.gray(`   • ${toolName}: ${tool.description}`));
        }
      }
    }

    console.log(chalk.green(`\n✅ Total: ${Object.keys(MCP_TOOLS).length} tools ready for use`));
  }

  showToolIssues() {
    console.log(chalk.blue('\n💡 Tool Issues:'));
    
    if (!this.testResults.toolRegistry) {
      console.log(chalk.gray('   • Check src/tools/ToolRegistry.js exists and exports correctly'));
      console.log(chalk.gray('   • Verify all tools have name, description, and inputSchema'));
      console.log(chalk.gray('   • Ensure tool names match their registry keys'));
    }
    
    if (!this.testResults.toolValidation) {
      console.log(chalk.gray('   • Review tool argument validation logic'));
      console.log(chalk.gray('   • Check required fields and type validation'));
      console.log(chalk.gray('   • Verify constraint validation (min/max values)'));
    }
    
    if (!this.testResults.toolSchemas) {
      console.log(chalk.gray('   • Check that all tool schemas are complete'));
      console.log(chalk.gray('   • Verify required fields exist in properties'));
      console.log(chalk.gray('   • Ensure property types are valid'));
    }

    if (!this.testResults.toolCategories) {
      console.log(chalk.gray('   • Check that expected tools are present'));
      console.log(chalk.gray('   • Verify tool categorization is correct'));
    }
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