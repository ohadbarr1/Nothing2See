import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_REGIONS, type SupportedRegion } from "@nothing2see/types";

const REGION_LABELS: Record<SupportedRegion, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  IL: "Israel",
  JP: "Japan",
  BR: "Brazil",
  IN: "India",
};

const REGION_FLAGS: Record<SupportedRegion, string> = {
  US: "🇺🇸",
  GB: "🇬🇧",
  CA: "🇨🇦",
  AU: "🇦🇺",
  DE: "🇩🇪",
  FR: "🇫🇷",
  IL: "🇮🇱",
  JP: "🇯🇵",
  BR: "🇧🇷",
  IN: "🇮🇳",
};

interface RegionSelectorProps {
  value: SupportedRegion;
  onChange: (region: SupportedRegion) => void;
  className?: string;
}

export function RegionSelector({ value, onChange, className }: RegionSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SupportedRegion)}>
      <SelectTrigger className={className}>
        <SelectValue>
          <span className="flex items-center gap-2">
            <span>{REGION_FLAGS[value]}</span>
            <span>{value}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_REGIONS.map((region) => (
          <SelectItem key={region} value={region}>
            <span className="flex items-center gap-2">
              <span>{REGION_FLAGS[region]}</span>
              <span>{REGION_LABELS[region]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
