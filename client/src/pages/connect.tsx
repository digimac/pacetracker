import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Mail, MessageSquare, Twitter, Instagram, Linkedin, Globe, ArrowRight, Lightbulb, Star, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { data: page, isLoading } = useQuery<SitePage>({
    queryKey: ["/api/pages", "connect"],
    queryFn: () => apiRequest("GET", "/api/pages/connect").then(r => r.json()),
  });

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
            {CONNECT_OPTIONS.map(({ icon: Icon, label, description, isEmail }) => (
              <Card key={label} className="border-border hover:border-primary/40 transition-colors cursor-pointer group"
                onClick={() => {
                  if (isEmail) window.open(`mailto:${contactEmail}`, "_blank");
                }}
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
