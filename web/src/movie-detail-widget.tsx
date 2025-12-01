import { useCallback, useState } from "react";
import { z } from "zod";

import {
  McpUiResourceTeardownRequestSchema,
  McpUiToolInputNotificationSchema,
  McpUiToolInputPartialNotificationSchema,
  McpUiToolResultNotificationSchema,
  useApp,
} from "@modelcontextprotocol/ext-apps/react";

import { MovieCard, type MovieCardProps } from "./components/movie-card";

type ToolInputParams = {
  arguments?: Record<string, unknown>;
};

const ToolCancelledNotificationSchema = z.object({
  method: z.literal("ui/tool-cancelled"),
  params: z
    .object({
      reason: z.string().optional(),
    })
    .optional(),
});

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseMovieFromResult(result: unknown): MovieCardProps | null {
  if (!result || typeof result !== "object") return null;
  const payload =
    (result as { structuredContent?: unknown; movie?: unknown })
      .structuredContent ?? result;
  const movie = (payload as { movie?: unknown }).movie ?? payload;

  if (!movie || typeof movie !== "object") return null;

  const movieObj = movie as Record<string, unknown>;
  const posterUrl =
    typeof movieObj.posterUrl === "string"
      ? movieObj.posterUrl
      : typeof movieObj.poster_path === "string"
        ? `https://image.tmdb.org/t/p/w500${movieObj.poster_path}`
        : undefined;

  const genres = Array.isArray(movieObj.genres)
    ? (movieObj.genres
        .map((genre) => {
          if (typeof genre === "string") return genre;
          if (genre && typeof (genre as { name?: string }).name === "string") {
            return (genre as { name: string }).name;
          }
          return null;
        })
        .filter(Boolean) as string[])
    : undefined;

  const cast = Array.isArray(movieObj.cast)
    ? (movieObj.cast.filter((name) => typeof name === "string") as string[])
    : undefined;

  const runtimeMinutes = coerceNumber(
    movieObj.runtimeMinutes ?? movieObj.runtime,
  );
  const rating = coerceNumber(movieObj.rating ?? movieObj.vote_average);

  const incomingQuery =
    typeof (payload as { query?: unknown }).query === "string"
      ? (payload as { query: string }).query
      : typeof movieObj.query === "string"
        ? (movieObj.query as string)
        : undefined;

  return {
    title:
      (typeof movieObj.title === "string" && movieObj.title) ||
      (typeof movieObj.original_title === "string"
        ? (movieObj.original_title as string)
        : "Movie details"),
    posterUrl,
    releaseDate: (movieObj.releaseDate ?? movieObj.release_date) as
      | string
      | undefined,
    description:
      typeof movieObj.overview === "string"
        ? (movieObj.overview as string)
        : undefined,
    cast,
    runtimeMinutes,
    rating,
    genres,
    language:
      (movieObj.language as string | undefined) ??
      (movieObj.original_language as string | undefined) ??
      undefined,
    tagline:
      typeof movieObj.tagline === "string"
        ? (movieObj.tagline as string)
        : undefined,
    studio:
      (movieObj.studio as string | undefined) ??
      (Array.isArray(movieObj.production_companies) &&
      (movieObj.production_companies as Array<{ name?: string }>)[0]?.name
        ? (movieObj.production_companies as Array<{ name?: string }>)[0]?.name
        : undefined),
    query: incomingQuery,
  };
}

export default function MovieDetailWidget() {
  const [movie, setMovie] = useState<MovieCardProps | null>(null);
  const [query, setQuery] = useState<string>("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const handleToolInput = useCallback((params?: ToolInputParams) => {
    const incomingQuery = params?.arguments?.query;
    if (typeof incomingQuery === "string" && incomingQuery.trim().length > 0) {
      setQuery(incomingQuery);
      setStatus("loading");
      setError(null);
    }
  }, []);

  const handleToolResult = useCallback((params?: unknown) => {
    const movieCard = parseMovieFromResult(params);
    const incomingQuery =
      params &&
      typeof params === "object" &&
      "query" in params &&
      typeof (params as { query?: unknown }).query === "string"
        ? (params as { query: string }).query
        : undefined;

    if (incomingQuery) {
      setQuery(incomingQuery);
    } else if (movieCard?.query) {
      setQuery(movieCard.query);
    }

    if (movieCard) {
      setMovie({ ...movieCard, query: incomingQuery ?? movieCard.query });
      setStatus("ready");
      setError(null);
    } else {
      setStatus("error");
      setError("No movie details were returned.");
    }
  }, []);

  const handleToolCancelled = useCallback((reason?: string | null) => {
    setStatus("error");
    setError(reason ?? "Tool run was cancelled.");
  }, []);

  const { app, isConnected } = useApp({
    appInfo: { name: "movie-detail-widget", version: "0.1.0" },
    capabilities: {},
    onAppCreated: (appInstance) => {
      appInstance.setNotificationHandler(
        McpUiToolInputNotificationSchema as unknown as z.ZodObject<any>,
        (notification) =>
          handleToolInput(notification.params as ToolInputParams),
      );
      appInstance.setNotificationHandler(
        McpUiToolInputPartialNotificationSchema as unknown as z.ZodObject<any>,
        (notification) =>
          handleToolInput(notification.params as ToolInputParams),
      );
      appInstance.setNotificationHandler(
        McpUiToolResultNotificationSchema as unknown as z.ZodObject<any>,
        (notification) => handleToolResult(notification.params),
      );
      appInstance.setNotificationHandler(
        ToolCancelledNotificationSchema,
        (notification) =>
          handleToolCancelled(notification.params?.reason ?? null),
      );
      appInstance.setRequestHandler(
        McpUiResourceTeardownRequestSchema as unknown as z.ZodObject<any>,
        async () => ({}),
      );
    },
  });

  const handleShowtimesClick = () => {
    const activeTitle = movie?.title ?? query;
    if (!activeTitle) return;

    if (!app || !isConnected) {
      setStatus("error");
      setError("Host did not expose ui/message capability.");
      return;
    }

    app
      .sendMessage({
        role: "user",
        content: [
          { type: "text", text: `Give me showtimes for ${activeTitle}` },
        ],
      })
      .catch(() => {
        setStatus("error");
        setError("Host rejected ui/message request.");
      });
  };

  const statusText =
    status === "loading"
      ? query
        ? `Loading results for "${query}"...`
        : "Loading movie details..."
      : status === "ready"
        ? query
          ? `Showing results for "${query}".`
          : "Showing movie details."
        : status === "error"
          ? (error ?? "Unable to load movie details.")
          : "Awaiting query from the MCP host. Showing preview data until results arrive.";

  return (
    <div className="bg-background text-foreground min-h-screen">
      {status === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error ?? "Something went wrong while loading this movie."}
        </div>
      )}

      {movie ? (
        <MovieCard
          {...movie}
          query={query ?? movie.query}
          onOpenShowtimes={handleShowtimesClick}
          className="shadow-md"
        />
      ) : (
        <div className="rounded-lg border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          Waiting for movie data from the host...
        </div>
      )}
    </div>
  );
}
