import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, LineChart, Line, ReferenceLine,
} from "recharts";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths } from "date-fns";
import { TrendingUp, TrendingDown, Minus, Calendar, Target, Zap } from "lucide-react";
import { useLocation } from "wouter";
import PerplexityAttribution from "@/components/PerplexityAttribution";
import { useUserTimezone, getTodayInTimezone } from "@/hooks/use-user-timezone";
import { DaySparkline, TimelineEvent, CORE_METRIC_COLORS, getMetricColor } from "@/components/day-sparkline";


type DayResult = {
  entry: { id: number; entryDate: string; notes?: string };
  scores: { metricKey: string; metricLabel: string; rating: string }[];
  successCount: number;
  setbackCount: number;
  total: number;
};

function getRangeForTab(tab: string, timezone: string): { start: string; end: string; label: string } {
  // Use timezone-aware today so date ranges don't drift for non-UTC users
  const todayStr = getTodayInTimezone(timezone);
  const today = new Date(todayStr + "T12:00:00"); // noon to avoid DST edge cases
  switch (tab) {
    case "week": return {
      start: format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      end: format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      label: "This Week",
    };
    case "month": return {
      start: format(startOfMonth(today), "yyyy-MM-dd"),
      end: format(endOfMonth(today), "yyyy-MM-dd"),
      label: "This Month",
    };
    case "year": return {
      start: format(startOfYear(today), "yyyy-MM-dd"),
      end: format(endOfYear(today), "yyyy-MM-dd"),
      label: "This Year",
    };
    default: return { // last 30 days
      start: format(subDays(today, 29), "yyyy-MM-dd"),
      end: format(today, "yyyy-MM-dd"),
      label: "Last 30 Days",
    };
  }
}

function StatCard({ label, value, sub, icon: Icon, color = "text-foreground" }: {
  label: string; value: string | number; sub?: string; icon: any; color?: string;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black mt-1 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className={`font-bold text-sm ${val > 0 ? "text-green-400" : val < 0 ? "text-red-400" : "text-muted-foreground"}`}>
        {val > 0 ? `+${val}` : val}
      </p>
    </div>
  );
};

