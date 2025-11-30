import { Hono } from 'hono'
import { createMcpHandler } from 'agents/mcp'
import { createMcpServer } from './lib/mcp.js'

const server = createMcpServer()

const app = new Hono<{ Bindings: CloudflareBindings }>()

const mcpFetchHandler = createMcpHandler(server)

app.all('/mcp', async (c) => {
  return mcpFetchHandler(c.req.raw, c.env, c.executionCtx as ExecutionContext<CloudflareBindings>)
})

export default app