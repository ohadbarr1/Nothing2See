import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Search, Compass, Bookmark, Sparkles, LogIn, LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { apiClient } from "@nothing2see/core";
import { GdprBanner } from "@/components/GdprBanner";
import { Button } from "@/components/ui/button";

export function Layout() {
  const { user, logout } = useAppStore();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await apiClient.logout();
    } catch {
      // ignore
    }
    logout();
    navigate("/search", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center gap-6">
          {/* Logo */}
          <NavLink to="/search" className="flex items-center gap-2 flex-shrink-0">
            <span className="text-2xl">🎬</span>
            <span className="font-bold text-lg text-foreground hidden sm:block">
              Nothing<span className="text-primary">2</span>See
            </span>
          </NavLink>

          {/* Nav */}
          <nav className="flex items-center gap-1 flex-1">
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
            <NavLink
              to="/new"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )
              }
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">New This Week</span>
              <span className="sm:hidden">New</span>
            </NavLink>
            {user && (
              <NavLink
                to="/watchlist"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )
                }
              >
                <Bookmark className="h-4 w-4" />
                Watchlist
              </NavLink>
            )}
          </nav>

          {/* Auth actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <>
                <span className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  {user.display_name ?? user.email}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-1.5"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </>
            ) : (
              <NavLink to="/login">
                <Button size="sm" className="flex items-center gap-1.5">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 container py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4">
        <div className="container flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span>Nothing2See &mdash; Streaming discovery powered by TMDB, OMDb &amp; Streaming Availability API</span>
          <NavLink to="/privacy" className="hover:text-foreground transition-colors underline">
            Privacy Policy
          </NavLink>
        </div>
      </footer>

      {/* GDPR Banner */}
      <GdprBanner />
    </div>
  );
}
