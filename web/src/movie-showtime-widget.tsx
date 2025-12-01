import { useEffect, useRef, useState } from "react";
import { Clock, MapPin, Navigation, Popcorn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ToolInputParams = {
  arguments?: Record<string, unknown>;
};

type Showing = {
  type?: string;
  times: string[];
};

type Theater = {
  name: string;
  distance?: string;
  address?: string;
  showings: Showing[];
};

type ShowtimeDay = {
  day?: string;
  date?: string;
  theaters: Theater[];
};

type ShowtimePayload = {
  movieTitle?: string;
  location?: string;
  posterUrl?: string;
  showtimes: ShowtimeDay[];
};

function formatDayLabel(raw?: string): string | undefined {
  if (!raw || typeof raw !== "string") return raw;
  // Convert compact strings like "WedDec 1" -> "Wed, Dec 1"
  const compactMatch = raw.match(/^([A-Za-z]{3})([A-Za-z]{3})\s*(\d{1,2})?$/);
  if (compactMatch) {
    const [, day, month, datePart] = compactMatch;
    return `${day}, ${month}${datePart ? ` ${datePart}` : ""}`;
  }
  return raw;
}

function normalizeShowings(showing: unknown): Showing | null {
  if (!showing || typeof showing !== "object") return null;
  const showingObj = showing as {
    time?: unknown;
    times?: unknown;
    type?: unknown;
  };
  const timesSource = showingObj.times ?? showingObj.time;
  const times = Array.isArray(timesSource)
    ? timesSource
        .map((t) => (typeof t === "string" ? t.trim() : null))
        .filter(Boolean)
    : [];
  return {
    times,
    type: typeof showingObj.type === "string" ? showingObj.type : undefined,
  };
}

function normalizeTheater(theater: unknown): Theater | null {
  if (!theater || typeof theater !== "object") return null;
  const theaterObj = theater as Record<string, unknown>;
  const showings = Array.isArray((theaterObj as { showing?: unknown }).showing)
    ? (((theaterObj as { showing?: unknown }).showing as unknown[])
        .map(normalizeShowings)
        .filter(Boolean) as Showing[])
    : Array.isArray((theaterObj as { showings?: unknown }).showings)
      ? (((theaterObj as { showings?: unknown }).showings as unknown[])
          .map(normalizeShowings)
          .filter(Boolean) as Showing[])
      : [];

  return {
    name:
      typeof theaterObj.name === "string" ? theaterObj.name : "Unknown theater",
    distance:
      typeof theaterObj.distance === "string"
        ? theaterObj.distance
        : typeof theaterObj.distance === "number"
          ? `${theaterObj.distance} mi`
          : undefined,
    address:
      typeof theaterObj.address === "string" ? theaterObj.address : undefined,
    showings,
  };
}

function normalizeShowtimes(showtimes: unknown): ShowtimeDay[] {
  if (!Array.isArray(showtimes)) return [];

  return showtimes
    .slice(0, 4)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const entryObj = entry as Record<string, unknown>;
      const theaters = Array.isArray(entryObj.theaters)
        ? (entryObj.theaters
            .slice(0, 3)
            .map(normalizeTheater)
            .filter(Boolean) as Theater[])
        : [];

      return {
        day: typeof entryObj.day === "string" ? entryObj.day : undefined,
        date: typeof entryObj.date === "string" ? entryObj.date : undefined,
        theaters,
      };
    })
    .filter(Boolean) as ShowtimeDay[];
}

function parseShowtimePayload(result: unknown): ShowtimePayload {
  if (!result || typeof result !== "object") return { showtimes: [] };
  const payload =
    (result as { structuredContent?: unknown; showtimes?: unknown })
      .structuredContent ?? result;

  const showtimes = normalizeShowtimes(
    (payload as { showtimes?: unknown }).showtimes ??
      (payload as { showtime?: unknown }).showtime,
  );

  const movieTitle =
    typeof (payload as { movieTitle?: unknown }).movieTitle === "string"
      ? (payload as { movieTitle: string }).movieTitle
      : typeof (payload as { title?: unknown }).title === "string"
        ? (payload as { title: string }).title
        : undefined;

  const location =
    typeof (payload as { location?: unknown }).location === "string"
      ? (payload as { location: string }).location
      : undefined;

  const posterUrl =
    typeof (payload as { posterUrl?: unknown }).posterUrl === "string"
      ? (payload as { posterUrl: string }).posterUrl
      : undefined;

  return { movieTitle, location, posterUrl, showtimes };
}

