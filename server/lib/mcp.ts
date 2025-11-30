import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'usher-mcp',
    version: '0.0.1'
  })

  server.registerTool(
    'echo',
    {
      title: 'Echo Tool',
      description: 'Returns the input message back to the user',
      inputSchema: z.object({
        message: z.string().describe('The message to echo back')
      })
    },
    async ({ message }: { message: string }) => {
      return {
        content: [{ type: 'text', text: message }]
      }
    }
  )

  return server
}
