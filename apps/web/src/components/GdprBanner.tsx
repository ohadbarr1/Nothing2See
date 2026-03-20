import { useAppStore } from "@/store/appStore";
import { Button } from "@/components/ui/button";

export function GdprBanner() {
  const { gdprAccepted, setGdprAccepted } = useAppStore();

  if (gdprAccepted) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur shadow-lg">
      <div className="container flex flex-col sm:flex-row items-start sm:items-center gap-3 py-4">
        <p className="flex-1 text-sm text-muted-foreground">
          We use cookies for session management and to remember your streaming service preferences.
          See our{" "}
          <a
            href="/privacy"
            className="underline hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>{" "}
          for details.
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setGdprAccepted(false)}
            className="text-muted-foreground"
          >
            Decline
          </Button>
          <Button size="sm" onClick={() => setGdprAccepted(true)}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
