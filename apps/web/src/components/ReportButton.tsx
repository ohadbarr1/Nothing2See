import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/appStore";
import { apiClient } from "@nothing2see/core";
import { STREAMING_SERVICES, SUPPORTED_REGIONS } from "@nothing2see/types";

interface ReportButtonProps {
  tmdbId: number;
}

export function ReportButton({ tmdbId }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState("US");
  const [serviceSlug, setServiceSlug] = useState("netflix");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const storeRegion = useAppStore((s) => s.region);

  function handleOpen() {
    setRegion(storeRegion);
    setStatus("idle");
    setNotes("");
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await apiClient.reportAvailability(tmdbId, {
        region,
        service_slug: serviceSlug,
        notes: notes.trim() || undefined,
      });
      if (res.success) {
        setStatus("success");
        setTimeout(() => setOpen(false), 1500);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
        title="Report incorrect availability"
      >
        <Flag className="h-3 w-3" />
        Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background border border-border rounded-lg p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-4">Report Incorrect Availability</h2>
            {status === "success" ? (
              <p className="text-sm text-green-500">Thank you for your report!</p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Region
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {SUPPORTED_REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Service
                  </label>
                  <select
                    value={serviceSlug}
                    onChange={(e) => setServiceSlug(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  >
                    {STREAMING_SERVICES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe the issue..."
                    maxLength={1000}
                    rows={3}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>
                {status === "error" && (
                  <p className="text-xs text-destructive">Failed to submit report. Try again.</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOpen(false)}
                    disabled={status === "loading"}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={status === "loading"}>
                    {status === "loading" ? "Submitting..." : "Submit"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
