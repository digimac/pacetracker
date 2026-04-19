import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type DayCounter = {
  id: number;
  type: "since" | "until";
  label: string;
  counterDate: string; // YYYY-MM-DD
};

function calcDays(type: "since" | "until", dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ref = new Date(dateStr + "T00:00:00");
  ref.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - ref.getTime()) / 86_400_000);
  return type === "since" ? diff : -diff;
}

export function DayCountersStrip() {
  const { data: counters = [] } = useQuery<DayCounter[]>({
    queryKey: ["/api/day-counters"],
    queryFn: () => apiRequest("GET", "/api/day-counters").then(r => r.json()),
    staleTime: 60_000,
  });

  if (counters.length === 0) return null;

  return (
    <div
      className="grid mb-4 gap-2"
      style={{ gridTemplateColumns: `repeat(${counters.length}, 1fr)` }}
    >
      {counters.map(c => {
        const days = calcDays(c.type, c.counterDate);
        const isSince = c.type === "since";

        // Colour logic — use CSS var for accent green so it adapts to light/dark
        const G = "var(--color-accent-green)";
        const numStyle: React.CSSProperties | undefined =
          isSince
            ? (days > 0 ? { color: G } : undefined)
            : (days > 0 ? undefined : days === 0 ? { color: G } : undefined);
        const numClass =
          isSince
            ? (days > 0 ? "" : "text-muted-foreground")
            : (days > 0 ? "text-[#FF6E00]" : days === 0 ? "" : "text-red-400");

        const badgeLabel = isSince ? "Days Since" : "Days Until";
        const badgeStyle: React.CSSProperties = isSince
          ? { color: G, borderColor: "rgba(74,146,0,0.3)", background: "rgba(74,146,0,0.07)" }
          : { color: "#FF6E00", borderColor: "rgba(255,110,0,0.3)", background: "rgba(255,110,0,0.07)" };

        const displayDays = Math.abs(days);

        return (
          <div
            key={c.id}
            className="rounded-xl border border-border bg-muted/20 px-3 py-3 flex flex-col items-center text-center gap-1 min-w-0"
            data-testid={`day-counter-${c.id}`}
          >
            {/* Badge */}
            <span className="text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border" style={badgeStyle}>
              {badgeLabel}
            </span>

            {/* Big number */}
            <span className={`text-3xl font-black leading-none tabular-nums ${numClass}`} style={numStyle}>
              {displayDays}
            </span>

            {/* Label */}
            <span className="text-[11px] text-muted-foreground leading-tight font-medium">
              {c.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
