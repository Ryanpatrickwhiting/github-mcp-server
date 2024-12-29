#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Octokit } from '@octokit/rest';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const CreateRepositorySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  private: z.boolean().optional(),
  autoInit: z.boolean().optional()
});

const CreateIssueSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  title: z.string(),
  body: z.string().optional(),
  assignees: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional()
});

const CreateOrUpdateFileSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  path: z.string(),
  content: z.string(),
  message: z.string(),
  branch: z.string().optional(),
  sha: z.string().optional()
});

const GetFileContentsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  path: z.string(),
  branch: z.string().optional()
});

const CreatePullRequestSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  title: z.string(),
  head: z.string(),
  base: z.string(),
  body: z.string().optional(),
  draft: z.boolean().optional()
});

const ForkRepositorySchema = z.object({
  owner: z.string(),
  repo: z.string(),
  organization: z.string().optional()
});

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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_repository',
        description: 'Create a new GitHub repository in your account',
        inputSchema: CreateRepositorySchema
      },
      {
        name: 'create_issue',
        description: 'Create a new issue in a GitHub repository',
        inputSchema: CreateIssueSchema
      },
      {
        name: 'create_or_update_file',
        description: 'Create or update a single file in a GitHub repository',
        inputSchema: CreateOrUpdateFileSchema
      },
      {
        name: 'get_file_contents',
        description: 'Get the contents of a file or directory from a GitHub repository',
        inputSchema: GetFileContentsSchema
      },
      {
        name: 'create_pull_request',
        description: 'Create a new pull request in a GitHub repository',
        inputSchema: CreatePullRequestSchema
      },
      {
        name: 'fork_repository',
        description: 'Fork a GitHub repository to your account or specified organization',
        inputSchema: ForkRepositorySchema
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (!request.params.arguments) {
      throw new Error('Arguments are required');
    }

    switch (request.params.name) {
      case 'create_repository': {
        const args = CreateRepositorySchema.parse(request.params.arguments);
        const response = await octokit.repos.createForAuthenticatedUser(args);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      }

      case 'create_issue': {
        const args = CreateIssueSchema.parse(request.params.arguments);
        const response = await octokit.issues.create(args);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      }

      case 'create_or_update_file': {
        const args = CreateOrUpdateFileSchema.parse(request.params.arguments);
        const content = Buffer.from(args.content).toString('base64');
        const response = await octokit.repos.createOrUpdateFileContents({
          ...args,
          content
        });
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      }

      case 'get_file_contents': {
        const args = GetFileContentsSchema.parse(request.params.arguments);
        const response = await octokit.repos.getContent(args);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      }

      case 'create_pull_request': {
        const args = CreatePullRequestSchema.parse(request.params.arguments);
        const response = await octokit.pulls.create(args);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      }

      case 'fork_repository': {
        const args = ForkRepositorySchema.parse(request.params.arguments);
        const response = await octokit.repos.createFork(args);
        return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid arguments: ${error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ')}`);
    }
    throw error;
  }
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
