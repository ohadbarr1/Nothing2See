import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/appStore";
import type { AuthUser } from "@/store/appStore";

/**
 * This page handles the redirect back from /api/v1/auth/google/callback.
 *
 * FIX-3: The backend no longer passes the access token in the URL.
 *   Instead, the backend sets the refresh token as an httpOnly cookie and
 *   redirects here with only `?user=<JSON>`.
 *   We call GET /api/v1/auth/refresh to exchange the cookie for an access token,
 *   store the result in Zustand (memory only), and then redirect.
 *
 * FIX-10: If there was a `?redirect=` param on the original /login URL (set by
 *   AuthGuard), we navigate there after login instead of always going to /discover.
 *   The backend preserves it through the OAuth flow via the `state` param redirect
 *   destination. As a simpler approach: we read it from sessionStorage if present.
 */
export function AuthCallbackPage() {
  const { login, setToken } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userRaw = params.get("user");

    // FIX-10: read the post-login destination that AuthGuard stored in sessionStorage
    const redirectTo = sessionStorage.getItem("post_login_redirect") ?? "/discover";
    sessionStorage.removeItem("post_login_redirect");

    async function exchangeToken() {
      // FIX-3: exchange the httpOnly refresh cookie for an access token
      try {
        const res = await fetch("/api/v1/auth/refresh", {
          method: "POST",
          credentials: "include", // send the httpOnly refresh cookie
        });

        if (!res.ok) {
          throw new Error(`Refresh failed: ${res.status}`);
        }

        const body = (await res.json()) as {
          success: boolean;
          data: {
            access_token: string;
            user?: AuthUser;
          };
        };

        if (!body.success || !body.data.access_token) {
          throw new Error("No access token in refresh response");
        }

        // Prefer the user object from the refresh response; fall back to URL param
        let user: AuthUser | null = body.data.user ?? null;
        if (!user && userRaw) {
          try {
            user = JSON.parse(decodeURIComponent(userRaw)) as AuthUser;
          } catch {
            // ignore parse error
          }
        }

        if (user) {
          login(user, body.data.access_token);
        } else {
          setToken(body.data.access_token);
        }

        // Clean up the URL before navigating
        window.history.replaceState({}, "", redirectTo);
        navigate(redirectTo, { replace: true });
      } catch {
        navigate("/login?error=callback_parse", { replace: true });
      }
    }

    exchangeToken();
  }, [login, setToken, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground text-sm">Signing you in...</p>
    </div>
  );
}
