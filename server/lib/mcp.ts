import TMDB from "@blacktiger/tmdb";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Type for ASSETS binding (Fetcher from @cloudflare/workers-types)
type AssetsBinding = {
  fetch: (request: Request | string) => Promise<Response>;
};

// Load assets using the ASSETS binding
async function loadAssets(
  assets?: AssetsBinding,
): Promise<{ css: string; html: string }> {
  try {
    if (!assets) {
      throw new Error("ASSETS binding not available");
    }

    const buildRequest = (path: string) =>
      // Assets fetcher expects an absolute URL, so use a placeholder origin.
      new Request(new URL(path, "https://assets.invalid").toString());

    // Fetch CSS and JS files from the ASSETS binding
    const cssResponse = await assets.fetch(buildRequest("/usher.css"));
    const htmlResponse = await assets.fetch(buildRequest("/usher.js"));

    if (!cssResponse.ok || !htmlResponse.ok) {
      throw new Error(
        `Failed to fetch assets: CSS ${cssResponse.status}, JS ${htmlResponse.status}`,
      );
    }

    const css = await cssResponse.text();
    const html = await htmlResponse.text();

    return { css, html };
  } catch (error) {
    console.error("Failed to load assets:", error);
    return {
      css: "/* Error loading CSS */",
      html: "/* Error loading JS */",
    };
  }
}

export function createMcpServer(assets?: AssetsBinding): McpServer {
  const server = new McpServer({
    name: "usher-mcp",
    version: "0.0.1",
  });

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
          },
        },
      },
    },
    async () => {
      // Load assets dynamically using ASSETS binding
      const { css, html } = await loadAssets(assets);

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
                },
              },
            },
          },
        ],
      };
    },
  );

  server.registerTool(
    "get-movie-detail",
    {
      description:
        "Search TMDB by title and return the best matching movie details",
      inputSchema: z.object({
        query: z
          .string()
          .min(1, "Please provide a movie title")
          .describe("Movie title to search for"),
      }),
      _meta: {
        "ui/resourceUri": "ui://widget/movie-detail-widget.html",
      },
    },
    async ({ query }) => {
      const apiKey = process.env.TMDB_TOKEN;
      if (!apiKey) {
        throw new Error(
          "TMDB_TOKEN is not set. Please add it to your environment.",
        );
      }

      const tmdb = new TMDB(apiKey, "en-US");
      const searchResponse = await tmdb.search.movie(query, {
        includeAdult: false,
        page: 1,
      });

      const firstMatch = searchResponse.results?.[0];
      if (!firstMatch) {
        return {
          content: [
            {
              type: "text",
              text: `No results found for "${query}".`,
            },
          ],
          structuredContent: {
            query,
            movie: null,
          },
        };
      }

      const [details, credits] = await Promise.all([
        tmdb.movie.details(firstMatch.id),
        tmdb.movie.credits(firstMatch.id).catch(() => undefined),
      ]);

      const cast =
        credits?.cast
          ?.filter((member) => Boolean(member?.name))
          .slice(0, 8)
          .map((member) => member.name) ?? [];

      const moviePayload = {
        id: details.id,
        title: details.title ?? details.original_title,
        releaseDate: details.release_date,
        overview: details.overview,
        runtimeMinutes: details.runtime,
        rating: details.vote_average,
        genres:
          details.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
        language:
          details.spoken_languages?.[0]?.english_name ??
          details.original_language,
        tagline: details.tagline,
        studio: details.production_companies?.[0]?.name,
        posterUrl: details.poster_path
          ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
          : undefined,
        backdropUrl: details.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${details.backdrop_path}`
          : undefined,
        homepage: details.homepage,
        cast,
        query,
      };

      return {
        content: [
          {
            type: "text",
            text: `Showing results for "${query}": ${moviePayload.title ?? "Unknown title"}.`,
          },
        ],
        structuredContent: {
          query,
          movie: moviePayload,
        },
      };
    },
  );

  return server;
}
