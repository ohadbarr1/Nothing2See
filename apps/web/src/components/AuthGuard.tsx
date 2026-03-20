import { Navigate, useLocation } from "react-router-dom";
import { useAppStore } from "@/store/appStore";
import type { ReactNode } from "react";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const user = useAppStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    // FIX-10: preserve the intended destination so after login the user lands where they wanted.
    // We store it in sessionStorage so it survives the OAuth redirect round-trip.
    const destination = location.pathname + location.search;
    if (destination !== "/" && destination !== "/login") {
      sessionStorage.setItem("post_login_redirect", destination);
    }
    const redirectParam = encodeURIComponent(destination);
    return <Navigate to={`/login?redirect=${redirectParam}`} replace />;
  }

  return <>{children}</>;
}
