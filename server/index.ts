import { Hono } from "hono";
import { createMcpHandler } from "agents/mcp";
import { createMcpServer } from "./lib/mcp.js";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.all("/mcp", async (c) => {
  // Create server with ASSETS binding
  const server = createMcpServer(c.env.ASSETS);
  const mcpFetchHandler = createMcpHandler(server);
  return mcpFetchHandler(
    c.req.raw,
    c.env,
    c.executionCtx as ExecutionContext<CloudflareBindings>,
  );
});

export default app;
