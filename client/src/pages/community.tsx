import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { USER_CATEGORIES } from "@/lib/categories";

type SitePage = {
  id: number;
  pageKey: string;
  title: string | null;
  subtitle: string | null;
  heroImageUrl: string | null;
  body: string | null;
  sections: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

type Section = { heading: string; text: string; imageUrl?: string };

// Default content per category shown before admin configures the page
const CATEGORY_DEFAULTS: Record<string, { title: string; subtitle: string; body: string }> = {
  athlete: {
    title: "Athletes",
    subtitle: "Track your performance, build momentum every day.",
    body: "Whether you're training for competition or chasing personal bests, daily momentum is what separates good athletes from great ones. Sweet Momentum gives you the daily accountability system to measure what matters most.",
  },
  graduate: {
    title: "Graduates",
    subtitle: "Navigate the next chapter with clarity and purpose.",
    body: "The transition from student to professional is one of the most transformative periods of your life. Sweet Momentum helps you stay focused on your goals, build productive habits, and track your daily progress through this critical chapter.",
  },
  recovery: {
    title: "Recovery",
    subtitle: "Progress over perfection, one day at a time.",
    body: "Every day in recovery is a victory. Sweet Momentum is built on the belief that showing up consistently — even on the hard days — is what creates lasting change. Track your daily momentum and celebrate every step forward.",
  },
  veteran: {
    title: "Veterans",
    subtitle: "Mission-driven performance tracking for those who served.",
    body: "Veterans bring discipline, resilience, and purpose to everything they do. Sweet Momentum channels that mission-driven mindset into a daily performance system that keeps you focused, accountable, and moving forward.",
  },
  caregiver: {
    title: "Caregivers",
    subtitle: "You can't pour from an empty cup. Track your own momentum.",
    body: "Caregivers give so much to others that they often forget to measure their own wellbeing. Sweet Momentum helps you check in with yourself daily — tracking the six dimensions that keep you performing at your best for the people who need you.",
  },
  entrepreneur: {
    title: "Entrepreneurs",
    subtitle: "Build something great by building great days.",
    body: "Great companies are built one great day at a time. Sweet Momentum gives entrepreneurs a daily performance system that tracks the personal metrics behind business success — focus, energy, team, and pace.",
  },
  writer: {
    title: "Writers",
    subtitle: "Show up to the page. Track the practice.",
    body: "Writing is a daily practice. Sweet Momentum helps writers build the habits and accountability that separate those who talk about writing from those who actually do it. Track your daily momentum and watch your output grow.",
  },
  musician: {
    title: "Musicians",
    subtitle: "Every great performance starts with daily practice.",
    body: "Music is built in the daily work — the practice sessions, the creative output, the discipline. Sweet Momentum helps musicians track their daily performance across six key dimensions, building the consistency that leads to breakthrough.",
  },
};

export default function CategoryPage({ categoryKey }: { categoryKey: string }) {
  const [, setLocation] = useLocation();
  const catDef = USER_CATEGORIES.find(c => c.key === categoryKey);
  const defaults = CATEGORY_DEFAULTS[categoryKey] ?? {
    title: catDef?.label ?? categoryKey,
    subtitle: "Track your daily momentum.",
    body: "",
  };
  const pageKey = `cat_${categoryKey}`;

  const { data: page, isLoading } = useQuery<SitePage>({
    queryKey: ["/api/pages", pageKey],
    queryFn: () => apiRequest("GET", `/api/pages/${pageKey}`).then(r => r.ok ? r.json() : null).catch(() => null),
    staleTime: 5 * 60 * 1000,
  });

  const title    = page?.title    || defaults.title;
  const subtitle = page?.subtitle || defaults.subtitle;
  const body     = page?.body     || defaults.body;
  const heroImg  = page?.heroImageUrl || null;
  const ctaLabel = page?.ctaLabel || null;
  const ctaUrl   = page?.ctaUrl   || null;

  const sections: Section[] = (() => {
    try { return page?.sections ? JSON.parse(page.sections) : []; } catch { return []; }
  })();

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        {heroImg ? (
          <div className="absolute inset-0">
            <img src={heroImg} alt={title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        )}
        <div className="relative px-6 md:px-10 py-14 md:py-20 max-w-3xl">
          <Badge variant="outline" className="mb-4 gap-1.5 text-xs font-semibold tracking-widest uppercase">
            <span className="text-base leading-none">{catDef?.emoji}</span>
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
            {[1, 2].map(i => (
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

        {/* Back to settings */}
        <div className="border-t border-border pt-8">
          <Button variant="ghost" size="sm" onClick={() => setLocation("/settings")} className="gap-1.5 text-xs">
            <ArrowLeft className="w-3 h-3" />
            Back to Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
