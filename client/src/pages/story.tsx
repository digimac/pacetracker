import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BookOpen, Quote, Sparkles, ArrowRight } from "lucide-react";
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
  sections: string | null; // JSON [{heading, text, imageUrl}]
  ctaLabel: string | null;
  ctaUrl: string | null;
};

type Section = { heading: string; text: string; imageUrl?: string };

// Default content shown when the admin hasn't configured the page yet
const DEFAULT_SECTIONS: Section[] = [
  {
    heading: "Why Momentum?",
    text: "Momentum is the invisible force behind every great achievement. It isn't about giant leaps — it's about showing up consistently, measuring what matters, and building on each small win. Sweet Momentum was born from the idea that six simple daily metrics can reveal the patterns that separate forward motion from stagnation.",
  },
  {
    heading: "The Six Core Metrics",
    text: "TIME, GOAL, TEAM, TASK, VIEW, and PACE are the six pillars of daily performance. Each one represents a dimension of how we show up in our lives and work. Together, they form a complete picture of your daily momentum — not just productivity, but presence, purpose, and pace.",
  },
  {
    heading: "A Book. An App. A Practice.",
    text: "Sweet Momentum — the book — unpacks the philosophy behind each metric with stories, research, and real-world frameworks. The app is the daily practice that makes the ideas stick. Use them together to build a life where every day counts.",
  },
];

export default function StoryPage() {
  const [, setLocation] = useLocation();

  const { data: page, isLoading } = useQuery<SitePage>({
    queryKey: ["/api/pages", "story"],
    queryFn: () => apiRequest("GET", "/api/pages/story").then(r => r.json()),
  });

  const sections: Section[] = (() => {
    try {
      return page?.sections ? JSON.parse(page.sections) : DEFAULT_SECTIONS;
    } catch {
      return DEFAULT_SECTIONS;
    }
  })();

  const title = page?.title || "The Story of Momentum";
  const subtitle = page?.subtitle || "The book, the idea, and the metrics that drive it";
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
            <img src={heroImage} alt="Story hero" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        )}
        <div className="relative px-6 md:px-10 py-14 md:py-20 max-w-3xl">
          <Badge variant="outline" className="mb-4 gap-1.5 text-xs font-semibold tracking-widest uppercase">
            <BookOpen className="w-3 h-3" />
            Sweet Momentum
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
        {/* Intro body */}
        {body && (
          <p className="text-base text-muted-foreground leading-relaxed whitespace-pre-line">{body}</p>
        )}

        {isLoading ? (
          <div className="space-y-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </div>
            ))}
          </div>
        ) : (
          sections.map((section, i) => (
            <div key={i} className="space-y-4">
              {section.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-border aspect-video bg-muted">
                  <img src={section.imageUrl} alt={section.heading} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight uppercase mb-2">{section.heading}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{section.text}</p>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Pull quote */}
        <div className="border-l-2 border-primary pl-5 py-2">
          <Quote className="w-5 h-5 text-primary/40 mb-2" />
          <p className="text-base font-semibold italic leading-relaxed text-foreground">
            "Every day is a vote for who you are becoming. Cast it with intention."
          </p>
          <p className="text-xs text-muted-foreground mt-2 tracking-widest uppercase">— Sweet Momentum</p>
        </div>

        {/* CTA */}
        {ctaLabel && ctaUrl && (
          <div className="pt-2">
            <Button
              onClick={() => {
                if (ctaUrl.startsWith("http")) {
                  window.open(ctaUrl, "_blank");
                } else {
                  setLocation(ctaUrl);
                }
              }}
              className="gap-2"
            >
              {ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Nav to tracking */}
        <div className="border-t border-border pt-8 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Up next</p>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/tracking")} className="gap-1.5 text-xs">
            Daily Tracking Guide
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
