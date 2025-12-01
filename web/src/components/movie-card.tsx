import { CalendarDays, Clock, ExternalLink, Languages, Sparkles, Star } from "lucide-react";
import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MovieCardProps = {
  title: string;
  posterUrl?: string;
  releaseDate?: string | Date;
  description?: string;
  cast?: string[];
  runtimeMinutes?: number;
  rating?: number;
  genres?: string[];
  language?: string;
  tagline?: string;
  studio?: string;
  query?: string;
  className?: string;
  onOpenShowtimes?: (url: string) => void;
};

type MetaChipProps = {
  icon: React.ReactNode;
  label: string;
};

function MetaChip({ icon, label }: MetaChipProps) {
  return (
    <span className="bg-muted text-foreground/80 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none shadow-[0_0_0_1px_var(--border)]">
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

function formatRuntime(runtimeMinutes?: number) {
  if (!runtimeMinutes) return null;
  const hours = Math.floor(runtimeMinutes / 60);
  const minutes = runtimeMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatDate(releaseDate?: string | Date) {
  if (!releaseDate) return null;
  const date = new Date(releaseDate);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function MovieCard({
  title,
  posterUrl,
  releaseDate,
  description,
  cast,
  runtimeMinutes,
  rating,
  genres,
  language,
  tagline,
  studio,
  query,
  className,
  onOpenShowtimes,
}: MovieCardProps) {
  const formattedDate = formatDate(releaseDate);
  const formattedRuntime = formatRuntime(runtimeMinutes);
  const castLine =
    cast && cast.length > 0
      ? `${cast.slice(0, 4).join(", ")}${cast.length > 4 ? ` +${cast.length - 4} more` : ""}`
      : null;

  return (
    <Card className={cn("w-full h-screen bg-card/80", className)}>
      <CardContent className="relative flex h-full items-stretch gap-4 p-5 sm:gap-6 sm:p-6">
        {typeof rating === "number" && (
          <div className="bg-amber-50 text-amber-900 absolute right-5 top-5 z-10 flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold shadow-[0_0_0_1px_rgba(251,191,36,0.35)] sm:right-6 sm:top-6">
            <Star className="size-4 fill-amber-400 text-amber-500" />
            <span>{rating.toFixed(1)}</span>
          </div>
        )}
        <div className="relative aspect-[2/3] w-[140px] shrink-0 overflow-hidden rounded-lg border bg-gradient-to-br from-muted to-muted/50 shadow-inner sm:w-[180px]">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={`${title} poster`}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(0,0,0,0.08),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(0,0,0,0.06),transparent_35%),radial-gradient(circle_at_50%_60%,rgba(0,0,0,0.08),transparent_35%)] text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              No Poster
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base leading-tight sm:text-lg">
                {title}
              </CardTitle>
              {tagline && (
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {tagline}
                </p>
              )}
              {studio && (
                <CardDescription className="text-xs">{studio}</CardDescription>
              )}
            </div>
          </div>

          {title && onOpenShowtimes && (
            <button
              type="button"
              onClick={() => {
                const searchQuery = `${title} showtimes near me`;
                const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
                onOpenShowtimes(url);
              }}
              className="text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline"
            >
              See showtimes
              <ExternalLink className="size-3.5" aria-hidden />
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {formattedDate && (
              <MetaChip
                icon={<CalendarDays className="size-3.5" aria-hidden />}
                label={formattedDate}
              />
            )}
            {formattedRuntime && (
              <MetaChip
                icon={<Clock className="size-3.5" aria-hidden />}
                label={formattedRuntime}
              />
            )}
            {language && (
              <MetaChip
                icon={<Languages className="size-3.5" aria-hidden />}
                label={language}
              />
            )}
            {genres && genres.length > 0 && (
              <MetaChip
                icon={<Sparkles className="size-3.5" aria-hidden />}
                label={
                  genres.length > 2
                    ? `${genres.slice(0, 2).join(" • ")} +${genres.length - 2}`
                    : genres.join(" • ")
                }
              />
            )}
          </div>

          {description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}

          {castLine && (
            <div className="text-xs leading-relaxed text-muted-foreground">
              <span className="text-foreground">Cast:</span> {castLine}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
