function App() {
  return (
    <div className="bg-background text-foreground min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Usher MCP Server</h1>
        <p className="text-muted-foreground">
          This endpoint serves the Movie Detail MCP App. Connect via your
          MCP-compatible host to render the interactive widget. If you expected
          UI here, please point your MCP client at the `/mcp` endpoint instead.
        </p>
      </div>
    </div>
  );
}

export default App;
