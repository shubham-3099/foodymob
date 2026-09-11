import { useState } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { LOCATIONS } from "@/data/seed";
import { useStore } from "@/lib/store";

export function LocationHeader() {
  const { location, setLocation } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = LOCATIONS.filter((l) => l.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex max-w-full items-center gap-2 rounded-full py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <MapPin
          className="h-[18px] w-[18px] shrink-0 text-foreground"
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span className="truncate text-[15px] font-semibold text-foreground">{location}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-11 z-30 rounded-2xl border border-border bg-background p-3 shadow-lg">
          <label className="sr-only" htmlFor="loc-search">
            Search sample locations
          </label>
          <input
            id="loc-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sample locations"
            className="h-10 w-full rounded-full border border-border bg-muted px-4 text-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          />
          <ul className="mt-2 max-h-56 overflow-auto">
            {matches.map((l) => (
              <li key={l}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await setLocation(l);
                    } catch {
                      return;
                    }
                    setOpen(false);
                    setQuery("");
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-[14px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-foreground"
                >
                  {l}
                </button>
              </li>
            ))}
            {matches.length === 0 && (
              <li className="px-3 py-3 text-[13px] text-muted-foreground">
                No matching sample location. This demo has a fixed list and no real geolocation.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
