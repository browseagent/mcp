#!/usr/bin/env node

/**
 * Manual MCP Connection Test
 * Tests your local MCP server exactly like Claude Desktop would
 */

import { spawn } from 'child_process';
import chalk from 'chalk';

async function testLocalMCP() {
  console.log(chalk.blue.bold('🧪 Testing Local MCP Server\n'));

  // Start your MCP server in STDIO mode (same as Claude Desktop)
  const mcpProcess = spawn('node', ['src/index.js', '--debug'], {
    stdio: 'pipe',
    cwd: process.cwd()
  });

  console.log(chalk.gray('📡 Starting MCP server...'));

  // Send initialize message
  const initMessage = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'manual-test',
        version: '1.0.0'
      }
    }
  };

  // Send tools/list message
  const toolsMessage = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  };

  let responseCount = 0;

  mcpProcess.stdout.on('data', (data) => {
    let offset = 0;
    while (offset < data.length) {
      if (data.length - offset < 4) break;
      
      const messageLength = data.readUInt32LE(offset);
      if (data.length - offset < 4 + messageLength) break;
      
      const messageData = data.slice(offset + 4, offset + 4 + messageLength);
      
      try {
        const response = JSON.parse(messageData.toString('utf8'));
        console.log(chalk.green(`📥 Received response ${++responseCount}:`));
        console.log(chalk.gray(JSON.stringify(response, null, 2)));
        
        if (response.id === 1 && response.result) {
          console.log(chalk.cyan('\n✅ Initialize successful! Requesting tools list...'));
          sendMessage(mcpProcess.stdin, toolsMessage);
        } else if (response.id === 2 && response.result?.tools) {
          console.log(chalk.cyan(`\n✅ Tools list received! Found ${response.result.tools.length} tools:`));
          response.result.tools.forEach(tool => {
            console.log(chalk.gray(`   • ${tool.name}: ${tool.description}`));
          });
          
          console.log(chalk.green.bold('\n🎉 Local MCP server is working correctly!'));
          console.log(chalk.gray('You can now use this configuration in Claude Desktop.'));
          
          mcpProcess.kill('SIGTERM');
          process.exit(0);
        }
      } catch (error) {
        console.log(chalk.red(`❌ Parse error: ${error.message}`));
      }
      
      offset += 4 + messageLength;
    }
  });

  mcpProcess.stderr.on('data', (data) => {
    console.log(chalk.yellow('🔍 Server log:'), data.toString().trim());
  });

  mcpProcess.on('error', (error) => {
    console.log(chalk.red(`❌ Process error: ${error.message}`));
    process.exit(1);
  });

  mcpProcess.on('exit', (code) => {
    if (code !== 0) {
      console.log(chalk.red(`❌ Process exited with code ${code}`));
      process.exit(1);
    }
  });

  // Wait a moment then send init message
  setTimeout(() => {
    console.log(chalk.gray('📤 Sending initialize message...'));
    sendMessage(mcpProcess.stdin, initMessage);
  }, 1000);

  // Timeout after 10 seconds
  setTimeout(() => {
    console.log(chalk.red('❌ Test timeout'));
    mcpProcess.kill('SIGTERM');
    process.exit(1);
  }, 10000);
}

function sendMessage(stdin, message) {
  const messageStr = JSON.stringify(message);
  const messageBuffer = Buffer.from(messageStr, 'utf8');
  const lengthBuffer = Buffer.allocUnsafe(4);
  lengthBuffer.writeUInt32LE(messageBuffer.length, 0);
  
  stdin.write(lengthBuffer);
  stdin.write(messageBuffer);
}

testLocalMCP().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});