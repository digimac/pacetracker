import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Save, ImageIcon, Quote, BookOpen, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { MetricContent } from "@shared/schema";

const ADMIN_EMAIL = "track@sweetmo.io";

const CORE_METRICS = [
  { key: "TIME", label: "TIME", color: "from-violet-500/20 to-violet-600/5", accent: "text-violet-400", border: "border-violet-500/30" },
  { key: "GOAL", label: "GOAL", color: "from-amber-500/20 to-amber-600/5", accent: "text-amber-400", border: "border-amber-500/30" },
  { key: "TEAM", label: "TEAM", color: "from-cyan-500/20 to-cyan-600/5", accent: "text-cyan-400", border: "border-cyan-500/30" },
  { key: "TASK", label: "TASK", color: "from-emerald-500/20 to-emerald-600/5", accent: "text-emerald-400", border: "border-emerald-500/30" },
  { key: "VIEW", label: "VIEW", color: "from-rose-500/20 to-rose-600/5", accent: "text-rose-400", border: "border-rose-500/30" },
  { key: "PACE", label: "PACE", color: "from-blue-500/20 to-blue-600/5", accent: "text-blue-400", border: "border-blue-500/30" },
];

type ContentMap = Record<string, MetricContent>;

interface MetricEditorProps {
  metricKey: string;
  label: string;
  color: string;
  accent: string;
  border: string;
  existing: MetricContent | undefined;
  onSave: (data: { metricKey: string; story: string; imageUrl: string; quote: string; quoteAuthor: string }) => void;
  isSaving: boolean;
}

function MetricEditor({ metricKey, label, color, accent, border, existing, onSave, isSaving }: MetricEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [story, setStory] = useState(existing?.story || "");
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl || "");
  const [quote, setQuote] = useState(existing?.quote || "");
  const [quoteAuthor, setQuoteAuthor] = useState(existing?.quoteAuthor || "");

  // Sync when existing content loads
  useEffect(() => {
    setStory(existing?.story || "");
    setImageUrl(existing?.imageUrl || "");
    setQuote(existing?.quote || "");
    setQuoteAuthor(existing?.quoteAuthor || "");
  }, [existing]);

  const hasContent = !!(existing?.story || existing?.imageUrl || existing?.quote);

  return (
    <div className={`rounded-xl border-2 ${border} bg-gradient-to-b ${color} overflow-hidden transition-all duration-200`}
      data-testid={`admin-metric-${metricKey.toLowerCase()}`}>
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setExpanded(e => !e)}
        data-testid={`admin-expand-${metricKey.toLowerCase()}`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xl font-black tracking-widest ${accent}`}>{label}</span>
          {hasContent && (
            <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/60">
              Configured
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">

          {/* Story */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Short Story
            </label>
            <Textarea
              placeholder={`Write a short story or explanation for ${label}...`}
              value={story}
              onChange={e => setStory(e.target.value)}
              rows={4}
              className="resize-none text-sm"
              maxLength={2000}
              data-testid={`input-story-${metricKey.toLowerCase()}`}
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{story.length}/2000</p>
          </div>

          {/* Image URL */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> Image URL
            </label>
            <Input
              placeholder="https://images.unsplash.com/..."
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              className="text-sm font-mono"
              data-testid={`input-image-${metricKey.toLowerCase()}`}
            />
            {imageUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-border h-32 bg-muted">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
            )}
          </div>

          {/* Quote */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5">
              <Quote className="w-3.5 h-3.5" /> Inspiring Quote
            </label>
            <Textarea
              placeholder={`Add an inspiring quote for ${label}...`}
              value={quote}
              onChange={e => setQuote(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              maxLength={500}
              data-testid={`input-quote-${metricKey.toLowerCase()}`}
            />
          </div>

          {/* Quote Author */}
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Quote Author
            </label>
            <Input
              placeholder="e.g. Marcus Aurelius"
              value={quoteAuthor}
              onChange={e => setQuoteAuthor(e.target.value)}
              className="text-sm"
              maxLength={100}
              data-testid={`input-author-${metricKey.toLowerCase()}`}
            />
          </div>

          {/* Save button */}
          <Button
            onClick={() => onSave({ metricKey, subtext, story, imageUrl, quote, quoteAuthor })}
            disabled={isSaving}
            className="w-full"
            data-testid={`btn-save-${metricKey.toLowerCase()}`}
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save {label}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.email !== ADMIN_EMAIL) setLocation("/dashboard");
  }, [user]);

  const { data: contentArray = [], isLoading } = useQuery<MetricContent[]>({
    queryKey: ["/api/metric-content"],
    queryFn: () => apiRequest("GET", "/api/metric-content").then(r => r.json()),
  });

  const contentMap: ContentMap = {};
  contentArray.forEach(c => { contentMap[c.metricKey] = c; });

  const saveMutation = useMutation({
    mutationFn: (data: { metricKey: string; subtext: string; story: string; imageUrl: string; quote: string; quoteAuthor: string }) => {
      setSavingKey(data.metricKey);
      return apiRequest("POST", "/api/admin/metric-content", data).then(r => r.json());
    },
    onSuccess: (_, vars) => {
      setSavingKey(null);
      queryClient.invalidateQueries({ queryKey: ["/api/metric-content"] });
      toast({ title: "Saved", description: `${vars.metricKey} content updated.` });
    },
    onError: (e: any) => {
      setSavingKey(null);
      toast({ title: "Error", description: e.message || "Save failed", variant: "destructive" });
    },
  });

  if (!user || user.email !== ADMIN_EMAIL) return null;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">Metric content editor</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          Configure the story, image, and quote shown in each metric's info modal. Users can open these by tapping the info icon on the Today page.
        </p>
      </div>

      {/* Metrics */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {CORE_METRICS.map(m => (
            <MetricEditor
              key={m.key}
              metricKey={m.key}
              label={m.label}
              color={m.color}
              accent={m.accent}
              border={m.border}
              existing={contentMap[m.key]}
              onSave={data => saveMutation.mutate(data)}
              isSaving={savingKey === m.key && saveMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
