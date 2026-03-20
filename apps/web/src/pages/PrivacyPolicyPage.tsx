import { Shield } from "lucide-react";

export function PrivacyPolicyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Privacy Policy
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Last updated: March 2026
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What data we store</h2>
        <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Email address</strong> — used solely to identify
            your account. Obtained from Google during sign-in.
          </li>
          <li>
            <strong className="text-foreground">Display name</strong> — your Google profile name,
            shown in the navigation bar.
          </li>
          <li>
            <strong className="text-foreground">Region preference</strong> — the streaming region
            you select (e.g. US, GB). Stored to personalise results.
          </li>
          <li>
            <strong className="text-foreground">Streaming service selections</strong> — which
            services you choose to filter by. Stored so your preferences persist across sessions.
          </li>
          <li>
            <strong className="text-foreground">Watchlist</strong> — the titles you bookmark,
            including whether you've marked them as watched. Up to 100 items per account.
          </li>
          <li>
            <strong className="text-foreground">Availability reports</strong> — if you report
            incorrect availability, we store the title, region, service, and optional notes you
            provide.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">How we use cookies</h2>
        <p className="text-sm text-muted-foreground">
          We use a single <strong className="text-foreground">httpOnly cookie</strong> to store a
          refresh token for your session. This cookie is essential for keeping you signed in and
          cannot be accessed by JavaScript. No advertising or tracking cookies are used.
        </p>
        <p className="text-sm text-muted-foreground">
          We also use <strong className="text-foreground">localStorage</strong> to remember your
          streaming service selections and region, so these persist between visits without requiring
          a server round-trip.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Third-party services</h2>
        <ul className="list-disc list-inside space-y-1.5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">Google OAuth</strong> — used for sign-in only. We
            do not share your data with Google beyond the authentication flow.
          </li>
          <li>
            <strong className="text-foreground">TMDB, OMDb, Streaming Availability API</strong> —
            used to fetch movie/TV metadata and streaming availability. Your identity is not shared
            with these services.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Data retention and deletion</h2>
        <p className="text-sm text-muted-foreground">
          Your data is retained for as long as your account is active. To request deletion of your
          account and all associated data, contact us at{" "}
          <a
            href="mailto:privacy@nothing2see.app"
            className="underline hover:text-foreground"
          >
            privacy@nothing2see.app
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Your rights (GDPR)</h2>
        <p className="text-sm text-muted-foreground">
          If you are located in the EU/EEA, you have the right to access, rectify, or erase your
          personal data. You also have the right to restrict or object to processing, and the right
          to data portability. To exercise any of these rights, please contact{" "}
          <a
            href="mailto:privacy@nothing2see.app"
            className="underline hover:text-foreground"
          >
            privacy@nothing2see.app
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Changes to this policy</h2>
        <p className="text-sm text-muted-foreground">
          We may update this policy occasionally. When we do, we will update the date at the top of
          this page. Continued use of the service after changes constitutes acceptance of the new
          policy.
        </p>
      </section>
    </div>
  );
}
