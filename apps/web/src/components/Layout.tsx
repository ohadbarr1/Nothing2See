import { Outlet, NavLink } from "react-router-dom";
import { Search, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center gap-8">
          {/* Logo */}
          <NavLink to="/search" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl">🎬</span>
            <span className="font-bold text-lg text-foreground hidden sm:block">
              Nothing<span className="text-primary">2</span>See
            </span>
          </NavLink>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            <NavLink
              to="/search"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )
              }
            >
              <Search className="h-4 w-4" />
              Search
            </NavLink>
            <NavLink
              to="/discover"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )
              }
            >
              <Compass className="h-4 w-4" />
              Discover
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 container py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4">
        <div className="container text-center text-xs text-muted-foreground">
          Nothing2See &mdash; Streaming discovery powered by TMDB, OMDb &amp;
          Streaming Availability API
        </div>
      </footer>
    </div>
  );
}
