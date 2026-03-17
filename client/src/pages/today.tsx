import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Minus, Save, ChevronRight, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import type { MetricScore, CustomMetric, MetricContent } from "@shared/schema";
import MetricInfoModal from "@/components/metric-info-modal";

const CORE_METRICS = [
  { key: "TIME", label: "TIME", description: "Did you manage your time with intention today?" },
  { key: "GOAL", label: "GOAL", description: "Did you pursue your primary goal with focus?" },
  { key: "TEAM", label: "TEAM", description: "Did you contribute positively to your team?" },
  { key: "TASK", label: "TASK", description: "Did you complete your most important tasks?" },
  { key: "VIEW", label: "VIEW", description: "Did you maintain a clear vision and perspective?" },
  { key: "PACE", label: "PACE", description: "Did you maintain the right pace and rhythm?" },
];

type Rating = "success" | "setback" | "skip";

function MetricCard({
  metricKey,
  label,
  description,
  rating,
  onRate,
  onInfo,
  showInfo,
}: {
  metricKey: string;
  label: string;
  description: string;
  rating: Rating;
  onRate: (key: string, rating: Rating) => void;
  onInfo?: () => void;
  showInfo?: boolean;
}) {
  const isSuccess = rating === "success";
  const isSetback = rating === "setback";
  const isSkip = rating === "skip";

  return (
    <div
      className={`
        relative rounded-xl border-2 p-4 transition-all duration-200
        ${isSuccess ? "metric-success" : ""}
        ${isSetback ? "metric-setback" : ""}
        ${isSkip ? "metric-skip border-border" : "border-border"}
      `}
      data-testid={`metric-card-${metricKey.toLowerCase()}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-lg font-black tracking-widest ${
              isSuccess ? "text-green-400" : isSetback ? "text-red-400" : "text-muted-foreground"
            }`}>
              {label}
            </span>
            {isSuccess && <Badge className="text-[10px] bg-green-500/20 text-green-400 border-green-500/30">SUCCESS +1</Badge>}
            {isSetback && <Badge className="text-[10px] bg-red-500/20 text-red-400 border-red-500/30">SETBACK -1</Badge>}
            {/* Info icon — only for core metrics */}
            {showInfo && onInfo && (
              <button
                onClick={onInfo}
                className="ml-auto flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
                data-testid={`btn-info-${metricKey.toLowerCase()}`}
                title={`Learn about ${label}`}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{description}</p>
        </div>

        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => onRate(metricKey, "success")}
            data-testid={`btn-${metricKey.toLowerCase()}-success`}
            className={`
              flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg border transition-all duration-150
              ${isSuccess
                ? "bg-green-500/20 border-green-500/40 text-green-400"
                : "border-border text-muted-foreground hover:border-green-500/40 hover:text-green-400 hover:bg-green-500/10"
              }
            `}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-wider">WIN</span>
          </button>
          <button
            onClick={() => onRate(metricKey, "setback")}
            data-testid={`btn-${metricKey.toLowerCase()}-setback`}
            className={`
              flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg border transition-all duration-150
              ${isSetback
                ? "bg-red-500/20 border-red-500/40 text-red-400"
                : "border-border text-muted-foreground hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10"
              }
            `}
          >
            <XCircle className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-wider">LOSS</span>
          </button>
          <button
            onClick={() => onRate(metricKey, "skip")}
            data-testid={`btn-${metricKey.toLowerCase()}-skip`}
            className={`
              flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-lg border transition-all duration-150
              ${isSkip
                ? "bg-muted border-muted-foreground/30 text-muted-foreground"
                : "border-border text-muted-foreground/50 hover:border-muted-foreground/30 hover:bg-muted"
              }
            `}
          >
            <Minus className="w-5 h-5" />
            <span className="text-[9px] font-bold tracking-wider">SKIP</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TodayPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const today = new Date().toISOString().split("T")[0];
  const displayDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [notes, setNotes] = useState("");
  const [activeModal, setActiveModal] = useState<{ key: string; label: string } | null>(null);

  // Fetch today's entry
  const { data: entryData, isLoading } = useQuery({
    queryKey: ["/api/entries", today],
    queryFn: () => apiRequest("GET", `/api/entries/${today}`).then(r => r.json()),
  });

  // Fetch custom metrics
  const { data: customMetrics = [] } = useQuery<CustomMetric[]>({
    queryKey: ["/api/metrics/custom"],
    queryFn: () => apiRequest("GET", "/api/metrics/custom").then(r => r.json()),
  });

  // Fetch metric content for modals
  const { data: metricContentArray = [] } = useQuery<MetricContent[]>({
    queryKey: ["/api/metric-content"],
    queryFn: () => apiRequest("GET", "/api/metric-content").then(r => r.json()),
  });

  const metricContentMap: Record<string, MetricContent> = {};
  metricContentArray.forEach(c => { metricContentMap[c.metricKey] = c; });

  // Initialize from existing entry
  useEffect(() => {
    if (entryData) {
      const scoreMap: Record<string, Rating> = {};
      (entryData.scores || []).forEach((s: MetricScore) => {
        scoreMap[s.metricKey] = s.rating as Rating;
      });
      setRatings(scoreMap);
      setNotes(entryData.entry?.notes || "");
    } else {
      const defaults: Record<string, Rating> = {};
      CORE_METRICS.forEach(m => defaults[m.key] = "skip");
      setRatings(defaults);
    }
  }, [entryData]);

  function handleRate(key: string, rating: Rating) {
    setRatings(r => ({ ...r, [key]: rating }));
  }

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
      return apiRequest("POST", `/api/entries/${today}/scores`, { scores, notes }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/entries", today] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Saved", description: "Today's metrics have been recorded." });
    },
    onError: () => toast({ title: "Error", description: "Could not save.", variant: "destructive" }),
  });

  // Calculate score
  const ratedMetrics = Object.values(ratings).filter(r => r !== "skip");
  const successCount = Object.values(ratings).filter(r => r === "success").length;
  const setbackCount = Object.values(ratings).filter(r => r === "setback").length;
  const totalScore = successCount - setbackCount;
  const maxScore = CORE_METRICS.length + customMetrics.length;
  const scoredCount = ratedMetrics.length;

  const scoreColor = totalScore > 0 ? "text-green-400" : totalScore < 0 ? "text-red-400" : "text-muted-foreground";
  const scorePct = maxScore > 0 ? Math.max(0, Math.round((totalScore / maxScore) * 100)) : 0;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">Today's Score</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{displayDate}</p>
          </div>
          {/* Score display */}
          <div className="flex-shrink-0 text-right">
            <div className={`text-4xl font-black ${scoreColor}`}>{totalScore > 0 ? `+${totalScore}` : totalScore}</div>
            <div className="text-xs text-muted-foreground">{successCount}W / {setbackCount}L / {maxScore - scoredCount}S</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${scorePct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{scoredCount} of {maxScore} rated</span>
          <span>{scorePct}%</span>
        </div>
      </div>

      {/* Core Metrics */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Core Metrics</h2>
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">6 pts available</span>
        </div>
        <div className="space-y-2">
          {CORE_METRICS.map(m => (
            <MetricCard
              key={m.key}
              metricKey={m.key}
              label={m.label}
              description={metricContentMap[m.key]?.subtext || m.description}
              rating={ratings[m.key] || "skip"}
              onRate={handleRate}
              showInfo={true}
              onInfo={() => setActiveModal({ key: m.key, label: m.label })}
            />
          ))}
        </div>
      </section>

      {/* Custom Metrics */}
      {customMetrics.length > 0 && (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Custom Metrics</h2>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{customMetrics.length} added</span>
          </div>
          <div className="space-y-2">
            {customMetrics.map(m => (
              <MetricCard
                key={`custom_${m.id}`}
                metricKey={`custom_${m.id}`}
                label={m.name.toUpperCase()}
                description={m.description || `Track your ${m.name.toLowerCase()} performance`}
                rating={ratings[`custom_${m.id}`] || "skip"}
                onRate={handleRate}
                showInfo={false}
              />
            ))}
          </div>
        </section>
      )}

      {customMetrics.length < 4 && (
        <div className="mb-6">
          <button onClick={() => setLocation("/settings")} className="flex items-center gap-2 text-xs text-primary hover:underline">
            <span>+ Add up to {4 - customMetrics.length} more custom metrics in Settings</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Notes */}
      <section className="mb-6">
        <h2 className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">Daily Notes</h2>
        <Textarea
          placeholder="Reflect on today's performance..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="resize-none"
          data-testid="textarea-notes"
        />
      </section>

      {/* Save */}
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
        size="lg"
        data-testid="button-save"
      >
        <Save className="w-4 h-4 mr-2" />
        {saveMutation.isPending ? "Saving..." : "Save Today's Score"}
      </Button>

      {/* Metric Info Modal */}
      {activeModal && (
        <MetricInfoModal
          metricKey={activeModal.key}
          metricLabel={activeModal.label}
          content={metricContentMap[activeModal.key]}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
