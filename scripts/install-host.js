#!/usr/bin/env node

/**
 * Native Host Installation Script
 * 
 * Installs the native messaging host manifest and sets up the native host
 * for communication with Chrome and Claude Desktop.
 */

import { readFile, writeFile, mkdir, chmod, access } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class NativeHostInstaller {
  constructor() {
    this.platform = process.platform;
    this.extensionId = null; // Will be provided during installation
    this.hostPath = resolve(join(__dirname, '..', 'src', 'index.js'));
    this.manifestTemplate = this.getManifestTemplate();
  }

  async install(options = {}) {
    try {
      console.log(chalk.blue('🚀 Installing BrowseAgent Native Host...\n'));

      // Get extension ID
      this.extensionId = options.extensionId || await this.promptForExtensionId();
      
      // Validate requirements
      await this.validateRequirements();
      
      // Create native host manifest
      const manifestPath = await this.createManifest();
      
      // Make host executable
      await this.makeExecutable();
      
      // Create configuration directory
      await this.createConfigDirectory();
      
      // Test installation
      await this.testInstallation();
      
      console.log(chalk.green('\n✅ Installation completed successfully!\n'));
      console.log(chalk.cyan('Next steps:'));
      console.log('  1. Install and enable the BrowseAgent Chrome extension');
      console.log('  2. Configure MCP client to use this BrowseAgent MCP server');
      console.log(chalk.gray(`\nManifest installed at: ${manifestPath}`));
      console.log(chalk.gray(`Host executable: ${this.hostPath}`));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Installation failed:'));
      console.error(chalk.red(error.message));
      
      if (options.debug) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }
      
      process.exit(1);
    }
  }

  async validateRequirements() {
    console.log(chalk.blue('🔍 Validating requirements...'));
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    
    if (majorVersion < 18) {
      throw new Error(`Node.js 18.0.0 or higher required. Current version: ${nodeVersion}`);
    }
    
    console.log(chalk.green(`  ✓ Node.js version: ${nodeVersion}`));
    
    // Check if host file exists
    try {
      await access(this.hostPath);
      console.log(chalk.green(`  ✓ Native host file exists`));
    } catch (error) {
      throw new Error(`Native host file not found: ${this.hostPath}`);
    }
    
    // Check platform support
    const supportedPlatforms = ['win32', 'darwin', 'linux'];
    if (!supportedPlatforms.includes(this.platform)) {
      throw new Error(`Unsupported platform: ${this.platform}`);
    }
    
    console.log(chalk.green(`  ✓ Platform supported: ${this.platform}`));
    
    // Check permissions
    if (this.platform !== 'win32') {
      try {
        await chmod(this.hostPath, 0o755);
        console.log(chalk.green(`  ✓ File permissions set`));
      } catch (error) {
        console.warn(chalk.yellow(`  ⚠ Could not set execute permissions: ${error.message}`));
      }
    }
  }

  async createManifest() {
    console.log(chalk.blue('📝 Creating native host manifest...'));
    
    const manifestDir = this.getManifestDirectory();
    const manifestPath = join(manifestDir, 'com.browseagent.mcp.json');
    
    // Create manifest directory
    await mkdir(manifestDir, { recursive: true });
    console.log(chalk.green(`  ✓ Created directory: ${manifestDir}`));
    
    // Generate manifest content
    const manifest = {
      ...this.manifestTemplate,
      path: this.hostPath,
      allowed_origins: [
        `chrome-extension://${this.extensionId}/`
      ]
    };
    
    // Write manifest file
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(chalk.green(`  ✓ Created manifest: ${manifestPath}`));
    
    return manifestPath;
  }

  async makeExecutable() {
    if (this.platform === 'win32') {
      return; // Windows doesn't use execute permissions
    }
    
    console.log(chalk.blue('🔧 Setting executable permissions...'));
    
    try {
      await chmod(this.hostPath, 0o755);
      console.log(chalk.green(`  ✓ Made executable: ${this.hostPath}`));
    } catch (error) {
      throw new Error(`Failed to set execute permissions: ${error.message}`);
    }
  }

  async createConfigDirectory() {
    console.log(chalk.blue('📁 Creating configuration directory...'));
    
    const configDir = this.getConfigDirectory();
    await mkdir(configDir, { recursive: true });
    
    console.log(chalk.green(`  ✓ Created config directory: ${configDir}`));
    
    // Create default config file if it doesn't exist
    const configFile = join(configDir, 'config.json');
    
    try {
      await access(configFile);
      console.log(chalk.green(`  ✓ Config file exists: ${configFile}`));
    } catch (error) {
      // Create default config
      const defaultConfig = {
        debug: false,
        logLevel: 'info',
        port: 8765,
        enableCursor: true,
        version: '1.0.0',
        installedAt: new Date().toISOString(),
        extensionId: this.extensionId
      };
      
      await writeFile(configFile, JSON.stringify(defaultConfig, null, 2), 'utf8');
      console.log(chalk.green(`  ✓ Created default config: ${configFile}`));
    }
  }

  async testInstallation() {
    console.log(chalk.blue('🧪 Testing installation...'));
    
    // Test that the host can be executed
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', [this.hostPath, '--help'], {
        stdio: 'pipe',
        timeout: 5000
      });
      
      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 || output.includes('browser-mcp-host')) {
          console.log(chalk.green('  ✓ Host executable test passed'));
          resolve();
        } else {
          reject(new Error(`Host execution test failed with code ${code}\nOutput: ${output}`));
        }
      });
      
      child.on('error', (error) => {
        reject(new Error(`Host execution test failed: ${error.message}`));
      });
    });
  }

  getManifestDirectory() {
    const homeDir = homedir();
    
    switch (this.platform) {
      case 'win32':
        return join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts');
      case 'darwin':
        return join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
      case 'linux':
        return join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts');
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  getConfigDirectory() {
    const homeDir = homedir();
    
    switch (this.platform) {
      case 'win32':
        return join(homeDir, 'AppData', 'Local', 'BrowserMCP');
      case 'darwin':
        return join(homeDir, 'Library', 'Application Support', 'BrowserMCP');
      case 'linux':
        return join(homeDir, '.config', 'browser-mcp');
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  getManifestTemplate() {
    return {
      name: "com.browseagent.mcp",
      description: "Browser MCP Server Native Host",
      type: "stdio",
      allowed_origins: []
    };
  }

  async promptForExtensionId() {
    // For now, return a placeholder
    // In a real implementation, this would prompt the user or read from package.json
    console.log(chalk.yellow('⚠️  Extension ID not provided. Using placeholder.'));
    console.log(chalk.gray('You will need to update the manifest with the actual extension ID after installing the Chrome extension.'));
    
    return 'EXTENSION_ID_PLACEHOLDER';
  }

  async uninstall() {
    try {
      console.log(chalk.blue('🗑️  Uninstalling Browser MCP Native Host...\n'));
      
      const manifestDir = this.getManifestDirectory();
      const manifestPath = join(manifestDir, 'com.browseagent.mcp.json');
      
      // Remove manifest file
      try {
        const { unlink } = await import('fs/promises');
        await unlink(manifestPath);
        console.log(chalk.green(`  ✓ Removed manifest: ${manifestPath}`));
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(chalk.yellow(`  ⚠ Could not remove manifest: ${error.message}`));
        }
      }
      
      console.log(chalk.green('\n✅ Uninstallation completed!'));
      console.log(chalk.gray('Note: Configuration files were preserved.'));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Uninstallation failed:'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  }

  async getInstallationInfo() {
    const manifestDir = this.getManifestDirectory();
    const manifestPath = join(manifestDir, 'com.browseagent.mcp.json');
    const configDir = this.getConfigDirectory();
    
    try {
      await access(manifestPath);
      const manifestContent = await readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);
      
      return {
        installed: true,
        manifestPath,
        configDir,
        hostPath: this.hostPath,
        extensionId: manifest.allowed_origins[0]?.replace('chrome-extension://', '').replace('/', ''),
        platform: this.platform
      };
    } catch (error) {
      return {
        installed: false,
        manifestPath,
        configDir,
        hostPath: this.hostPath,
        platform: this.platform
      };
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const installer = new NativeHostInstaller();
  
  switch (command) {
    case 'install':
      await installer.install({
        extensionId: args[1],
        debug: args.includes('--debug')
      });
      break;
      
    case 'uninstall':
      await installer.uninstall();
      break;
      
    case 'info':
      const info = await installer.getInstallationInfo();
      console.log(chalk.blue('📋 Installation Information:\n'));
      console.log(`Installed: ${info.installed ? chalk.green('Yes') : chalk.red('No')}`);
      console.log(`Platform: ${chalk.cyan(info.platform)}`);
      console.log(`Host Path: ${chalk.gray(info.hostPath)}`);
      console.log(`Manifest Path: ${chalk.gray(info.manifestPath)}`);
      console.log(`Config Directory: ${chalk.gray(info.configDir)}`);
      if (info.extensionId) {
        console.log(`Extension ID: ${chalk.cyan(info.extensionId)}`);
      }
      break;
      
    default:
      console.log(chalk.blue('Browser MCP Native Host Installer\n'));
      console.log('Usage:');
      console.log('  node install-host.js install [extension-id] [--debug]');
      console.log('  node install-host.js uninstall');
      console.log('  node install-host.js info');
      console.log('\nExamples:');
      console.log('  node install-host.js install abcdefghijklmnopqrstuvwxyz123456');
      console.log('  node install-host.js info');
      break;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error.message);
    process.exit(1);
  });
}

export { NativeHostInstaller };