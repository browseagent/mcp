#!/usr/bin/env node

/**
 * Create Native Host Manifest
 * 
 * Creates the manifest file for Chrome native messaging
 */

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get the absolute path to the native host executable
const hostPath = resolve(join(__dirname, '..', 'src', 'index.js'));

function getManifestDirectory() {
  const homeDir = homedir();
  
  switch (process.platform) {
    case 'win32':
      return join(homeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts');
    case 'darwin':
      return join(homeDir, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
    case 'linux':
      return join(homeDir, '.config', 'google-chrome', 'NativeMessagingHosts');
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

function createManifest(extensionId) {
  return {
    "name": "com.browseagent.mcp",
    "description": "BrowseAgent MCP Native Host",
    "path": hostPath,
    "type": "stdio",
    "allowed_origins": [
      `chrome-extension://${extensionId}/`
    ]
  };
}

async function main() {
  try {
    const extensionId = process.argv[2];
    
    if (!extensionId) {
      console.error(chalk.red('❌ Extension ID required'));
      console.log(chalk.blue('Usage: node scripts/create-manifest.js <extension-id>'));
      console.log(chalk.gray('Example: node scripts/create-manifest.js abcdefghijklmnopqrstuvwxyz123456'));
      process.exit(1);
    }

    console.log(chalk.blue('📝 Creating native host manifest...'));
    console.log(chalk.gray(`Extension ID: ${extensionId}`));
    console.log(chalk.gray(`Host path: ${hostPath}`));
    console.log(chalk.gray(`Platform: ${process.platform}`));

    // Create manifest
    const manifest = createManifest(extensionId);
    
    // Get manifest directory
    const manifestDir = getManifestDirectory();
    const manifestPath = join(manifestDir, 'com.browseagent.mcp.json');
    
    console.log(chalk.gray(`Manifest directory: ${manifestDir}`));

    // Create directory if it doesn't exist
    await mkdir(manifestDir, { recursive: true });
    console.log(chalk.green('✅ Created manifest directory'));

    // Write manifest file
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(chalk.green('✅ Created manifest file'));

    console.log(chalk.blue('\n📋 Manifest created successfully!'));
    console.log(chalk.gray(`Location: ${manifestPath}`));
    
    console.log(chalk.cyan('\n🔧 Next steps:'));
    console.log('  1. Install and enable the Chrome extension');
    console.log('  2. Test the connection using the extension popup');
    console.log('  3. Configure Claude Desktop to use this MCP server');

    console.log(chalk.yellow('\n⚠️  Important:'));
    console.log('  • Make sure the host path points to the correct location');
    console.log('  • The extension ID must match exactly');
    console.log('  • Node.js must be in your system PATH');

  } catch (error) {
    console.error(chalk.red('❌ Failed to create manifest:'));
    console.error(chalk.red(error.message));
    
    if (error.code === 'EACCES') {
      console.log(chalk.yellow('\n💡 Try running with elevated permissions:'));
      if (process.platform === 'win32') {
        console.log('  Run Command Prompt as Administrator');
      } else {
        console.log('  Use sudo: sudo node scripts/create-manifest.js <extension-id>');
      }
    }
    
    process.exit(1);
  }
}

main();