export default function DashboardPage() {
  const [tab, setTab] = useState("week");
  const [, setLocation] = useLocation();
  const { timezone, getTodayString } = useUserTimezone();
  const today = getTodayString();
  const { start, end, label } = getRangeForTab(tab, timezone);

  const { data: results = [], isLoading } = useQuery<DayResult[]>({
    queryKey: ["/api/dashboard", start, end],
    queryFn: () => apiRequest("GET", `/api/dashboard?startDate=${start}&endDate=${end}`).then(r => r.json()),
  });

  // Today's entry
  const { data: todayData } = useQuery({
    queryKey: ["/api/entries", today],
    queryFn: () => apiRequest("GET", `/api/entries/${today}`).then(r => r.json()),
  });

  const { data: timeline = [] } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/today/timeline"],
    queryFn: () => apiRequest("GET", "/api/today/timeline").then(r => r.json()),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: timelineBg } = useQuery<{ heroImageUrl: string | null } | null>({
    queryKey: ["/api/pages", "timeline"],
    queryFn: () => apiRequest("GET", "/api/pages/timeline").then(r => r.ok ? r.json() : null).catch(() => null),
    staleTime: 5 * 60 * 1000,
  });
  const timelineBgUrl = timelineBg?.heroImageUrl?.trim() || null;

  // Stats
  const totalDays = results.length;
  const totalScore = results.reduce((s, r) => s + r.total, 0);
  const avgScore = totalDays > 0 ? (totalScore / totalDays).toFixed(1) : "0.0";
  const bestDay = results.length > 0 ? Math.max(...results.map(r => r.total)) : 0;
  const worstDay = results.length > 0 ? Math.min(...results.map(r => r.total)) : 0;
  const successRate = totalDays > 0
    ? Math.round((results.filter(r => r.total > 0).length / totalDays) * 100)
    : 0;

  const todayScore = todayData
    ? (todayData.scores || []).filter((s: any) => s.rating === "success").length -
      (todayData.scores || []).filter((s: any) => s.rating === "setback").length
    : null;

  // Chart data
  const chartData = results.map(r => ({
    date: format(new Date(r.entry.entryDate + "T00:00:00"), tab === "year" ? "MMM" : "EEE d"),
    score: r.total,
    wins: r.successCount,
    losses: r.setbackCount,
  }));

  // Metric breakdown
  const metricBreakdown: Record<string, { label: string; wins: number; losses: number }> = {};
  results.forEach(r => {
    r.scores.forEach(s => {
      if (!metricBreakdown[s.metricKey]) {
        metricBreakdown[s.metricKey] = { label: s.metricLabel, wins: 0, losses: 0 };
      }
      if (s.rating === "success") metricBreakdown[s.metricKey].wins++;
      if (s.rating === "setback") metricBreakdown[s.metricKey].losses++;
    });
  });

  const metricList = Object.entries(metricBreakdown)
    .filter(([, v]) => v.wins + v.losses > 0)
    .map(([key, v]) => ({
      key,
      label: v.label,
      total: v.wins + v.losses,
      winRate: Math.round((v.wins / (v.wins + v.losses)) * 100),
      wins: v.wins,
      losses: v.losses,
    }))
    .sort((a, b) => b.winRate - a.winRate);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight uppercase">Performance Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: timezone })}
          </p>
        </div>
        <Button onClick={() => setLocation("/today")} size="sm" data-testid="button-score-today">
          <Zap className="w-4 h-4 mr-1.5" />
          Score Today
        </Button>
      </div>

      {/* Today's snapshot */}
      {todayData !== undefined && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1">Today</p>
                {todayData ? (
                  <>
                    <div className={`text-3xl font-black ${todayScore! > 0 ? "text-green-400" : todayScore! < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                      {todayScore! > 0 ? `+${todayScore}` : todayScore}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(todayData.scores || []).filter((s: any) => s.rating === "success").length} wins ·{" "}
                      {(todayData.scores || []).filter((s: any) => s.rating === "setback").length} setbacks
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Not scored yet</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => setLocation("/today")}>
                {todayData ? "Update" : "Score Now"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Metric Timeline Sparkline */}
      {timeline.length > 0 && (
        <Card className="mb-6 relative overflow-hidden">
          {/* Admin-configured background image at 30% opacity */}
          {timelineBgUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
              style={{ backgroundImage: `url(${timelineBgUrl})`, opacity: 0.18 }}
            />
          )}
          <CardHeader className="pb-1 pt-4 px-4 relative">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Today's Activity Timeline</CardTitle>
            <p className="text-[10px] text-foreground/70 mt-0.5">Metric scores plotted across the day · hover a dot for details</p>
          </CardHeader>
          <CardContent className="px-3 pb-2 relative">
            <DaySparkline events={timeline} />
            {/* Legend — all events present in today's timeline */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 px-1">
              {(() => {
                let customIdx = 0;
                return timeline.map((ev, i) => {
                  const isCustom = !CORE_METRIC_COLORS[ev.metricKey];
                  const color = getMetricColor(ev.metricKey, isCustom ? customIdx++ : 0);
                  return (
                    <div key={ev.metricKey} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[9px] font-bold tracking-widest text-foreground/80">{ev.metricLabel}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time filter */}
      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList className="grid grid-cols-4 w-full max-w-xs">
          <TabsTrigger value="week" data-testid="tab-week">Week</TabsTrigger>
          <TabsTrigger value="month" data-testid="tab-month">Month</TabsTrigger>
          <TabsTrigger value="30days" data-testid="tab-30days">30d</TabsTrigger>
          <TabsTrigger value="year" data-testid="tab-year">Year</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-3 bg-muted rounded w-16 mb-3 animate-pulse" />
                <div className="h-8 bg-muted rounded w-12 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Total Score"
              value={totalScore > 0 ? `+${totalScore}` : totalScore}
              sub={label}
              icon={Target}
              color={totalScore > 0 ? "text-green-400" : totalScore < 0 ? "text-red-400" : "text-foreground"}
            />
            <StatCard label="Avg / Day" value={avgScore} sub="pts per day" icon={TrendingUp} />
            <StatCard label="Win Rate" value={`${successRate}%`} sub="positive days" icon={TrendingUp} color={successRate >= 60 ? "text-green-400" : "text-muted-foreground"} />
            <StatCard label="Days Tracked" value={totalDays} sub={`best: +${bestDay}`} icon={Calendar} />
          </div>

          {/* Chart */}
          {chartData.length > 0 ? (
            <Card className="mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider">Score Timeline — {label}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} barSize={24} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215 10% 52%)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(215 10% 52%)" }} axisLine={false} tickLine={false} />
                    <ReferenceLine y={0} stroke="hsl(220 10% 18%)" strokeDasharray="3 3" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(220 10% 18% / 0.5)" }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.score > 0 ? "hsl(142 71% 45%)" : entry.score < 0 ? "hsl(0 72% 51%)" : "hsl(215 10% 35%)"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground text-sm">No data yet for this period</p>
                <Button className="mt-4" size="sm" onClick={() => setLocation("/today")}>Start Scoring</Button>
              </CardContent>
            </Card>
          )}

          {/* Metric breakdown */}
          {metricList.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-wider">Metric Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {metricList.map(m => (
                  <div key={m.key} data-testid={`metric-row-${m.key.toLowerCase()}`}>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-xs font-black tracking-widest uppercase">{m.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{m.wins}W / {m.losses}L</span>
                        <span className={`text-xs font-bold ${m.winRate >= 70 ? "text-green-400" : m.winRate >= 50 ? "text-primary" : "text-red-400"}`}>
                          {m.winRate}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          m.winRate >= 70 ? "bg-green-500" : m.winRate >= 50 ? "bg-primary" : "bg-red-500"
                        }`}
                        style={{ width: `${m.winRate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
      <PerplexityAttribution />
    </div>
  );
}
