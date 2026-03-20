import { useState } from "react";
import { Compass, SlidersHorizontal } from "lucide-react";
import { RegionSelector } from "@/components/RegionSelector";
import { ServiceSelector } from "@/components/ServiceSelector";
import { TitleCard, TitleCardSkeleton } from "@/components/TitleCard";
import { ErrorMessage } from "@/components/ErrorMessage";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/appStore";
import { useDiscover } from "@nothing2see/core";
import { STREAMING_SERVICES, type SupportedRegion, type TitleType } from "@nothing2see/types";

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

export function DiscoverPage() {
  const { region, setRegion, selectedServices, toggleService, setServices, clearServices } =
    useAppStore();

  const [type, setType] = useState<TitleType | undefined>(undefined);
  const [genre, setGenre] = useState<string | undefined>(undefined);
  const [minRating, setMinRating] = useState<number | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data, isLoading, isError, error } = useDiscover(
    {
      region,
      services: selectedServices,
      type,
      genre,
      min_rating: minRating,
    },
    selectedServices.length > 0
  );

  const titles = data?.success === true ? data.data : [];

  const handleSelectAll = () => {
    setServices(STREAMING_SERVICES.map((s) => s.id));
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Compass className="h-8 w-8 text-primary" />
            Discover
          </h1>
          <p className="text-muted-foreground mt-1">
            Top 30 titles ranked by IMDb score for your selected streaming services.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex-shrink-0 mt-1"
          onClick={() => setFiltersOpen((prev) => !prev)}
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Region */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Region
            </h2>
            <RegionSelector
              value={region}
              onChange={setRegion as (r: SupportedRegion) => void}
              className="w-full"
            />
          </div>

          <Separator />

          {/* Services */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Streaming Services
            </h2>
            <ServiceSelector
              selected={selectedServices}
              onToggle={toggleService}
              onSelectAll={handleSelectAll}
              onClearAll={clearServices}
            />
          </div>

          {/* Extra filters — collapsible on mobile */}
          {filtersOpen && (
            <>
              <Separator />
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Filters
                </h2>

                {/* Type */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Type
                  </label>
                  <Select
                    value={type ?? "all"}
                    onValueChange={(v) =>
                      setType(v === "all" ? undefined : (v as TitleType))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="movie">Movies</SelectItem>
                      <SelectItem value="series">TV Series</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Genre */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Genre
                  </label>
                  <Select
                    value={genre ?? "all"}
                    onValueChange={(v) =>
                      setGenre(v === "all" ? undefined : v)
                    }
                  >
                    <SelectTrigger className="w-full">
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

                {/* Min Rating */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Min IMDb Rating
                  </label>
                  <Select
                    value={minRating?.toString() ?? "any"}
                    onValueChange={(v) =>
                      setMinRating(v === "any" ? undefined : parseFloat(v))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Any rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any rating</SelectItem>
                      <SelectItem value="5">5.0+</SelectItem>
                      <SelectItem value="6">6.0+</SelectItem>
                      <SelectItem value="7">7.0+</SelectItem>
                      <SelectItem value="7.5">7.5+</SelectItem>
                      <SelectItem value="8">8.0+</SelectItem>
                      <SelectItem value="8.5">8.5+</SelectItem>
                      <SelectItem value="9">9.0+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Main content */}
        <section className="space-y-4">
          {/* Status bar */}
          {data?.success === true && titles.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {titles.length}
              </span>{" "}
              top titles for{" "}
              <span className="font-semibold text-foreground">
                {selectedServices.length} service
                {selectedServices.length !== 1 ? "s" : ""}
              </span>{" "}
              in{" "}
              <span className="font-semibold text-foreground">{region}</span>
            </p>
          )}

          {/* Error */}
          {isError && (
            <ErrorMessage
              message={
                error?.message ??
                "Failed to fetch top titles. Is the API running?"
              }
            />
          )}

          {/* No services selected */}
          {!isLoading && selectedServices.length === 0 && (
            <EmptyState
              icon="📺"
              title="Select streaming services"
              description="Choose at least one streaming service from the sidebar to see top titles."
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

          {/* Empty results after load */}
          {!isLoading &&
            !isError &&
            selectedServices.length > 0 &&
            titles.length === 0 && (
              <EmptyState
                icon="🤷"
                title="No titles found"
                description="Try adjusting your filters or selecting different services."
              />
            )}

          {/* Results grid */}
          {!isLoading && titles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
              {titles.map((title, index) => (
                <TitleCard
                  key={title.tmdb_id}
                  title={title}
                  rank={index + 1}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
