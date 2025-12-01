import { Hono } from "hono";
import { createMcpHandler } from "agents/mcp";
import { createMcpServer } from "./lib/mcp.js";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) =>
  c.html(
    `<main style="font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; line-height: 1.6;">
      <h1 style="font-size: 1.6rem; margin-bottom: 0.5rem;">Usher MCP Server</h1>
      <p>This worker exposes an MCP endpoint at <code>/mcp</code>. Connect with an MCP-compatible host to use the Movie Detail widget.</p>
      <p>If you reached this page in a browser, there's nothing else to do here.</p>
    </main>`,
  ),
);

app.all("/mcp", async (c) => {
  // Create server with ASSETS binding
  const server = createMcpServer(c.env.ASSETS, c.env.TMDB_TOKEN);
  const mcpFetchHandler = createMcpHandler(server);
  return mcpFetchHandler(
    c.req.raw,
    c.env,
    c.executionCtx as ExecutionContext<CloudflareBindings>,
  );
});

export default app;
