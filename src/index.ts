#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Octokit } from '@octokit/rest';

const server = new Server(
  {
    name: 'github-mcp-server',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const GITHUB_PERSONAL_ACCESS_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
if (!GITHUB_PERSONAL_ACCESS_TOKEN) {
  console.error('GITHUB_PERSONAL_ACCESS_TOKEN environment variable is not set');
  process.exit(1);
}

const octokit = new Octokit({
  auth: GITHUB_PERSONAL_ACCESS_TOKEN
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitHub MCP Server running on stdio');
}

runServer().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
