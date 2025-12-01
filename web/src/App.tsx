import { useEffect, useRef, useState } from "react";

import { MovieCard, type MovieCardProps } from "./components/movie-card";

type ToolInputParams = {
  arguments?: Record<string, unknown>;
};

const SAMPLE_MOVIE: MovieCardProps = {
  title: "Zootopia 2",
  posterUrl: "https://image.tmdb.org/t/p/w1280/3Wg1LBCiTEXTxRrkNKOqJyyIFyF.jpg",
  releaseDate: "2025-11-26",
  description:
    "After cracking the biggest case in Zootopia's history, rookie cops Judy Hopps and Nick Wilde find themselves on the twisting trail of a great mystery when Gary De'Snake arrives and turns the animal metropolis upside down.",
  runtimeMinutes: 107,
  rating: 7.638,
  genres: ["Animation", "Family", "Comedy", "Adventure", "Mystery"],
  language: "English",
  tagline: "Zootopia will be changed furrrever...",
  studio: "Walt Disney Animation Studios",
  query: "Zootopia 2",
  cast: ["Judy Hopps", "Nick Wilde"],
};

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

function App() {
  const [movie, setMovie] = useState<MovieCardProps | null>(SAMPLE_MOVIE);
  const [query, setQuery] = useState<string>(SAMPLE_MOVIE.title);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const sendRequestRef = useRef<((method: string, params?: unknown) => Promise<unknown>) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const target = window.parent ?? window;
    const pendingRequests = new Map<
      number,
      { resolve: (value: unknown) => void; reject: (error: unknown) => void }
    >();
    let requestId = 1;

    const post = (message: unknown) => target.postMessage(message, "*");
    const sendNotification = (method: string, params?: unknown) =>
      post({ jsonrpc: "2.0", method, params });
    const sendResponse = (
      id: number,
      payload: { result?: unknown; error?: unknown },
    ) => post({ jsonrpc: "2.0", id, ...payload });
    const sendRequest = (method: string, params?: unknown) => {
      const id = requestId++;
      post({ jsonrpc: "2.0", id, method, params });
      return new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        setTimeout(() => {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error(`Request "${method}" timed out`));
          }
        }, 15000);
      });
    };
    sendRequestRef.current = sendRequest;

    const handleToolInput = (params?: ToolInputParams) => {
      const incomingQuery = params?.arguments?.query;
      if (
        typeof incomingQuery === "string" &&
        incomingQuery.trim().length > 0
      ) {
        setQuery(incomingQuery);
        setStatus("loading");
        setError(null);
      }
    };

    const handleToolResult = (params?: unknown) => {
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
    };

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.jsonrpc !== "2.0") return;

      if (data.method) {
        switch (data.method) {
          case "ui/notifications/tool-input":
          case "ui/notifications/tool-input-partial":
            handleToolInput(data.params as ToolInputParams);
            return;
          case "ui/notifications/tool-result":
            handleToolResult(data.params);
            return;
          case "ui/tool-cancelled":
            setStatus("error");
            setError(
              data.params && typeof data.params.reason === "string"
                ? data.params.reason
                : "Tool run was cancelled.",
            );
            return;
          case "ui/resource-teardown":
            if (typeof data.id === "number") {
              sendResponse(data.id, { result: {} });
            }
            return;
          default:
            return;
        }
      }

      if (typeof data.id === "number" && pendingRequests.has(data.id)) {
        const pending = pendingRequests.get(data.id);
        pendingRequests.delete(data.id);

        if (data.error) {
          pending?.reject(data.error);
        } else {
          pending?.resolve(data.result);
        }
      }
    };

    window.addEventListener("message", handleMessage);

    sendRequest("ui/initialize", {
      capabilities: {},
      clientInfo: { name: "movie-detail-widget", version: "0.0.1" },
      protocolVersion: "2025-06-18",
    })
      .then(() => sendNotification("ui/notifications/initialized", {}))
      .catch(() => {
        // Staying in preview mode when no host responds.
      });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      sendNotification("ui/notifications/size-change", {
        width: Math.round(width),
        height: Math.round(height),
      });
    });

    observer.observe(document.body);

    return () => {
      observer.disconnect();
      window.removeEventListener("message", handleMessage);
      pendingRequests.clear();
      sendRequestRef.current = null;
    };
  }, []);

  const handleShowtimesClick = (urlOverride?: string) => {
    const activeTitle = movie?.title ?? query;
    const url =
      urlOverride ??
      (activeTitle
        ? `https://www.google.com/search?q=${encodeURIComponent(`${activeTitle} showtimes near me`)}`
        : null);

    if (!url) return;
    const sendRequest = sendRequestRef.current;
    if (!sendRequest) {
      setStatus("error");
      setError("Host did not expose ui/open-link capability.");
      return;
    }

    sendRequest("ui/open-link", { url }).catch(() => {
      setStatus("error");
      setError("Host rejected ui/open-link request.");
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

export default App;
