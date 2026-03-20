import { useState } from "react";
import type { Title } from "@nothing2see/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Tv, Film, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";

interface TitleCardProps {
  title: Title;
  rank?: number;
  className?: string;
}

const SERVICE_COLORS: Record<string, string> = {
  netflix: "bg-red-600 text-white",
  "amazon-prime-video": "bg-sky-500 text-white",
  "disney-plus": "bg-blue-700 text-white",
  "hbo-max": "bg-purple-700 text-white",
  "apple-tv-plus": "bg-gray-800 text-white border border-gray-600",
  hulu: "bg-green-500 text-white",
  "paramount-plus": "bg-blue-500 text-white",
  peacock: "bg-indigo-500 text-white",
};

const SERVICE_SHORT: Record<string, string> = {
  netflix: "Netflix",
  "amazon-prime-video": "Prime",
  "disney-plus": "Disney+",
  "hbo-max": "Max",
  "apple-tv-plus": "Apple TV+",
  hulu: "Hulu",
  "paramount-plus": "Paramount+",
  peacock: "Peacock",
};

const FALLBACK_POSTER = "https://via.placeholder.com/300x450/1e293b/94a3b8?text=No+Poster";

export function TitleCard({ title, rank, className }: TitleCardProps) {
  const [imgError, setImgError] = useState(false);
  const { region } = useAppStore();

  const uniqueServices = Array.from(
    new Map(
      (title.availability ?? []).map((a) => [a.service_id, a])
    ).values()
  );

  const posterSrc =
    !imgError && title.poster_url ? title.poster_url : FALLBACK_POSTER;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5",
        className
      )}
    >
      {/* Rank badge */}
      {rank !== undefined && (
        <div className="absolute top-2 left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-xs font-bold text-white ring-1 ring-white/20">
          {rank}
        </div>
      )}

      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        <img
          src={posterSrc}
          alt={title.title}
          loading="lazy"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Rating overlay — labelled as IMDb or TMDB depending on source */}
        {title.imdb_rating !== null && title.imdb_rating !== undefined && (
          <div className="absolute bottom-2 right-2">
            <Badge
              variant={title.rating_source === "tmdb" ? "secondary" : "imdb"}
              className="flex items-center gap-1 text-xs"
            >
              <Star className="h-3 w-3 fill-current" />
              {title.rating_source === "tmdb" ? "TMDB" : "IMDb"}{" "}
              {title.imdb_rating.toFixed(1)}
            </Badge>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="px-1.5 py-0.5">
            {title.type === "movie" ? (
              <Film className="h-3 w-3" />
            ) : (
              <Tv className="h-3 w-3" />
            )}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3
            className="line-clamp-2 text-sm font-semibold leading-tight text-foreground"
            title={title.title}
          >
            {title.title}
          </h3>
          {title.year && (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {title.year}
            </div>
          )}
        </div>

        {/* Genres */}
        {title.genres && title.genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {title.genres.slice(0, 2).map((genre) => (
              <Badge
                key={genre}
                variant="outline"
                className="px-1.5 py-0 text-[10px]"
              >
                {genre}
              </Badge>
            ))}
          </div>
        )}

        {/* Streaming services */}
        {uniqueServices.length > 0 ? (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {uniqueServices.slice(0, 4).map((avail) => (
              <span
                key={avail.service_id}
                className={cn(
                  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold",
                  SERVICE_COLORS[avail.service_id] ??
                    "bg-muted text-muted-foreground"
                )}
              >
                {SERVICE_SHORT[avail.service_id] ?? avail.service_name}
              </span>
            ))}
            {uniqueServices.length > 4 && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">
                +{uniqueServices.length - 4}
              </span>
            )}
          </div>
        ) : (
          <div className="mt-auto pt-1 space-y-0.5">
            <p className="text-[10px] text-muted-foreground italic">
              Not available in {region}
            </p>
            {title.cross_region_hint && (
              <p className="text-[10px] text-muted-foreground/70 italic">
                {title.cross_region_hint}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TitleCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card">
      <Skeleton className="aspect-[2/3] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/4" />
        <div className="flex gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-4 w-14" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>
    </div>
  );
}
