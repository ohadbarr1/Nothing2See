import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegionSelector } from "@/components/RegionSelector";
import { TitleCard, TitleCardSkeleton } from "@/components/TitleCard";
import { ErrorMessage } from "@/components/ErrorMessage";
import { EmptyState } from "@/components/EmptyState";
import { useAppStore } from "@/store/appStore";
import { useSearch } from "@nothing2see/core";
import type { SupportedRegion, TitleType } from "@nothing2see/types";

const DEBOUNCE_MS = 300;

export function SearchPage() {
  const { region, setRegion } = useAppStore();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [type, setType] = useState<TitleType | undefined>(undefined);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, isError, error } = useSearch(
    {
      q: debouncedQuery,
      region,
      type,
      page: 1,
      limit: 20,
    },
    debouncedQuery.trim().length > 0
  );

  const titles =
    data?.success === true
      ? data.data
      : [];

  const handleClear = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
  }, []);

  const showSkeletons = isLoading && debouncedQuery.trim().length > 0;
  const showEmpty =
    !isLoading &&
    !isError &&
    debouncedQuery.trim().length > 0 &&
    titles.length === 0;
  const showPrompt = debouncedQuery.trim().length === 0 && !isLoading;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search Titles</h1>
        <p className="text-muted-foreground mt-1">
          Find movies &amp; shows and see where they're streaming in your region.
        </p>
      </div>

      {/* Search controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for a movie or show..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-10"
            autoFocus
          />
          {query.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Type filter */}
        <Select
          value={type ?? "all"}
          onValueChange={(v) =>
            setType(v === "all" ? undefined : (v as TitleType))
          }
        >
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="movie">Movies</SelectItem>
            <SelectItem value="series">TV Series</SelectItem>
          </SelectContent>
        </Select>

        {/* Region selector */}
        <RegionSelector
          value={region}
          onChange={setRegion as (r: SupportedRegion) => void}
          className="w-full sm:w-36"
        />
      </div>

      {/* Meta info */}
      {data?.success === true && data.meta && debouncedQuery.trim().length > 0 && (
        <p className="text-sm text-muted-foreground">
          Found{" "}
          <span className="font-semibold text-foreground">
            {data.meta.total?.toLocaleString() ?? titles.length}
          </span>{" "}
          results for &ldquo;{debouncedQuery}&rdquo;
        </p>
      )}

      {/* Error */}
      {isError && (
        <ErrorMessage
          message={
            error?.message ?? "Failed to search titles. Is the API running?"
          }
        />
      )}

      {/* Prompt */}
      {showPrompt && (
        <EmptyState
          icon="🔍"
          title="Start typing to search"
          description="Search for any movie or TV show to see where it's available for streaming."
        />
      )}

      {/* Empty results */}
      {showEmpty && (
        <EmptyState
          icon="😶"
          title="No results found"
          description={`We couldn't find any ${type ?? "titles"} matching "${debouncedQuery}". Try a different search.`}
        />
      )}

      {/* Results grid */}
      {(showSkeletons || titles.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {showSkeletons
            ? Array.from({ length: 12 }).map((_, i) => (
                <TitleCardSkeleton key={i} />
              ))
            : titles.map((title) => (
                <TitleCard key={title.tmdb_id} title={title} />
              ))}
        </div>
      )}
    </div>
  );
}
