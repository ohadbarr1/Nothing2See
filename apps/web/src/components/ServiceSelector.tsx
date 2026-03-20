import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { STREAMING_SERVICES } from "@nothing2see/types";
import { cn } from "@/lib/utils";

interface ServiceSelectorProps {
  selected: string[];
  onToggle: (serviceId: string) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  className?: string;
}

const SERVICE_COLORS: Record<string, string> = {
  netflix: "text-red-500",
  "amazon-prime-video": "text-sky-400",
  "disney-plus": "text-blue-600",
  "hbo-max": "text-purple-500",
  "apple-tv-plus": "text-gray-200",
  hulu: "text-green-400",
  "paramount-plus": "text-blue-400",
  peacock: "text-indigo-400",
};

export function ServiceSelector({
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  className,
}: ServiceSelectorProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Bulk actions */}
      <div className="flex items-center gap-2">
        {onSelectAll && (
          <Button variant="outline" size="sm" onClick={onSelectAll}>
            All
          </Button>
        )}
        {onClearAll && (
          <Button variant="outline" size="sm" onClick={onClearAll}>
            None
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {selected.length} selected
        </span>
      </div>

      {/* Service checkboxes */}
      <div className="grid grid-cols-2 gap-2">
        {STREAMING_SERVICES.map((service) => {
          const isChecked = selected.includes(service.id);
          return (
            <div
              key={service.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded-md border border-border/50 cursor-pointer transition-colors",
                isChecked
                  ? "bg-accent border-primary/50"
                  : "hover:bg-accent/30"
              )}
              onClick={() => onToggle(service.id)}
            >
              <Checkbox
                id={`service-${service.id}`}
                checked={isChecked}
                onCheckedChange={() => onToggle(service.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <Label
                htmlFor={`service-${service.id}`}
                className={cn(
                  "cursor-pointer text-sm font-medium",
                  SERVICE_COLORS[service.id] ?? "text-foreground"
                )}
              >
                {service.name}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
