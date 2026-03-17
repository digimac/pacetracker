import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Monitor, Zap, Lock, CheckCircle2, ArrowRight, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

type SitePage = {
  id: number;
  pageKey: string;
  title: string;
  subtitle: string | null;
  heroImageUrl: string | null;
  body: string | null;
  sections: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

type Section = { heading: string; text: string; imageUrl?: string; isPro?: boolean };

const DEFAULT_SECTIONS: Section[] = [
  {
    heading: "Score Your Day",
    text: "Each day, open the Today page and rate each of the six core metrics: TIME, GOAL, TEAM, TASK, VIEW, and PACE. Mark each one as a Success (WIN), Setback (LOSS), or Skip. Your daily score is the sum of wins minus losses.",
  },
  {
    heading: "Build Your History",
    text: "Every score is saved to your history. Use the History view to browse past days, identify patterns, and see which metrics consistently drive your best — and worst — days. Momentum is built over time.",
  },
  {
    heading: "Dashboard & Trends",
    text: "Your Performance Dashboard shows weekly and monthly trends, win/loss streaks, and metric breakdowns. Filter by time period to zoom in on specific stretches and understand what moved the needle.",
  },
  {
    heading: "Custom Metrics",
    text: "Pro users can define up to 4 custom metrics to track habits or KPIs specific to their goals. These appear alongside the 6 core metrics on every day's scoring screen.",
    isPro: true,
  },
  {
    heading: "Score Map",
    text: "Pro users can see the global Score Map — a real-time world map showing where other Sweet Momentum members are scoring their days. Dots are colour-coded by score and plotted by location.",
    isPro: true,
  },
];

export default function TrackingGuidePage() {
  const [, setLocation] = useLocation();

  const { data: page, isLoading } = useQuery<SitePage>({
    queryKey: ["/api/pages", "tracking"],
    queryFn: () => apiRequest("GET", "/api/pages/tracking").then(r => r.json()),
  });

  const sections: Section[] = (() => {
    try {
      return page?.sections ? JSON.parse(page.sections) : DEFAULT_SECTIONS;
    } catch {
      return DEFAULT_SECTIONS;
    }
  })();

  const title = page?.title || "Daily Tracking";
  const subtitle = page?.subtitle || "How to use Sweet Momentum to build winning habits";
  const heroImage = page?.heroImageUrl;
  const body = page?.body;
  const ctaLabel = page?.ctaLabel;
  const ctaUrl = page?.ctaUrl;

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        {heroImage ? (
          <div className="absolute inset-0">
            <img src={heroImage} alt="Tracking hero" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-background to-background" />
        )}
        <div className="relative px-6 md:px-10 py-14 md:py-20 max-w-3xl">
          <Badge variant="outline" className="mb-4 gap-1.5 text-xs font-semibold tracking-widest uppercase">
            <Monitor className="w-3 h-3" />
            How It Works
          </Badge>
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-3/4 mb-3" />
              <Skeleton className="h-5 w-1/2" />
            </>
          ) : (
            <>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3 leading-tight">{title}</h1>
              {subtitle && <p className="text-base text-muted-foreground leading-relaxed">{subtitle}</p>}
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 md:px-10 py-10 max-w-3xl space-y-10">
        {body && (
          <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-line">{body}</p>
        )}

        {/* Quick start callout */}
        {!isLoading && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex items-start gap-4">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold mb-1">Quick Start</p>
              <p className="text-sm text-muted-foreground">
                Head to the <strong>Today</strong> page and score your first day right now. It takes less than 60 seconds.
              </p>
              <Button size="sm" className="mt-3 gap-1.5" onClick={() => setLocation("/today")}>
                Score Today
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ))}
          </div>
        ) : (
          sections.map((section, i) => (
            <div key={i} className="space-y-4">
              {section.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-border bg-muted aspect-video relative">
                  <img src={section.imageUrl} alt={section.heading} className="w-full h-full object-cover" />
                  {section.isPro && (
                    <div className="absolute top-3 right-3">
                      <Badge className="gap-1 text-[10px] bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Lock className="w-2.5 h-2.5" /> PRO
                      </Badge>
                    </div>
                  )}
                </div>
              )}
              {!section.imageUrl && section.isPro && (
                <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 h-32 flex items-center justify-center gap-2 text-yellow-400/60">
                  <Camera className="w-5 h-5" />
                  <span className="text-xs">Screenshot coming soon</span>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  section.isPro
                    ? "bg-yellow-500/20 border border-yellow-500/30"
                    : "bg-primary/20 border border-primary/30"
                }`}>
                  {section.isPro
                    ? <Zap className="w-3 h-3 text-yellow-400" />
                    : <CheckCircle2 className="w-3 h-3 text-primary" />
                  }
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-base font-black tracking-tight uppercase">{section.heading}</h2>
                    {section.isPro && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-bold tracking-widest text-yellow-400 border-yellow-500/40">
                        PRO
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{section.text}</p>
                </div>
              </div>
            </div>
          ))
        )}

        {/* CTA */}
        {ctaLabel && ctaUrl && (
          <div className="pt-2">
            <Button
              onClick={() => {
                if (ctaUrl.startsWith("http")) window.open(ctaUrl, "_blank");
                else setLocation(ctaUrl);
              }}
              className="gap-2"
            >
              {ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Bottom nav */}
        <div className="border-t border-border pt-8 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/story")} className="gap-1.5 text-xs">
            ← Story of Momentum
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/connect")} className="gap-1.5 text-xs">
            Connect
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
