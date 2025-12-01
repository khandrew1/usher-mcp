import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

// Type for ASSETS binding (Fetcher from @cloudflare/workers-types)
type AssetsBinding = {
  fetch: (request: Request | string) => Promise<Response>
}

// Load assets using the ASSETS binding
async function loadAssets(assets?: AssetsBinding): Promise<{ css: string; html: string }> {
  try {
    if (!assets) {
      throw new Error('ASSETS binding not available')
    }

    const buildRequest = (path: string) =>
      // Assets fetcher expects an absolute URL, so use a placeholder origin.
      new Request(new URL(path, 'https://assets.invalid').toString())

    // Fetch CSS and JS files from the ASSETS binding
    const cssResponse = await assets.fetch(buildRequest('/usher.css'))
    const htmlResponse = await assets.fetch(buildRequest('/usher.js'))

    if (!cssResponse.ok || !htmlResponse.ok) {
      throw new Error(`Failed to fetch assets: CSS ${cssResponse.status}, JS ${htmlResponse.status}`)
    }

    const css = await cssResponse.text()
    const html = await htmlResponse.text()

    return { css, html }
  } catch (error) {
    console.error('Failed to load assets:', error)
    return {
      css: '/* Error loading CSS */',
      html: '/* Error loading JS */'
    }
  }
}

export function createMcpServer(assets?: AssetsBinding): McpServer {
  const server = new McpServer({
    name: 'usher-mcp',
    version: '0.0.1'
  })

  server.registerResource(
    "movie-detail-widget",
    "ui://widget/movie-detail-widget.html",
    {
      description: "Interactive movie detail widget UI",
      mimeType: "text/html+mcp",
      _meta: {
        ui: {
          csp: {
            resourceDomains: ["https://image.tmdb.org/"],
          }
        }
      }
    },
    async () => {
      // Load assets dynamically using ASSETS binding
      const { css, html } = await loadAssets(assets)
      
      return {
        contents: [
          {
            uri: "ui://widget/movie-detail-widget.html",
            mimeType: "text/html+mcp",
            text: `
              <!doctype html>
              <html lang="en">
                <head>
                  <meta charset="utf-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1" />
                  <style>${css}</style>
                </head>
                <body>
                  <div id="root"></div>
                  <script type="module">${html}</script>
                </body>
              </html>
            `.trim(),
            _meta: {
              ui: {
                csp: {
                  resourceDomains: ["https://image.tmdb.org/"],
                }
              }
            } 
          }
        ]
      }
    }
  )

  server.registerTool(
    "get-movie-detail",
    {
      description: "Get detailed information about a movie",
      inputSchema: z.object({
        movieId: z.string().optional().describe("The ID of the movie")
      }),
      _meta: {
        "ui/resourceUri": "ui://widget/movie-detail-widget.html"
      }
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: "Movie detail retrieved successfully"
          }
        ]
      }
    }
  )

  return server
}
