import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Minus } from "lucide-react";

type DayResult = {
  entry: { id: number; entryDate: string; notes?: string };
  scores: { metricKey: string; metricLabel: string; rating: string }[];
  successCount: number;
  setbackCount: number;
  total: number;
};

const PERIODS = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "This Month", value: "month" },
  { label: "Last Month", value: "lastmonth" },
  { label: "This Year", value: "year" },
];

function getRange(period: string) {
  const today = new Date();
  switch (period) {
    case "7d": return { start: format(subDays(today, 6), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
    case "30d": return { start: format(subDays(today, 29), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
    case "month": return { start: format(startOfMonth(today), "yyyy-MM-dd"), end: format(endOfMonth(today), "yyyy-MM-dd") };
    case "lastmonth": {
      const lm = subMonths(today, 1);
      return { start: format(startOfMonth(lm), "yyyy-MM-dd"), end: format(endOfMonth(lm), "yyyy-MM-dd") };
    }
    case "year": return { start: format(startOfYear(today), "yyyy-MM-dd"), end: format(endOfYear(today), "yyyy-MM-dd") };
    default: return { start: format(subDays(today, 29), "yyyy-MM-dd"), end: format(today, "yyyy-MM-dd") };
  }
}

function RatingIcon({ rating }: { rating: string }) {
  if (rating === "success") return <CheckCircle2 className="w-3 h-3 text-green-400" />;
  if (rating === "setback") return <XCircle className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-muted-foreground/40" />;
}

export default function HistoryPage() {
  const [period, setPeriod] = useState("30d");
  const { start, end } = getRange(period);

  const { data: results = [], isLoading } = useQuery<DayResult[]>({
    queryKey: ["/api/dashboard", start, end],
    queryFn: () => apiRequest("GET", `/api/dashboard?startDate=${start}&endDate=${end}`).then(r => r.json()),
  });

  const sorted = [...results].sort((a, b) => b.entry.entryDate.localeCompare(a.entry.entryDate));

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight uppercase">History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All scored days</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]" data-testid="select-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-24 mb-2 animate-pulse" />
                <div className="h-3 bg-muted rounded w-40 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">No history found for this period</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sorted.map(r => {
            const date = new Date(r.entry.entryDate + "T00:00:00");
            const coreScores = r.scores.filter(s => !s.metricKey.startsWith("custom_"));
            const customScores = r.scores.filter(s => s.metricKey.startsWith("custom_"));

            return (
              <Card key={r.entry.id} className="hover-elevate" data-testid={`history-row-${r.entry.entryDate}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Date */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-sm font-bold">{format(date, "EEEE")}</span>
                        <span className="text-xs text-muted-foreground">{format(date, "MMM d, yyyy")}</span>
                        <Badge
                          className={`text-[10px] ${
                            r.total > 0 ? "bg-green-500/20 text-green-400 border-green-500/30" :
                            r.total < 0 ? "bg-red-500/20 text-red-400 border-red-500/30" :
                            "bg-muted text-muted-foreground"
                          }`}
                        >
                          {r.total > 0 ? `+${r.total}` : r.total} pts
                        </Badge>
                      </div>

                      {/* Metric grid */}
                      <div className="flex flex-wrap gap-1">
                        {r.scores.filter(s => s.rating !== "skip").map(s => (
                          <div
                            key={s.metricKey}
                            className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                              s.rating === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" :
                              "bg-red-500/10 border-red-500/20 text-red-400"
                            }`}
                          >
                            <RatingIcon rating={s.rating} />
                            <span className="font-bold tracking-wider">{s.metricLabel}</span>
                          </div>
                        ))}
                      </div>

                      {r.entry.notes && (
                        <p className="text-xs text-muted-foreground mt-2 italic truncate">{r.entry.notes}</p>
                      )}
                    </div>

                    {/* Score */}
                    <div className={`text-2xl font-black flex-shrink-0 ${
                      r.total > 0 ? "text-green-400" : r.total < 0 ? "text-red-400" : "text-muted-foreground"
                    }`}>
                      {r.total > 0 ? `+${r.total}` : r.total}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
