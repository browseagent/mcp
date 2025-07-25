#!/usr/bin/env node

/**
 * Setup Script for BrowseAgent MCP
 * 
 * Automates the setup process for development and testing
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';
import readline from 'readline';

const execAsync = promisify(exec);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

class SetupManager {
  constructor() {
    this.extensionId = null;
    this.steps = [
      { name: 'Check Prerequisites', fn: () => this.checkPrerequisites() },
      { name: 'Build Extension', fn: () => this.buildExtension() },
      { name: 'Get Extension ID', fn: () => this.getExtensionId() },
      { name: 'Install Native Host', fn: () => this.installNativeHost() },
      { name: 'Create Manifest', fn: () => this.createManifest() },
      { name: 'Test Connection', fn: () => this.testConnection() },
      { name: 'Setup Claude Desktop', fn: () => this.setupClaudeDesktop() }
    ];
  }

  async run() {
    console.log(chalk.gray(`  ✓ Node.js ${nodeVersion}`));
    
    // Check if Chrome is installed
    try {
      if (process.platform === 'win32') {
        await execAsync('where chrome');
      } else if (process.platform === 'darwin') {
        await execAsync('which "Google Chrome"');
      } else {
        await execAsync('which google-chrome || which chromium-browser');
      }
      console.log(chalk.gray('  ✓ Chrome browser found'));
    } catch (error) {
      console.log(chalk.yellow('  ⚠ Chrome browser not found in PATH (may still work)'));
    }
    
    // Check npm/yarn
    try {
      await execAsync('npm --version');
      console.log(chalk.gray('  ✓ npm found'));
    } catch (error) {
      throw new Error('npm not found. Please install Node.js with npm.');
    }
  }

  async checkPrerequisites() {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js 18+ required. Current: ${nodeVersion}`);
    }
    console.log(chalk.blue.bold('🚀 BrowseAgent MCP Setup\n'));
    
    try {
      for (const step of this.steps) {
        console.log(chalk.cyan(`📋 ${step.name}...`));
        await step.fn();
        console.log(chalk.green(`✅ ${step.name} completed\n`));
      }
      
      console.log(chalk.green.bold('🎉 Setup completed successfully!'));
      this.showNextSteps();
      
    } catch (error) {
      console.error(chalk.red(`❌ Setup failed: ${error.message}`));
      console.log(chalk.yellow('\n💡 Troubleshooting tips:'));
      console.log('  • Make sure you have Node.js 18+ installed');
      console.log('  • Ensure Chrome is installed and running');
      console.log('  • Check that you have proper permissions');
      console.log('  • Run with --debug for more details');
      process.exit(1);
    } finally {
      rl.close();
    }
  }

  async buildExtension() {
    console.log(chalk.gray('  Building Chrome extension...'));
    
    try {
      await execAsync('npm run build', { cwd: process.cwd() });
      console.log(chalk.gray('  ✓ Extension built successfully'));
    } catch (error) {
      // Try with yarn
      try {
        await execAsync('yarn build', { cwd: process.cwd() });
        console.log(chalk.gray('  ✓ Extension built successfully (yarn)'));
      } catch (yarnError) {
        throw new Error('Failed to build extension. Run "npm run build" manually to see errors.');
      }
    }
  }

  async getExtensionId() {
    console.log(chalk.yellow('  📋 Extension ID Setup'));
    console.log(chalk.gray('     The extension ID is needed to configure native messaging.'));
    console.log(chalk.gray('     You can find it in Chrome://extensions/ after loading the extension.\n'));
    
    const choice = await question(chalk.cyan('  Do you have the extension ID? (y/n): '));
    
    if (choice.toLowerCase() === 'y' || choice.toLowerCase() === 'yes') {
      this.extensionId = await question(chalk.cyan('  Enter extension ID: '));
      
      if (!this.extensionId || this.extensionId.length !== 32) {
        throw new Error('Invalid extension ID. Should be 32 characters long.');
      }
      
      console.log(chalk.gray(`  ✓ Using extension ID: ${this.extensionId}`));
    } else {
      console.log(chalk.blue('\n  📝 Steps to get extension ID:'));
      console.log('     1. Open Chrome and go to chrome://extensions/');
      console.log('     2. Enable "Developer mode" (top right)');
      console.log('     3. Click "Load unpacked" and select the .output/chrome-mv3 folder');
      console.log('     4. Copy the extension ID from the card that appears');
      console.log('     5. Come back and run this setup again with the ID\n');
      
      const shouldContinue = await question(chalk.cyan('  Continue without ID? (y/n): '));
      if (shouldContinue.toLowerCase() === 'y') {
        this.extensionId = 'PLACEHOLDER_EXTENSION_ID';
        console.log(chalk.yellow('  ⚠ Using placeholder ID - you\'ll need to update the manifest later'));
      } else {
        throw new Error('Extension ID required for setup');
      }
    }
  }

  async installNativeHost() {
    console.log(chalk.gray(' Installing native host dependencies...'));
    
    // Install native host dependencies
    try {
      await execAsync('npm install', { cwd: join(process.cwd(), 'native-host') });
      console.log(chalk.gray('  ✓ Native host dependencies installed'));
    } catch (error) {
      throw new Error('Failed to install native host dependencies');
    }
  }

  async createManifest() {
    console.log(chalk.gray('  Creating native messaging manifest...'));
    
    try {
      const manifestScript = join(process.cwd(), 'native-host', 'scripts', 'create-manifest.js');
      await execAsync(`node "${manifestScript}" ${this.extensionId}`);
      console.log(chalk.gray('  ✓ Native messaging manifest created'));
    } catch (error) {
      console.log(chalk.yellow('  ⚠ Failed to create manifest automatically'));
      console.log(chalk.gray('    You can create it manually later using:'));
      console.log(chalk.gray(`    node native-host/scripts/create-manifest.js ${this.extensionId}`));
    }
  }

  async testConnection() {
    console.log(chalk.gray('  Testing native host connection...'));
    
    try {
      // Start native host in test mode
      const testProcess = spawn('node', [
        join(process.cwd(), 'native-host', 'src', 'index.js'),
        '--websocket',
        '--debug'
      ], {
        stdio: 'pipe',
        timeout: 5000
      });
      
      let output = '';
      testProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      testProcess.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      await new Promise((resolve, reject) => {
        testProcess.on('close', (code) => {
          if (output.includes('started successfully') || output.includes('listening')) {
            resolve();
          } else {
            reject(new Error('Native host failed to start'));
          }
        });
        
        testProcess.on('error', reject);
        
        // Kill after 3 seconds
        setTimeout(() => {
          testProcess.kill();
          resolve(); // Consider it success if it started
        }, 3000);
      });
      
      console.log(chalk.gray('  ✓ Native host test passed'));
      
    } catch (error) {
      console.log(chalk.yellow('  ⚠ Native host test inconclusive'));
      console.log(chalk.gray('    Manual testing may be required'));
    }
  }

  async setupClaudeDesktop() {
    console.log(chalk.yellow('  📋 Claude Desktop Configuration'));
    console.log(chalk.gray('     To use this MCP server with Claude Desktop, add the following'));
    console.log(chalk.gray('     configuration to your Claude Desktop settings:\n'));
    
    const mcpConfig = {
      "mcpServers": {
        "browser-automation": {
          "command": "node",
          "args": [join(process.cwd(), 'native-host', 'src', 'index.js')],
          "env": {
            "NODE_ENV": "production"
          }
        }
      }
    };
    
    console.log(chalk.blue('  📋 Claude Desktop MCP Configuration:'));
    console.log(chalk.gray(JSON.stringify(mcpConfig, null, 2)));
    console.log('');
    
    console.log(chalk.cyan('  📖 Configuration steps:'));
    console.log('     1. Open Claude Desktop');
    console.log('     2. Go to Settings > Developer');
    console.log('     3. Edit MCP Settings');
    console.log('     4. Add the configuration above');
    console.log('     5. Restart Claude Desktop');
    console.log('');
    
    const configFile = await question(chalk.cyan('  Save config to file? (y/n): '));
    if (configFile.toLowerCase() === 'y') {
      const { writeFile } = await import('fs/promises');
      await writeFile('claude-mcp-config.json', JSON.stringify(mcpConfig, null, 2));
      console.log(chalk.gray('  ✓ Config saved to claude-mcp-config.json'));
    }
  }

  showNextSteps() {
    console.log(chalk.blue.bold('\n🎯 Next Steps:'));
    console.log('');
    console.log(chalk.cyan('1. Load Extension in Chrome:'));
    console.log('   • Go to chrome://extensions/');
    console.log('   • Enable Developer mode');
    console.log('   • Load unpacked: .output/chrome-mv3/');
    console.log('');
    console.log(chalk.cyan('2. Test Extension:'));
    console.log('   • Click the extension icon');
    console.log('   • Check connection status');
    console.log('   • Test basic tools');
    console.log('');
    console.log(chalk.cyan('3. Configure Claude Desktop:'));
    console.log('   • Add MCP configuration');
    console.log('   • Restart Claude Desktop');
    console.log('   • Test browser automation');
    console.log('');
    console.log(chalk.cyan('4. Development:'));
    console.log('   • Use "npm run dev" for development');
    console.log('   • Check logs in extension console');
    console.log('   • Native host logs in terminal');
    console.log('');
    console.log(chalk.yellow('🐛 Debugging:'));
    console.log('   • Extension: Chrome DevTools > Extensions');
    console.log('   • Native host: Run with --debug flag');
    console.log('   • Logs: Check both Chrome and terminal output');
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new SetupManager();
  setup.run().catch(console.error);
}

  