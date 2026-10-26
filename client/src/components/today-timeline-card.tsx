import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DaySparkline, TimelineEvent, CORE_METRIC_COLORS, getMetricColor } from "@/components/day-sparkline";

/**
 * Today's Activity Timeline: every Win/Loss tapped today, plotted by time of day, with a
 * legend. Shared by Today (quick view while scoring) and the Dashboard. Hidden until the
 * first tap so a fresh day goes straight to the metric buttons.
 */
export function TodayTimelineCard({ className = "" }: { className?: string }) {
  const { data: timeline = [] } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/today/timeline"],
    queryFn: () => apiRequest("GET", "/api/today/timeline").then(r => r.json()),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: timelineBg } = useQuery<{ heroImageUrl: string | null } | null>({
    queryKey: ["/api/pages", "timeline"],
    queryFn: () => apiRequest("GET", "/api/pages/timeline").then(r => (r.ok ? r.json() : null)).catch(() => null),
    staleTime: 5 * 60 * 1000,
  });
  const timelineBgUrl = timelineBg?.heroImageUrl?.trim() || null;

  if (timeline.length === 0) return null;

  let customIdx = 0;
  return (
    <Card className={`relative overflow-hidden ${className}`} data-testid="card-today-timeline">
      {/* Admin-configured background image, faded */}
      {timelineBgUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{ backgroundImage: `url(${timelineBgUrl})`, opacity: 0.18 }}
        />
      )}
      <CardHeader className="pb-1 pt-4 px-4 relative">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Today's Activity Timeline</CardTitle>
        <p className="text-[10px] text-foreground/70 mt-0.5">Metric scores plotted across the day · tap or hover a dot for details</p>
      </CardHeader>
      <CardContent className="px-3 pb-2 relative">
        <DaySparkline events={timeline} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 px-1">
          {timeline.map(ev => {
            const isCustom = !CORE_METRIC_COLORS[ev.metricKey];
            const color = getMetricColor(ev.metricKey, isCustom ? customIdx++ : 0);
            return (
              <div key={ev.metricKey} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[9px] font-bold tracking-widest text-foreground/80">{ev.metricLabel}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
