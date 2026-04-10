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
    <div className="flex gap-3 flex-wrap mb-4">
      {counters.map(c => {
        const days = calcDays(c.type, c.counterDate);
        const isSince = c.type === "since";

        // Colour logic
        const numColor =
          isSince
            ? days > 0 ? "text-[#85FF00]" : "text-muted-foreground"
            : days > 0 ? "text-[#FF6E00]" : days === 0 ? "text-[#85FF00]" : "text-red-400";

        const badgeLabel = isSince ? "Days Since" : "Days Until";
        const badgeColor = isSince
          ? "text-[#85FF00]/70 border-[#85FF00]/20 bg-[#85FF00]/5"
          : "text-[#FF6E00]/70 border-[#FF6E00]/20 bg-[#FF6E00]/5";

        const displayDays = Math.abs(days);

        return (
          <div
            key={c.id}
            className="flex-1 min-w-[120px] max-w-[180px] rounded-xl border border-border bg-muted/20 px-4 py-3 flex flex-col items-center text-center gap-1"
            data-testid={`day-counter-${c.id}`}
          >
            {/* Badge */}
            <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full border ${badgeColor}`}>
              {badgeLabel}
            </span>

            {/* Big number */}
            <span className={`text-3xl font-black leading-none tabular-nums ${numColor}`}>
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
