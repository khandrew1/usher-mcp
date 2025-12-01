import TMDB from "@blacktiger/tmdb";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getJson } from "serpapi";
import { z } from "zod";

// Type for ASSETS binding (Fetcher from @cloudflare/workers-types)
type AssetsBinding = {
  fetch: (request: Request | string) => Promise<Response>;
};

// Widget configuration type
type WidgetConfig = {
  name: string;
  cssPath: string;
  jsPath: string;
  resourceUri: string;
  description: string;
  cspDomains?: string[];
};

type SerpShowtimeResponse = {
  showtimes?: Array<{
    day?: string;
    date?: string;
    theaters?: Array<{
      name?: string;
      link?: string;
      distance?: string;
      address?: string;
      showing?: Array<{
        time?: string[];
        type?: string;
      }>;
    }>;
  }>;
};

async function loadAssets(
  assets: AssetsBinding | undefined,
  cssPath: string,
  jsPath: string,
): Promise<{ css: string; html: string }> {
  try {
    if (!assets) {
      throw new Error("ASSETS binding not available");
    }

    const buildRequest = (path: string) =>
      // Assets fetcher expects an absolute URL, so use a placeholder origin.
      new Request(new URL(path, "https://assets.invalid").toString());

    // Fetch CSS and JS files from the ASSETS binding
    const cssResponse = await assets.fetch(buildRequest(cssPath));
    const jsResponse = await assets.fetch(buildRequest(jsPath));

    if (!cssResponse.ok || !jsResponse.ok) {
      throw new Error(
        `Failed to fetch assets: CSS ${cssResponse.status}, JS ${jsResponse.status}`,
      );
    }

    const css = await cssResponse.text();
    const html = await jsResponse.text();

    return { css, html };
  } catch (error) {
    console.error("Failed to load assets:", error);
    return {
      css: "/* Error loading CSS */",
      html: "/* Error loading JS */",
    };
  }
}

function registerWidget(
  server: McpServer,
  assets: AssetsBinding | undefined,
  config: WidgetConfig,
): void {
  server.registerResource(
    config.name,
    config.resourceUri,
    {
      description: config.description,
      mimeType: "text/html+mcp",
      _meta: {
        ui: {
          csp: {
            resourceDomains: config.cspDomains ?? ["https://image.tmdb.org/"],
          },
        },
      },
    },
    async () => {
      // Load assets dynamically using ASSETS binding
      const { css, html } = await loadAssets(
        assets,
        config.cssPath,
        config.jsPath,
      );

      return {
        contents: [
          {
            uri: config.resourceUri,
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
                  resourceDomains: config.cspDomains ?? [
                    "https://image.tmdb.org/",
                  ],
                },
              },
            },
          },
        ],
      };
    },
  );
}

function normalizeShowtimes(response: SerpShowtimeResponse | undefined): Array<{
  day?: string;
  date?: string;
  theaters: Array<{
    name: string;
    link?: string;
    distance?: string;
    address?: string;
    showings: Array<{ type?: string; times: string[] }>;
  }>;
}> {
  const showtimes = response?.showtimes;
  if (!Array.isArray(showtimes)) return [];

  return showtimes.slice(0, 4).map((entry) => {
    const theatersRaw = Array.isArray(entry?.theaters)
      ? (entry?.theaters ?? []).slice(0, 3)
      : [];
    const theaters = theatersRaw
      .map((theater) => {
        if (!theater) return null;
        const distance =
          typeof theater.distance === "number"
            ? `${theater.distance}`
            : (theater.distance ?? undefined);
        const address =
          typeof theater.address === "string" ? theater.address : undefined;
        const showings = Array.isArray(theater.showing)
          ? theater.showing
              .map((showing) => {
                if (!showing) return null;
                const times = Array.isArray(showing.time)
                  ? showing.time.filter(
                      (time): time is string => typeof time === "string",
                    )
                  : [];
                return { type: showing.type, times };
              })
              .filter(Boolean)
          : [];

        return {
          name: theater.name ?? "Unknown theater",
          link: theater.link ?? undefined,
          distance,
          address,
          showings,
        };
      })
      .filter(Boolean);

    return {
      day: entry?.day,
      date: entry?.date,
      theaters,
    };
  });
}

