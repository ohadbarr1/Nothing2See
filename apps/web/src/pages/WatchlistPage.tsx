import { Bookmark, Eye, EyeOff, Trash2, AlertTriangle } from "lucide-react";
import { useWatchlist, useRemoveFromWatchlist, useMarkWatched } from "@nothing2see/core";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const FALLBACK_POSTER =
  "https://via.placeholder.com/300x450/1e293b/94a3b8?text=No+Poster";

export function WatchlistPage() {
  const { data, isLoading, isError, error } = useWatchlist(true);
  const removeMutation = useRemoveFromWatchlist();
  const watchedMutation = useMarkWatched();

  const items = data?.success ? data.data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Bookmark className="h-8 w-8 text-primary" />
          My Watchlist
        </h1>
        <p className="text-muted-foreground mt-1">
          Titles you've saved. Toggle watched status or remove titles anytime.
        </p>
      </div>

      {/* Error */}
      {isError && (
        <ErrorMessage
          message={error?.message ?? "Failed to load watchlist."}
        />
      )}

      {/* Empty */}
      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          icon="🔖"
          title="Your watchlist is empty"
          description="Add titles from Search or Discover using the bookmark icon on each card."
        />
      )}

      {/* Grid */}
      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => {
            const t = item.title;
            const posterSrc = t?.poster_url ?? FALLBACK_POSTER;
            const isPending =
              removeMutation.isPending || watchedMutation.isPending;

            return (
              <div
                key={item.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5",
                  item.watched && "opacity-60"
                )}
              >
                {/* Poster */}
                <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                  <img
                    src={posterSrc}
                    alt={t?.title ?? "Poster"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />

                  {/* Not available badge */}
                  {item.available_on_user_services === false &&
                    item.availability.length === 0 && (
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant="destructive"
                          className="flex items-center gap-1 text-[10px] px-1.5"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Unavailable
                        </Badge>
                      </div>
                    )}

                  {/* Watched overlay */}
                  {item.watched && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Eye className="h-8 w-8 text-white/80" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
                    {t?.title ?? `Title #${item.title_id}`}
                  </h3>
                  {t?.year && (
                    <p className="text-xs text-muted-foreground">{t.year}</p>
                  )}
                  {t?.imdb_rating != null && (
                    <Badge variant="imdb" className="self-start text-[10px] px-1.5">
                      IMDb {t.imdb_rating.toFixed(1)}
                    </Badge>
                  )}

                  {/* Actions */}
                  <div className="mt-auto flex gap-1 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[10px] px-2"
                      disabled={isPending}
                      onClick={() =>
                        watchedMutation.mutate({
                          tmdbId: item.title_id,
                          watched: !item.watched,
                        })
                      }
                      title={item.watched ? "Mark as unwatched" : "Mark as watched"}
                    >
                      {item.watched ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[10px] px-2 text-destructive hover:bg-destructive/10"
                      disabled={isPending}
                      onClick={() => removeMutation.mutate(item.title_id)}
                      title="Remove from watchlist"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading skeletons for item count */}
      {isLoading && items.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-lg border border-border/50 bg-card">
              <Skeleton className="aspect-[2/3] w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="h-7 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
