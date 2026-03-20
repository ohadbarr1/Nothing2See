import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SearchPage } from "./pages/SearchPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { LoginPage } from "./pages/LoginPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { WatchlistPage } from "./pages/WatchlistPage";
import { NewReleasesPage } from "./pages/NewReleasesPage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";
import { AuthGuard } from "./components/AuthGuard";
import { useAppStore } from "./store/appStore";
import { apiClient, setTokenGetter } from "@nothing2see/core";

export default function App() {
  const { user, setToken, logout } = useAppStore();

  // On app mount: if user is in store (persisted), try to refresh the access token
  // so they don't have to re-login after a page reload.
  useEffect(() => {
    if (!user) return;

    // Attempt silent token refresh via the httpOnly cookie
    apiClient
      .refreshToken()
      .then((res) => {
        if (res.success) {
          setToken(res.data.access_token);
          // Wire up the token getter for future API calls
          setTokenGetter(() => res.data.access_token);
        } else {
          // Refresh token is invalid/expired — clear auth state
          logout();
        }
      })
      .catch(() => {
        // Network error or no refresh cookie — clear auth state
        logout();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/search" replace />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/new" element={<NewReleasesPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route
          path="/watchlist"
          element={
            <AuthGuard>
              <WatchlistPage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/search" replace />} />
      </Route>
    </Routes>
  );
}