async function fetchPosterUrl(
  title: string,
  tmdbKey: string | undefined,
): Promise<string | undefined> {
  if (!tmdbKey) return undefined;
  try {
    const tmdb = new TMDB(tmdbKey, "en-US");
    const searchResponse = await tmdb.search.movie(title, {
      includeAdult: false,
      page: 1,
    });
    const firstMatch = searchResponse.results?.[0];
    if (!firstMatch?.poster_path) return undefined;
    return `https://image.tmdb.org/t/p/w500${firstMatch.poster_path}`;
  } catch (error) {
    console.error("Failed to fetch poster from TMDB:", error);
    return undefined;
  }
}

export function createMcpServer(
  assets?: AssetsBinding,
  tmdbToken?: string,
): McpServer {
  const server = new McpServer({
    name: "usher-mcp",
    version: "0.1.0",
  });

  // Register movie-detail-widget
  registerWidget(server, assets, {
    name: "movie-detail-widget",
    cssPath: "/movie-detail-widget.css",
    jsPath: "/movie-detail-widget.js",
    resourceUri: "ui://widget/movie-detail-widget.html",
    description: "Interactive movie detail widget UI",
    cspDomains: ["https://image.tmdb.org/"],
  });

  // Register movie-showtime-widget
  registerWidget(server, assets, {
    name: "movie-showtime-widget",
    cssPath: "/movie-showtime-widget.css",
    jsPath: "/movie-showtime-widget.js",
    resourceUri: "ui://widget/movie-showtime-widget.html",
    description: "Interactive movie showtime widget UI",
    cspDomains: ["https://image.tmdb.org/"],
  });

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
      const apiKey = tmdbToken ?? process.env.TMDB_TOKEN;
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

  server.registerTool(
    "get-movie-showtime",
    {
      description: "Search for movie showtimes by title and location",
      inputSchema: z.object({
        movieTitle: z
          .string()
          .min(1, "Please provide a movie title")
          .describe("Movie title to search showtimes for"),
        location: z
          .string()
          .min(1, "Please provide a location")
          .describe("Location to search showtimes in"),
      }),
      _meta: {
        "ui/resourceUri": "ui://widget/movie-showtime-widget.html",
      },
    },
    async ({ movieTitle, location }) => {
      const serpApiKey = process.env.SERP_TOKEN;

      if (!serpApiKey) {
        throw new Error(
          "SERP_API_KEY is not set. Please add it to your environment.",
        );
      }

      const query = `${movieTitle} ${location} theater`;
      let serpResponse: SerpShowtimeResponse | undefined;

      try {
        serpResponse = (await getJson({
          q: query,
          location,
          hl: "en",
          gl: "us",
          api_key: serpApiKey,
        })) as SerpShowtimeResponse;
      } catch (error) {
        console.error("Failed to fetch showtimes from SerpAPI:", error);
        throw new Error(
          "Unable to fetch showtimes right now. Please try again.",
        );
      }

      const showtimes = normalizeShowtimes(serpResponse);
      const posterUrl = await fetchPosterUrl(
        movieTitle,
        tmdbToken ?? process.env.TMDB_TOKEN,
      );

      if (showtimes.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No showtimes found for "${movieTitle}" in "${location}".`,
            },
          ],
          structuredContent: {
            movieTitle,
            location,
            query,
            posterUrl,
            showtimes,
          },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Showtimes for "${movieTitle}" in "${location}".`,
          },
        ],
        structuredContent: {
          movieTitle,
          location,
          query,
          posterUrl,
          showtimes,
        },
      };
    },
  );

  return server;
}
