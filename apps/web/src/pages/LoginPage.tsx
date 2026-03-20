import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/appStore";

export function LoginPage() {
  const user = useAppStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate("/discover", { replace: true });
  }, [user, navigate]);

  const error = new URLSearchParams(window.location.search).get("error");

  function handleGoogleSignIn() {
    // Redirect to backend OAuth flow
    window.location.href = `${import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:3001"}/api/v1/auth/google`;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to Nothing<span className="text-primary">2</span>See
        </h1>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Sign in to save your watchlist, get personalised recommendations, and track what's new on your streaming services.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive max-w-sm w-full text-center">
          {error === "oauth_denied" && "Sign-in was cancelled. Please try again."}
          {error === "token_exchange" && "Authentication failed. Please try again."}
          {error === "userinfo" && "Could not fetch your Google profile. Please try again."}
          {error === "db_error" && "A server error occurred. Please try again later."}
          {!["oauth_denied", "token_exchange", "userinfo", "db_error"].includes(error) &&
            "An unknown error occurred."}
        </div>
      )}

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="flex items-center gap-3 rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent transition-colors"
      >
        {/* Google icon */}
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
        </svg>
        Continue with Google
      </button>

      <p className="text-xs text-muted-foreground text-center max-w-xs">
        By signing in you agree to our{" "}
        <a href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </a>
        . We only use your email to identify your account.
      </p>
    </div>
  );
}
