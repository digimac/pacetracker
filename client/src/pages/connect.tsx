import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Mail, MessageSquare, Twitter, Instagram, Linkedin, Globe, ArrowRight, Lightbulb, Star, Send, X, CheckCircle2, Loader2, Video, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/App";
import { useLocation } from "wouter";

type SitePage = {
  id: number;
  pageKey: string;
  title: string;
  subtitle: string | null;
  heroImageUrl: string | null;
  body: string | null;
  sections: string | null;
  contactEmail: string | null;
  socialLinks: string | null; // JSON [{platform, url, label}]
  ctaLabel: string | null;
  ctaUrl: string | null;
};

type SocialLink = { platform: string; url: string; label?: string };

const PLATFORM_ICONS: Record<string, typeof Mail> = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  website: Globe,
  email: Mail,
  default: Globe,
};

const DEFAULT_SOCIAL: SocialLink[] = [
  { platform: "twitter", url: "#", label: "@sweetmo_io" },
  { platform: "instagram", url: "https://instagram.com/sweetmo.io", label: "@sweetmo.io" },
  { platform: "website", url: "https://sweetmo.io", label: "sweetmo.io" },
];

const URGENCY_OPTIONS = [
  {
    value: "Fun Idea",
    label: "Fun Idea",
    description: "Would be cool someday",
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/30",
    activeBg: "bg-green-500/20 border-green-500/60",
  },
  {
    value: "Nice to Have",
    label: "Nice to Have",
    description: "Would improve things",
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    activeBg: "bg-blue-500/20 border-blue-500/60",
  },
  {
    value: "Urgent Fix Needed",
    label: "Urgent Fix Needed",
    description: "Something is broken",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    activeBg: "bg-red-500/20 border-red-500/60",
  },
] as const;

type UrgencyValue = "Fun Idea" | "Nice to Have" | "Urgent Fix Needed";


// ─── Coaching Request Modal ───────────────────────────────────────────────────

function CoachingModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [preferredDate, setPreferredDate] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || ""
  );
  const [topic, setTopic] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/coaching-request", { preferredDate, timezone, topic }).then(r => r.json()),
    onSuccess: () => setSubmitted(true),
    onError: (e: any) => toast({ title: "Error", description: e.message || "Could not submit request. Please try again.", variant: "destructive" }),
  });

  const canSubmit = preferredDate.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      {submitted ? (
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-lg font-black tracking-tight mb-2">Request Sent!</h2>
          <p className="text-sm text-muted-foreground mb-6">
            We've received your coaching request and will follow up with a confirmed Zoom link shortly.
          </p>
          <button onClick={onClose} className="text-xs text-primary hover:underline">Close</button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-primary" />
              <h2 className="text-base font-black tracking-tight">Request a Coaching Session</h2>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors" data-testid="btn-close-coaching">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Tell us when you'd like to meet and what you'd like to work on. We'll send you a Zoom link once confirmed.
            </p>

            {/* Preferred date/time */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Preferred Date & Time <span className="text-red-400">*</span>
              </label>
              <Input
                placeholder="e.g. Tuesday March 26, any time after 2pm"
                value={preferredDate}
                onChange={e => setPreferredDate(e.target.value)}
                data-testid="input-coaching-date"
              />
            </div>

            {/* Timezone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Timezone</label>
              <Input
                placeholder="e.g. America/New_York"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                data-testid="input-coaching-timezone"
              />
            </div>

            {/* Topic */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What would you like to work on?</label>
              <Textarea
                placeholder="e.g. Building better morning routines, staying consistent with my metrics, goal-setting..."
                value={topic}
                onChange={e => setTopic(e.target.value)}
                rows={3}
                className="resize-none"
                data-testid="input-coaching-topic"
              />
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-border flex-shrink-0">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !canSubmit}
              data-testid="btn-submit-coaching"
            >
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
              {mutation.isPending ? "Sending..." : "Request Session"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Feedback Modal ──────────────────────────────────────────────────────────

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [feedbackType, setFeedbackType] = useState("");
  const [summary, setSummary] = useState("");
  const [urgency, setUrgency] = useState<UrgencyValue | "">("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/feedback", { feedbackType, summary, urgency }).then(r => r.json()),
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Could not send feedback. Please try again.", variant: "destructive" });
    },
  });

  const canSubmit = feedbackType.trim().length > 0 && summary.trim().length >= 10 && urgency !== "";

  // Success state
  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7 text-green-400" />
          </div>
          <h2 className="text-lg font-black tracking-tight mb-2">Feedback Sent</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Thanks for taking the time. Your feedback has been sent to the team and we'll take a look.
          </p>
          <Button onClick={onClose} className="w-full">Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Star className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Leave Feedback</h2>
              <p className="text-xs text-muted-foreground">Goes directly to the team</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted"
            data-testid="btn-close-feedback"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Feedback Type */}
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Feedback Type
            </label>
            <Input
              placeholder="e.g. Bug report, Feature request, UI suggestion..."
              value={feedbackType}
              onChange={e => setFeedbackType(e.target.value)}
              maxLength={200}
              data-testid="input-feedback-type"
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{feedbackType.length}/200</p>
          </div>

          {/* Summary */}
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Summary
            </label>
            <Textarea
              placeholder="Describe your feedback in detail — what happened, what you'd like to see, or what could be better..."
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={5}
              maxLength={3000}
              className="resize-none text-sm"
              data-testid="textarea-feedback-summary"
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{summary.length}/3000</p>
          </div>

          {/* Urgency */}
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2 block">
              Urgency
            </label>
            <div className="grid grid-cols-3 gap-2">
              {URGENCY_OPTIONS.map(opt => {
                const isActive = urgency === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setUrgency(opt.value)}
                    data-testid={`urgency-${opt.value.toLowerCase().replace(/\s+/g, "-")}`}
                    className={`
                      rounded-xl border-2 p-3 text-left transition-all duration-150
                      ${isActive ? opt.activeBg : opt.bg}
                    `}
                  >
                    <p className={`text-xs font-black tracking-wide ${opt.color}`}>{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex-shrink-0 space-y-2">
          {!canSubmit && summary.trim().length > 0 && summary.trim().length < 10 && (
            <p className="text-[11px] text-muted-foreground text-center">Summary needs at least 10 characters</p>
          )}
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
            className="w-full gap-2"
            data-testid="btn-submit-feedback"
          >
            {submitMutation.isPending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
              : <><Send className="w-4 h-4" /> Send Feedback</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Connect Page ─────────────────────────────────────────────────────────────

const CONNECT_OPTIONS = [
  {
    icon: Mail,
    label: "Email the team",
    description: "Questions, partnerships, media enquiries",
    isEmail: true,
  },
  {
    icon: Lightbulb,
    label: "Request a feature",
    description: "Tell us what you'd love to see in the app",
    isFeature: true,
  },
  {
    icon: Star,
    label: "Leave feedback",
    description: "How's your experience with Sweet Momentum?",
    isFeedback: true,
  },
];

export default function ConnectPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: page, isLoading } = useQuery<SitePage>({
    queryKey: ["/api/pages", "connect"],
    queryFn: () => apiRequest("GET", "/api/pages/connect").then(r => r.json()),
  });

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [showCoaching, setShowCoaching] = useState(false);

  const { data: billing } = useQuery<{ isPro: boolean }>({
    queryKey: ["/api/billing/status"],
    queryFn: () => apiRequest("GET", "/api/billing/status").then(r => r.json()),
    enabled: !!user,
    staleTime: 60_000,
  });
  const isPro = billing?.isPro ?? false;

  const socialLinks: SocialLink[] = (() => {
    try {
      return page?.socialLinks ? JSON.parse(page.socialLinks) : DEFAULT_SOCIAL;
    } catch {
      return DEFAULT_SOCIAL;
    }
  })();

  const title = page?.title || "Connect";
  const subtitle = page?.subtitle || "Reach out, share feedback, and join the community";
  const heroImage = page?.heroImageUrl;
  const body = page?.body;
  const contactEmail = page?.contactEmail || "track@sweetmo.io";

  return (
    <div className="min-h-full">
      {/* Feedback modal */}
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
      {showCoaching && <CoachingModal onClose={() => setShowCoaching(false)} />}

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border">
        {heroImage ? (
          <div className="absolute inset-0">
            <img src={heroImage} alt="Connect hero" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-background to-background" />
        )}
        <div className="relative px-6 md:px-10 py-14 md:py-20 max-w-3xl">
          <Badge variant="outline" className="mb-4 gap-1.5 text-xs font-semibold tracking-widest uppercase">
            <MessageSquare className="w-3 h-3" />
            Get in Touch
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

        {/* Contact options */}
        {!isLoading && (
          <div className="grid gap-4 sm:grid-cols-3">
            {CONNECT_OPTIONS.map(({ icon: Icon, label, description, isEmail, isFeedback }) => (
              <Card
                key={label}
                className="border-border hover:border-primary/40 transition-colors cursor-pointer group"
                onClick={() => {
                  if (isEmail) window.open(`mailto:${contactEmail}`, "_blank");
                  if (isFeedback) setFeedbackOpen(true);
                }}
                data-testid={isFeedback ? "card-leave-feedback" : undefined}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
                  </div>
                  {isEmail && (
                    <p className="text-xs text-primary font-medium">{contactEmail}</p>
                  )}
                  {isFeedback && (
                    <p className="text-xs text-primary font-medium flex items-center gap-1">
                      Open form <ArrowRight className="w-3 h-3" />
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Social channels */}
        {!isLoading && socialLinks.length > 0 && (
          <div>
            <h2 className="text-sm font-black tracking-widest uppercase text-muted-foreground mb-4">Follow Along</h2>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map((link, i) => {
                const Icon = PLATFORM_ICONS[link.platform.toLowerCase()] || PLATFORM_ICONS.default;
                return (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-xs h-9"
                    onClick={() => {
                      if (link.url && link.url !== "#") window.open(link.url, "_blank");
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {link.label || link.platform}
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Coaching session card — Pro only */}
        <div className={`rounded-xl border p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
          isPro ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20 opacity-80"
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isPro ? "bg-primary/20 border border-primary/30" : "bg-muted/40 border border-border"
          }`}>
            <Video className={`w-5 h-5 ${isPro ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-bold">Book a Coaching Session</p>
              {!isPro && <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">Pro</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              {isPro
                ? "Request a 1-on-1 Zoom coaching session. Tell us your preferred time and what you'd like to work on."
                : "Upgrade to Pro to book a 1-on-1 coaching session via Zoom."}
            </p>
          </div>
          {isPro ? (
            <Button
              size="sm"
              className="gap-1.5 flex-shrink-0"
              onClick={() => setShowCoaching(true)}
              data-testid="btn-request-coaching"
            >
              <Video className="w-3.5 h-3.5" />
              Request Session
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 flex-shrink-0 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => setLocation("/billing")}
              data-testid="btn-upgrade-coaching"
            >
              <Lock className="w-3.5 h-3.5" />
              Upgrade to Pro
            </Button>
          )}
        </div>

        {/* Direct email CTA */}
        {!isLoading && (
          <div className="rounded-xl border border-border bg-muted/30 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Send className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold mb-0.5">Drop us a line</p>
              <p className="text-xs text-muted-foreground">
                We read every message. Reach us directly at{" "}
                <a href={`mailto:${contactEmail}`} className="text-primary hover:underline font-medium">
                  {contactEmail}
                </a>
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 flex-shrink-0"
              onClick={() => window.open(`mailto:${contactEmail}`, "_blank")}
            >
              <Mail className="w-3.5 h-3.5" />
              Email Us
            </Button>
          </div>
        )}

        {/* Bottom nav */}
        <div className="border-t border-border pt-8 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="gap-1.5 text-xs">
            ← Back
          </Button>
          <p className="text-xs text-muted-foreground">Sweet Momentum · {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
