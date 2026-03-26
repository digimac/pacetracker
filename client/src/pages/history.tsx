import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  format, subMonths, addMonths, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameMonth, isToday, isFuture,
  subDays, startOfYear, endOfYear, parseISO,
} from "date-fns";
import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Minus,
  X, Save, CalendarDays, List, TrendingUp, Award, Target,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { MetricScore, CustomMetric } from "@shared/schema";
import { DaySparkline } from "@/components/day-sparkline";
import type { TimelineEvent } from "@/components/day-sparkline";

// ─── Types ───────────────────────────────────────────────────────────────────

type GoalEntry = { entryDate: string; goalText: string };

type DayResult = {
  entry: { id: number; entryDate: string; notes?: string | null };
  scores: { metricKey: string; metricLabel: string; rating: string }[];
  successCount: number;
  setbackCount: number;
  total: number;
};

type Rating = "success" | "setback" | "skip";

const CORE_METRICS = [
  { key: "TIME", label: "TIME" },
  { key: "GOAL", label: "GOAL" },
  { key: "TEAM", label: "TEAM" },
  { key: "TASK", label: "TASK" },
  { key: "VIEW", label: "VIEW" },
  { key: "PACE", label: "PACE" },
];

// ─── Calendar Cell ────────────────────────────────────────────────────────────

function CalendarCell({
  date,
  result,
  isCurrentMonth,
  onClick,
}: {
  date: Date;
  result: DayResult | undefined;
  isCurrentMonth: boolean;
  onClick: () => void;
}) {
  const future = isFuture(date) && !isToday(date);
  const today = isToday(date);
  const hasEntry = !!result;
  const score = result?.total ?? null;

  let bgClass = "bg-transparent hover:bg-muted/60";
  let scoreColor = "text-muted-foreground";
  let borderClass = "border-transparent";

  if (today) borderClass = "border-primary/60";
  if (hasEntry && score !== null) {
    if (score > 0) { bgClass = "bg-green-500/10 hover:bg-green-500/20"; scoreColor = "text-green-400"; borderClass = today ? "border-primary/60" : "border-green-500/20"; }
    else if (score < 0) { bgClass = "bg-red-500/10 hover:bg-red-500/20"; scoreColor = "text-red-400"; borderClass = today ? "border-primary/60" : "border-red-500/20"; }
    else { bgClass = "bg-muted/40 hover:bg-muted/70"; scoreColor = "text-muted-foreground"; }
  }

  return (
    <button
      onClick={future ? undefined : onClick}
      disabled={future}
      className={`
        relative rounded-lg border p-1.5 text-left transition-all duration-150 aspect-square
        flex flex-col items-start justify-between
        ${bgClass} ${borderClass}
        ${!isCurrentMonth ? "opacity-30" : ""}
        ${future ? "cursor-default opacity-20" : "cursor-pointer"}
        ${today ? "ring-1 ring-primary/40" : ""}
        min-h-[44px] md:min-h-[56px]
      `}
      data-testid={`cal-day-${format(date, "yyyy-MM-dd")}`}
    >
      <span className={`text-[11px] font-bold leading-none ${today ? "text-primary" : "text-foreground/70"}`}>
        {format(date, "d")}
      </span>
      {hasEntry && score !== null && (
        <span className={`text-[11px] font-black leading-none self-end ${scoreColor}`}>
          {score > 0 ? `+${score}` : score}
        </span>
      )}
      {!hasEntry && !future && isCurrentMonth && (
        <span className="text-[9px] text-muted-foreground/30 self-end leading-none">—</span>
      )}
    </button>
  );
}

// ─── Day Detail Drawer ────────────────────────────────────────────────────────

