/**
 * MCP (Model Context Protocol) Tools simulation for Unifix
 * This defines how the AI can interact with the local machine via the Electron API.
 */

export const MCP_TOOLS = [
  {
    name: 'save_script',
    description: 'Saves a generated script to the local Unifix project directory.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The filename for the script (e.g., install_nginx.sh)',
        },
        content: {
          type: 'string',
          description: 'The full source code of the script.',
        },
        options: {
          type: 'object',
          properties: {
            preferWorkspace: { type: 'boolean', default: true },
            skipDialog: { type: 'boolean', default: true },
          },
        },
      },
      required: ['name', 'content'],
    },
  },
  {
    name: 'run_script',
    description: 'Executes a script on the local machine and streams logs to the UI.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute or relative path to the script to execute.',
        },
        runtimeArgs: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of arguments to pass to the script.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'open_native_terminal',
    description: 'Opens the system native terminal (Terminal.app, cmd.exe) to execute a script.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The path to the script.',
        },
      },
      required: ['path'],
    },
  },
];

/**
 * Simulates tool calling logic in the frontend
 */
export const callMcpTool = async (toolName, args) => {
  if (!window.electronAPI) {
    throw new Error('MCP Tools require the Unifix Electron environment.');
  }

  console.log(`[MCP] Calling tool: ${toolName}`, args);

  switch (toolName) {
    case 'save_script':
      return await window.electronAPI.saveScript(args.name, args.content, args.options || { skipDialog: true, preferWorkspace: true });
    
    case 'run_script':
      // This typically involves navigating to the repo tab with specific params
      return { success: true, action: 'navigate_to_repo', params: { open: args.path, run: true } };

    case 'open_native_terminal':
      return await window.electronAPI.openNativeTerminal(args.path);

    default:
      throw new Error(`Unknown MCP tool; ${toolName}`);
  }
};
