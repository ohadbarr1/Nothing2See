import { useState } from "react";
import { Sparkles } from "lucide-react";
import { TitleCard, TitleCardSkeleton } from "@/components/TitleCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorMessage } from "@/components/ErrorMessage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/store/appStore";
import { useNewReleases } from "@nothing2see/core";
import type { TitleType } from "@nothing2see/types";

const GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
];

export function NewReleasesPage() {
  const { region, selectedServices } = useAppStore();
  const [type, setType] = useState<TitleType | undefined>(undefined);
  const [genre, setGenre] = useState<string | undefined>(undefined);

  const { data, isLoading, isError, error } = useNewReleases(
    { region, services: selectedServices, type, genre },
    selectedServices.length > 0
  );

  const titles = data?.success === true ? data.data : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            New This Week
          </h1>
          <p className="text-muted-foreground mt-1">
            Titles added to your selected streaming services in the past 7 days, ranked by IMDb.
          </p>
        </div>

        {/* Quick filters */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Select
            value={type ?? "all"}
            onValueChange={(v) =>
              setType(v === "all" ? undefined : (v as TitleType))
            }
          >
            <SelectTrigger className="w-32 h-9 text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
              <SelectItem value="series">TV Series</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={genre ?? "all"}
            onValueChange={(v) => setGenre(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="All genres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All genres</SelectItem>
              {GENRES.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* No services */}
      {selectedServices.length === 0 && !isLoading && (
        <EmptyState
          icon="📺"
          title="Select streaming services first"
          description="Go to Discover, pick your services, and new arrivals will appear here."
        />
      )}

      {/* Error */}
      {isError && (
        <ErrorMessage
          message={error?.message ?? "Failed to fetch new releases. Is the API running?"}
        />
      )}

      {/* Loading */}
      {isLoading && selectedServices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <TitleCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Status */}
      {!isLoading && data?.success && titles.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Showing{" "}
          <span className="font-semibold text-foreground">{titles.length}</span>{" "}
          new arrivals in{" "}
          <span className="font-semibold text-foreground">{region}</span>
        </p>
      )}

      {/* Empty results */}
      {!isLoading &&
        !isError &&
        selectedServices.length > 0 &&
        titles.length === 0 && (
          <EmptyState
            icon="🌟"
            title="Nothing new this week"
            description="No new titles were added to your selected services in the past 7 days. Check back soon!"
          />
        )}

      {/* Results */}
      {!isLoading && titles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {titles.map((title, index) => (
            <TitleCard key={title.tmdb_id} title={title} rank={index + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