function DayDrawer({
  date,
  existingResult,
  customMetrics,
  onClose,
}: {
  date: Date;
  existingResult: DayResult | undefined;
  customMetrics: CustomMetric[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const dateStr = format(date, "yyyy-MM-dd");
  const isPast = !isToday(date);

  const [ratings, setRatings] = useState<Record<string, Rating>>(() => {
    const map: Record<string, Rating> = {};
    if (existingResult) {
      existingResult.scores.forEach(s => { map[s.metricKey] = s.rating as Rating; });
    }
    CORE_METRICS.forEach(m => { if (!map[m.key]) map[m.key] = "skip"; });
    customMetrics.forEach(m => { if (!map[`custom_${m.id}`]) map[`custom_${m.id}`] = "skip"; });
    return map;
  });
  const [notes, setNotes] = useState(existingResult?.entry.notes || "");

  // Fetch timestamp timeline for this date
  const { data: timeline = [] } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/entries", dateStr, "timeline"],
    queryFn: () => apiRequest("GET", `/api/entries/${dateStr}/timeline`).then(r => r.json()),
    enabled: !!existingResult, // only fetch if there's actually a score for this day
    staleTime: 60_000,
  });

  // Re-init if existingResult changes (e.g., loaded async)
  useEffect(() => {
    const map: Record<string, Rating> = {};
    if (existingResult) {
      existingResult.scores.forEach(s => { map[s.metricKey] = s.rating as Rating; });
    }
    CORE_METRICS.forEach(m => { if (!map[m.key]) map[m.key] = "skip"; });
    customMetrics.forEach(m => { if (!map[`custom_${m.id}`]) map[`custom_${m.id}`] = "skip"; });
    setRatings(map);
    setNotes(existingResult?.entry.notes || "");
  }, [existingResult]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const allMetrics = [
        ...CORE_METRICS.map(m => ({ metricKey: m.key, metricLabel: m.label })),
        ...customMetrics.map(m => ({ metricKey: `custom_${m.id}`, metricLabel: m.name })),
      ];
      const scores = allMetrics.map(m => ({
        metricKey: m.metricKey,
        metricLabel: m.metricLabel,
        rating: ratings[m.metricKey] || "skip",
      }));
      return apiRequest("POST", `/api/entries/${dateStr}/scores`, { scores, notes }).then(r => r.json());
    },
    onSuccess: () => {
      // Invalidate all dashboard queries so calendar refreshes
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/entries", dateStr] });
      toast({ title: "Saved", description: `${format(date, "MMM d")} score recorded.` });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Could not save.", variant: "destructive" }),
  });

  const successCount = Object.values(ratings).filter(r => r === "success").length;
  const setbackCount = Object.values(ratings).filter(r => r === "setback").length;
  const total = successCount - setbackCount;
  const scoreColor = total > 0 ? "text-green-400" : total < 0 ? "text-red-400" : "text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-background rounded-t-2xl md:rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border px-5 py-4 flex items-center justify-between gap-4 z-10">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
              {isToday(date) ? "Today" : isPast ? "Past Day" : ""}
            </p>
            <h2 className="text-base font-black tracking-tight">
              {format(date, "EEEE, MMMM d, yyyy")}
            </h2>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <div className={`text-2xl font-black leading-none ${scoreColor}`}>
                {total > 0 ? `+${total}` : total}
              </div>
              <div className="text-[10px] text-muted-foreground">{successCount}W / {setbackCount}L</div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              data-testid="btn-close-drawer"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Core Metrics */}
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Core Metrics</p>
          {CORE_METRICS.map(m => {
            const r = ratings[m.key] || "skip";
            return (
              <div key={m.key} className={`
                flex items-center justify-between gap-3 rounded-lg border p-3 transition-all duration-150
                ${r === "success" ? "border-green-500/30 bg-green-500/5" : r === "setback" ? "border-red-500/30 bg-red-500/5" : "border-border"}
              `} data-testid={`drawer-metric-${m.key.toLowerCase()}`}>
                <span className={`text-sm font-black tracking-widest ${r === "success" ? "text-green-400" : r === "setback" ? "text-red-400" : "text-muted-foreground"}`}>
                  {m.label}
                </span>
                <div className="flex gap-1.5">
                  {(["success", "setback", "skip"] as Rating[]).map(val => (
                    <button
                      key={val}
                      onClick={() => setRatings(prev => ({ ...prev, [m.key]: val }))}
                      data-testid={`drawer-btn-${m.key.toLowerCase()}-${val}`}
                      className={`
                        flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border text-[9px] font-bold tracking-wider transition-all duration-150
                        ${r === val
                          ? val === "success" ? "bg-green-500/20 border-green-500/40 text-green-400"
                            : val === "setback" ? "bg-red-500/20 border-red-500/40 text-red-400"
                            : "bg-muted border-muted-foreground/30 text-muted-foreground"
                          : "border-border text-muted-foreground/50 hover:border-muted-foreground/30 hover:bg-muted/50"
                        }
                      `}
                    >
                      {val === "success" ? <CheckCircle2 className="w-4 h-4 mb-0.5" /> : val === "setback" ? <XCircle className="w-4 h-4 mb-0.5" /> : <Minus className="w-4 h-4 mb-0.5" />}
                      {val === "success" ? "WIN" : val === "setback" ? "LOSS" : "SKIP"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Custom Metrics */}
          {customMetrics.length > 0 && (
            <>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase pt-1">Custom Metrics</p>
              {customMetrics.map(m => {
                const key = `custom_${m.id}`;
                const r = ratings[key] || "skip";
                return (
                  <div key={key} className={`
                    flex items-center justify-between gap-3 rounded-lg border p-3 transition-all duration-150
                    ${r === "success" ? "border-green-500/30 bg-green-500/5" : r === "setback" ? "border-red-500/30 bg-red-500/5" : "border-border"}
                  `}>
                    <span className={`text-sm font-black tracking-widest ${r === "success" ? "text-green-400" : r === "setback" ? "text-red-400" : "text-muted-foreground"}`}>
                      {m.name.toUpperCase()}
                    </span>
                    <div className="flex gap-1.5">
                      {(["success", "setback", "skip"] as Rating[]).map(val => (
                        <button
                          key={val}
                          onClick={() => setRatings(prev => ({ ...prev, [key]: val }))}
                          className={`
                            flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border text-[9px] font-bold tracking-wider transition-all duration-150
                            ${r === val
                              ? val === "success" ? "bg-green-500/20 border-green-500/40 text-green-400"
                                : val === "setback" ? "bg-red-500/20 border-red-500/40 text-red-400"
                                : "bg-muted border-muted-foreground/30 text-muted-foreground"
                              : "border-border text-muted-foreground/50 hover:border-muted-foreground/30 hover:bg-muted/50"
                            }
                          `}
                        >
                          {val === "success" ? <CheckCircle2 className="w-4 h-4 mb-0.5" /> : val === "setback" ? <XCircle className="w-4 h-4 mb-0.5" /> : <Minus className="w-4 h-4 mb-0.5" />}
                          {val === "success" ? "WIN" : val === "setback" ? "LOSS" : "SKIP"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Activity Timeline Sparkline */}
          {timeline.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-2">Activity Timeline</p>
              <div className="rounded-lg border border-border bg-muted/30 px-3 pt-3 pb-1">
                <DaySparkline events={timeline} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="pt-1">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Notes</p>
              <span className="text-[10px] text-muted-foreground/50">Optional · saved with score</span>
            </div>
            <Textarea
              placeholder="How did this day go? Add a reflection..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="resize-none text-sm"
              data-testid="drawer-textarea-notes"
            />
          </div>

          {/* Save */}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full mt-2"
            size="lg"
            data-testid="drawer-btn-save"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : `Save ${format(date, "MMM d")} Score`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar View ─────────────────────────────────────────────────────────────

function CalendarView({
  resultsByDate,
  customMetrics,
}: {
  resultsByDate: Record<string, DayResult>;
  customMetrics: CustomMetric[];
}) {
  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad leading days (Mon-start)
  const startPad = (getDay(monthStart) + 6) % 7; // 0=Mon
  const leadingBlanks = Array(startPad).fill(null);

  // Monthly stats
  const monthDays = days.filter(d => !isFuture(d) || isToday(d));
  const monthResults = monthDays.map(d => resultsByDate[format(d, "yyyy-MM-dd")]).filter(Boolean);
  const monthScore = monthResults.reduce((s, r) => s + r.total, 0);
  const positivedays = monthResults.filter(r => r.total > 0).length;

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth(m => subMonths(m, 1))}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
          data-testid="btn-prev-month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-center">
          <p className="text-base font-black tracking-tight uppercase">{format(viewMonth, "MMMM yyyy")}</p>
          {monthResults.length > 0 && (
            <p className="text-[10px] text-muted-foreground">
              {monthResults.length} days scored · {positivedays} positive ·{" "}
              <span className={monthScore >= 0 ? "text-green-400" : "text-red-400"}>
                {monthScore > 0 ? `+${monthScore}` : monthScore} pts
              </span>
            </p>
          )}
        </div>
        <button
          onClick={() => setViewMonth(m => addMonths(m, 1))}
          disabled={isSameMonth(viewMonth, new Date()) || isFuture(startOfMonth(addMonths(viewMonth, 1)))}
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-default"
          data-testid="btn-next-month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {leadingBlanks.map((_, i) => <div key={`blank-${i}`} />)}
        {days.map(day => (
          <CalendarCell
            key={day.toISOString()}
            date={day}
            result={resultsByDate[format(day, "yyyy-MM-dd")]}
            isCurrentMonth={isSameMonth(day, viewMonth)}
            onClick={() => setSelectedDate(day)}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30" /><span>Positive day</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" /><span>Negative day</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-muted border border-border" /><span>Zero</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded border border-transparent opacity-20" /><span>Not scored</span></div>
      </div>

      {/* Day drawer */}
      {selectedDate && (
        <DayDrawer
          date={selectedDate}
          existingResult={resultsByDate[format(selectedDate, "yyyy-MM-dd")]}
          customMetrics={customMetrics}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({
  results,
  customMetrics,
}: {
  results: DayResult[];
  customMetrics: CustomMetric[];
}) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const sorted = [...results].sort((a, b) => b.entry.entryDate.localeCompare(a.entry.entryDate));

  if (sorted.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground text-sm">No scored days in this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {sorted.map(r => {
          const date = parseISO(r.entry.entryDate + "T00:00:00");
          const scoreColor = r.total > 0 ? "text-green-400" : r.total < 0 ? "text-red-400" : "text-muted-foreground";
          return (
            <button
              key={r.entry.id}
              onClick={() => setSelectedDate(date)}
              className="w-full text-left"
              data-testid={`history-row-${r.entry.entryDate}`}
            >
              <Card className="hover-elevate transition-all duration-150 hover:border-primary/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-sm font-black">{format(date, "EEEE")}</span>
                        <span className="text-xs text-muted-foreground">{format(date, "MMM d, yyyy")}</span>
                        <Badge className={`text-[10px] ${
                          r.total > 0 ? "bg-green-500/20 text-green-400 border-green-500/30" :
                          r.total < 0 ? "bg-red-500/20 text-red-400 border-red-500/30" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {r.total > 0 ? `+${r.total}` : r.total} pts
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {r.scores.filter(s => s.rating !== "skip").map(s => (
                          <div key={s.metricKey} className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                            s.rating === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" :
                            "bg-red-500/10 border-red-500/20 text-red-400"
                          }`}>
                            {s.rating === "success" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span className="font-bold tracking-wider">{s.metricLabel}</span>
                          </div>
                        ))}
                      </div>
                      {r.entry.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 italic truncate">{r.entry.notes}</p>
                      )}
                    </div>
                    <div className={`text-2xl font-black flex-shrink-0 ${scoreColor}`}>
                      {r.total > 0 ? `+${r.total}` : r.total}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <DayDrawer
          date={selectedDate}
          existingResult={results.find(r => r.entry.entryDate === format(selectedDate, "yyyy-MM-dd"))}
          customMetrics={customMetrics}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
  { label: "This Year", value: "year" },
  { label: "All Time", value: "all" },
];

function getListRange(period: string) {
  const today = new Date();
  switch (period) {
    case "7d": return { start: format(subDays(today, 6), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
    case "30d": return { start: format(subDays(today, 29), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
    case "90d": return { start: format(subDays(today, 89), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
    case "year": return { start: format(startOfYear(today), "yyyy-MM-dd"), end: format(endOfYear(today), "yyyy-MM-dd") };
    case "all": return { start: "2000-01-01", end: format(today, "yyyy-MM-dd") };
    default: return { start: format(subDays(today, 29), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
  }
}

export default function HistoryPage() {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [listPeriod, setListPeriod] = useState("30d");

  // For calendar: load a wide range (full current + 11 prior months = full year)
  const calStart = format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-dd");
  const calEnd = format(new Date(), "yyyy-MM-dd");

  const { data: calResults = [], isLoading: calLoading } = useQuery<DayResult[]>({
    queryKey: ["/api/dashboard", calStart, calEnd],
    queryFn: () => apiRequest("GET", `/api/dashboard?startDate=${calStart}&endDate=${calEnd}`).then(r => r.json()),
  });

  const { start: listStart, end: listEnd } = getListRange(listPeriod);
  const { data: listResults = [], isLoading: listLoading } = useQuery<DayResult[]>({
    queryKey: ["/api/dashboard", listStart, listEnd],
    queryFn: () => apiRequest("GET", `/api/dashboard?startDate=${listStart}&endDate=${listEnd}`).then(r => r.json()),
    enabled: view === "list",
  });

  const { data: customMetrics = [] } = useQuery<CustomMetric[]>({
    queryKey: ["/api/metrics/custom"],
    queryFn: () => apiRequest("GET", "/api/metrics/custom").then(r => r.json()),
  });

  // Index results by date string for O(1) calendar lookup
  const resultsByDate: Record<string, DayResult> = {};
  calResults.forEach(r => { resultsByDate[r.entry.entryDate] = r; });

  // All-time stats from calendar data
  const totalDays = calResults.length;
  const totalScore = calResults.reduce((s, r) => s + r.total, 0);
  const bestDay = calResults.length > 0 ? Math.max(...calResults.map(r => r.total)) : 0;
  const streak = (() => {
    let s = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = format(subDays(today, i), "yyyy-MM-dd");
      if (resultsByDate[d]) s++;
      else break;
    }
    return s;
  })();

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-black tracking-tight uppercase">History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your daily record</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { label: "Days Tracked", value: totalDays, color: "text-foreground" },
          { label: "Total Score", value: totalScore > 0 ? `+${totalScore}` : totalScore, color: totalScore >= 0 ? "text-green-400" : "text-red-400" },
          { label: "Best Day", value: `+${bestDay}`, color: "text-primary" },
          { label: "Streak", value: `${streak}d`, color: streak > 0 ? "text-amber-400" : "text-muted-foreground" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <p className={`text-lg font-black leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider leading-none">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setView("calendar")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wider transition-all duration-150 ${
            view === "calendar" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
          }`}
          data-testid="btn-view-calendar"
        >
          <CalendarDays className="w-3.5 h-3.5" /> Calendar
        </button>
        <button
          onClick={() => setView("list")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wider transition-all duration-150 ${
            view === "list" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
          }`}
          data-testid="btn-view-list"
        >
          <List className="w-3.5 h-3.5" /> List
        </button>

        {/* Period filter for list only */}
        {view === "list" && (
          <div className="ml-auto">
            <select
              value={listPeriod}
              onChange={e => setListPeriod(e.target.value)}
              className="text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground font-medium"
              data-testid="select-list-period"
            >
              {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Content */}
      {calLoading ? (
        <div className="grid grid-cols-7 gap-1">
          {[...Array(35)].map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : view === "calendar" ? (
        <CalendarView resultsByDate={resultsByDate} customMetrics={customMetrics} />
      ) : (
        <ListView
          results={listResults}
          customMetrics={customMetrics}
        />
      )}

      {/* Goal Inventory */}
      <GoalList />
    </div>
  );
}

// ─── Goal List ────────────────────────────────────────────────────────────────

function GoalList() {
  const { data: goals = [], isLoading } = useQuery<GoalEntry[]>({
    queryKey: ["/api/goals"],
    queryFn: () => apiRequest("GET", "/api/goals").then(r => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) return null;
  if (goals.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-primary" />
        <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Goal History</h2>
        <div className="flex-1 h-px bg-border" />
        <span className="text-[10px] text-muted-foreground/60">{goals.length} recorded</span>
      </div>
      <div className="space-y-2">
        {goals.map((g, i) => {
          const date = new Date(g.entryDate + "T12:00:00");
          const dateLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
          return (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
              data-testid={`goal-row-${g.entryDate}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-primary mt-1" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">{g.goalText}</p>
                <p className="text-[10px] text-muted-foreground mt-1 font-medium">{dateLabel}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