export default function MovieShowtimeWidget() {
  const [payload, setPayload] = useState<ShowtimePayload>({ showtimes: [] });
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const sendRequestRef = useRef<
    ((method: string, params?: unknown) => Promise<unknown>) | null
  >(null);

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
      const args = params?.arguments ?? {};
      const title =
        typeof args.movieTitle === "string"
          ? args.movieTitle
          : typeof args.title === "string"
            ? args.title
            : undefined;
      const location =
        typeof args.location === "string" ? args.location : undefined;

      if (title || location) {
        setPayload((prev) => ({
          ...prev,
          movieTitle: title ?? prev.movieTitle,
          location: location ?? prev.location,
        }));
        setStatus("loading");
        setError(null);
      }
    };

    const handleToolResult = (params?: unknown) => {
      const parsed = parseShowtimePayload(params);
      if (parsed.showtimes.length === 0) {
        setStatus("error");
        setError("No showtimes were returned.");
        return;
      }

      setPayload((prev) => ({
        ...prev,
        ...parsed,
      }));
      setStatus("ready");
      setError(null);
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
      clientInfo: { name: "movie-showtime-widget", version: "0.0.1" },
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

  const handleShowtimeClick = (theaterName?: string, time?: string) => {
    const sendRequest = sendRequestRef.current;
    const searchTitle = payload.movieTitle ?? "movie";
    const pieces = [searchTitle, theaterName, time, "showtime"].filter(Boolean);
    const query = pieces.join(" ");
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

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
      ? payload.movieTitle && payload.location
        ? `Searching showtimes for "${payload.movieTitle}" in ${payload.location}...`
        : "Searching for showtimes..."
      : status === "ready"
        ? `Showing showtimes for "${payload.movieTitle ?? "this movie"}"${
            payload.location ? ` in ${payload.location}` : ""
          }.`
        : status === "error"
          ? (error ?? "Unable to load showtimes.")
          : "Awaiting query from the MCP host.";

  const showtimeDays = payload.showtimes.slice(0, 4);

  return (
    <div className="bg-background text-foreground min-h-screen">
      {status === "error" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error ?? "Something went wrong while loading showtimes."}
        </div>
      )}

      <div className="mt-3 flex flex-col items-start gap-4 rounded-xl border bg-card/80 p-4 shadow-md sm:flex-row sm:items-start sm:gap-6 sm:p-6">
        <div className="relative w-full overflow-hidden rounded-lg border bg-gradient-to-br from-muted to-muted/50 shadow-inner aspect-[2/3] sm:max-w-[220px]">
          {payload.posterUrl ? (
            <img
              src={payload.posterUrl}
              alt={`${payload.movieTitle ?? "Movie"} poster`}
              className="h-fit w-full object-contain p-2"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,rgba(0,0,0,0.08),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(0,0,0,0.06),transparent_35%),radial-gradient(circle_at_50%_60%,rgba(0,0,0,0.08),transparent_35%)] text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Popcorn className="size-5 opacity-80" />
              <span>No poster</span>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-semibold leading-tight sm:text-xl">
                {payload.movieTitle ?? "Movie showtimes"}
              </h1>
              {payload.location && (
                <span className="bg-muted text-foreground/80 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none shadow-[0_0_0_1px_var(--border)]">
                  <Navigation className="size-3.5" aria-hidden />
                  {payload.location}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{statusText}</p>
          </div>

          {showtimeDays.length === 0 ? (
            <div className="rounded-lg border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
              Waiting for showtime data from the host...
            </div>
          ) : (
            <div className="space-y-3">
              {showtimeDays.map((day, index) => (
                <div
                  key={`${day.day ?? "day"}-${day.date ?? index}`}
                  className="rounded-lg border bg-background/60 p-3 shadow-sm"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-primary" aria-hidden />
                      <div className="text-sm font-semibold">
                        {formatDayLabel(day.day) ?? "Showtimes"}
                      </div>
                    </div>
                    {day.date && (
                      <div className="text-xs text-muted-foreground">
                        {day.date}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 space-y-3">
                    {day.theaters.map((theater) => (
                      <div
                        key={`${theater.name}-${theater.address ?? theater.distance ?? ""}`}
                        className="rounded-md border bg-card/70 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <MapPin
                                className="size-4 text-primary"
                                aria-hidden
                              />
                              <div className="text-sm font-semibold leading-tight">
                                {theater.name}
                              </div>
                            </div>
                            {theater.address && (
                              <div className="text-xs text-muted-foreground">
                                {theater.address}
                              </div>
                            )}
                          </div>
                          {theater.distance && (
                            <span className="bg-muted text-foreground/80 rounded-full px-2 py-1 text-[11px] font-medium leading-none">
                              {theater.distance}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {theater.showings.flatMap((showing) =>
                            showing.times.map((time) => (
                              <Button
                                key={`${theater.name}-${showing.type ?? "standard"}-${time}`}
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleShowtimeClick(theater.name, time)
                                }
                                className={cn(
                                  "border-primary/40 text-primary hover:bg-primary/10 rounded-full",
                                  showing.type ? "pr-4" : "",
                                )}
                              >
                                <span>{time}</span>
                                {showing.type && (
                                  <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                                    {showing.type}
                                  </span>
                                )}
                              </Button>
                            )),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
