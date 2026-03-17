import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck, Save, ImageIcon, Quote, BookOpen,
  ChevronDown, ChevronUp, Loader2, Users, Settings2,
  Crown, Clock, Globe, FileText, Plus, Trash2, Link,
} from "lucide-react";
import type { MetricContent } from "@shared/schema";

type SitePage = {
  id: number;
  pageKey: string;
  title: string;
  subtitle: string | null;
  heroImageUrl: string | null;
  body: string | null;
  sections: string | null;
  contactEmail: string | null;
  socialLinks: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  updatedAt: string;
};

type PageSection = { heading: string; text: string; imageUrl?: string };
type SocialLink = { platform: string; url: string; label?: string };

const PAGE_DEFS = [
  { key: "story",    label: "Story of Momentum", icon: BookOpen,  accent: "text-violet-400", border: "border-violet-500/30", color: "from-violet-500/10 to-violet-600/5" },
  { key: "tracking", label: "Daily Tracking",     icon: Clock,     accent: "text-emerald-400", border: "border-emerald-500/30", color: "from-emerald-500/10 to-emerald-600/5" },
  { key: "connect",  label: "Connect",            icon: Globe,     accent: "text-blue-400", border: "border-blue-500/30", color: "from-blue-500/10 to-blue-600/5" },
];

// ─── Page Editor ─────────────────────────────────────────────────────────────

function PageEditor({ pageKey, label, icon: Icon, accent, border, color, existing, onSave, isSaving }: {
  pageKey: string;
  label: string;
  icon: any;
  accent: string;
  border: string;
  color: string;
  existing: SitePage | undefined;
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(existing?.title || "");
  const [subtitle, setSubtitle] = useState(existing?.subtitle || "");
  const [heroImageUrl, setHeroImageUrl] = useState(existing?.heroImageUrl || "");
  const [body, setBody] = useState(existing?.body || "");
  const [ctaLabel, setCtaLabel] = useState(existing?.ctaLabel || "");
  const [ctaUrl, setCtaUrl] = useState(existing?.ctaUrl || "");
  const [contactEmail, setContactEmail] = useState(existing?.contactEmail || "");
  const [sections, setSections] = useState<PageSection[]>(() => {
    try { return existing?.sections ? JSON.parse(existing.sections) : []; } catch { return []; }
  });
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(() => {
    try { return existing?.socialLinks ? JSON.parse(existing.socialLinks) : []; } catch { return []; }
  });

  useEffect(() => {
    setTitle(existing?.title || "");
    setSubtitle(existing?.subtitle || "");
    setHeroImageUrl(existing?.heroImageUrl || "");
    setBody(existing?.body || "");
    setCtaLabel(existing?.ctaLabel || "");
    setCtaUrl(existing?.ctaUrl || "");
    setContactEmail(existing?.contactEmail || "");
    try { setSections(existing?.sections ? JSON.parse(existing.sections) : []); } catch { setSections([]); }
    try { setSocialLinks(existing?.socialLinks ? JSON.parse(existing.socialLinks) : []); } catch { setSocialLinks([]); }
  }, [existing]);

  function addSection() {
    setSections(s => [...s, { heading: "", text: "", imageUrl: "" }]);
  }
  function updateSection(i: number, field: keyof PageSection, value: string) {
    setSections(s => s.map((sec, idx) => idx === i ? { ...sec, [field]: value } : sec));
  }
  function removeSection(i: number) {
    setSections(s => s.filter((_, idx) => idx !== i));
  }
  function addSocial() {
    setSocialLinks(l => [...l, { platform: "", url: "", label: "" }]);
  }
  function updateSocial(i: number, field: keyof SocialLink, value: string) {
    setSocialLinks(l => l.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }
  function removeSocial(i: number) {
    setSocialLinks(l => l.filter((_, idx) => idx !== i));
  }

  function handleSave() {
    onSave({
      pageKey,
      title: title || label,
      subtitle,
      heroImageUrl,
      body,
      sections: JSON.stringify(sections.filter(s => s.heading || s.text)),
      ctaLabel,
      ctaUrl,
      contactEmail,
      socialLinks: JSON.stringify(socialLinks.filter(s => s.platform && s.url)),
    });
  }

  const isConfigured = !!(existing?.body || existing?.heroImageUrl || existing?.sections);

  return (
    <div className={`rounded-xl border-2 ${border} bg-gradient-to-b ${color} overflow-hidden transition-all duration-200`}>
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setExpanded(e => !e)}
        data-testid={`admin-page-${pageKey}`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`w-4 h-4 ${accent}`} />
          <span className={`text-base font-black tracking-tight ${accent}`}>{label}</span>
          {isConfigured && (
            <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/60">
              Configured
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-5">
          {/* Title + Subtitle */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">Page Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={label} className="text-sm" maxLength={100} />
            </div>
            <div>
              <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">Subtitle</label>
              <Input value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Short tagline" className="text-sm" maxLength={200} />
            </div>
          </div>

          {/* Hero image */}
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 flex items-center gap-1.5">
              <ImageIcon className="w-3 h-3" /> Hero Image URL
            </label>
            <Input value={heroImageUrl} onChange={e => setHeroImageUrl(e.target.value)} placeholder="https://..." className="text-sm font-mono" />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">Intro Body</label>
            <Textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Introductory text shown at the top of the page..."
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          {/* Content sections */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Content Sections</label>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addSection}>
                <Plus className="w-3 h-3" /> Add Section
              </Button>
            </div>
            {sections.length === 0 && (
              <p className="text-xs text-muted-foreground/60 italic">No sections yet. Add one to create custom content blocks.</p>
            )}
            <div className="space-y-4">
              {sections.map((sec, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Section {i + 1}</span>
                    <button onClick={() => removeSection(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Input
                    value={sec.heading}
                    onChange={e => updateSection(i, "heading", e.target.value)}
                    placeholder="Section heading"
                    className="text-sm"
                    maxLength={100}
                  />
                  <Textarea
                    value={sec.text}
                    onChange={e => updateSection(i, "text", e.target.value)}
                    placeholder="Section body text..."
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <Input
                    value={sec.imageUrl || ""}
                    onChange={e => updateSection(i, "imageUrl", e.target.value)}
                    placeholder="Image URL (optional) — https://..."
                    className="text-sm font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 flex items-center gap-1.5">
                <Link className="w-3 h-3" /> CTA Button Label
              </label>
              <Input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="e.g. Get the Book" className="text-sm" maxLength={60} />
            </div>
            <div>
              <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">CTA URL</label>
              <Input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://... or /billing" className="text-sm font-mono" maxLength={300} />
            </div>
          </div>

          {/* Connect-specific: email + social links */}
          {pageKey === "connect" && (
            <>
              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">Contact Email</label>
                <Input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="track@sweetmo.io" className="text-sm" type="email" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Social Links</label>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addSocial}>
                    <Plus className="w-3 h-3" /> Add Link
                  </Button>
                </div>
                <div className="space-y-3">
                  {socialLinks.map((link, i) => (
                    <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground uppercase tracking-widest">Link {i + 1}</span>
                        <button onClick={() => removeSocial(i)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input value={link.platform} onChange={e => updateSocial(i, "platform", e.target.value)} placeholder="twitter" className="text-sm" />
                        <Input value={link.label || ""} onChange={e => updateSocial(i, "label", e.target.value)} placeholder="@handle" className="text-sm" />
                        <Input value={link.url} onChange={e => updateSocial(i, "url", e.target.value)} placeholder="https://..." className="text-sm font-mono" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Save */}
          <Button onClick={handleSave} disabled={isSaving} className="w-full" data-testid={`btn-save-page-${pageKey}`}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save {label}
          </Button>

          {existing?.updatedAt && (
            <p className="text-xs text-muted-foreground/60 text-center">
              Last saved {new Date(existing.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

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

type Member = {
  id: number;
  username: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
  plan: string;
  planStatus: string;
  isPro: boolean;
  timezone: string | null;
  latestScore: { date: string; score: number; wins: number; losses: number } | null;
};

/** Masks a string: first char visible, rest replaced with *** */
function mask(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 1) return value;
  return value[0] + "***";
}

/** Masks an email preserving the domain structure:
 *  j***@e***.com  */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return mask(email);
  const [domainName, ...tld] = domain.split(".");
  return `${mask(local)}@${mask(domainName)}.${tld.join(".")}`;
}

function PlanBadge({ isPro, plan }: { isPro: boolean; plan: string }) {
  if (isPro) {
    const label = plan === "pro_annual" ? "Pro Annual" : "Pro Monthly";
    return (
      <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1 w-fit">
        <Crown className="w-2.5 h-2.5" />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] text-muted-foreground w-fit">
      Free
    </Badge>
  );
}

// ─── Metric Editor ───────────────────────────────────────────────────────────

interface MetricEditorProps {
  metricKey: string;
  label: string;
  color: string;
  accent: string;
  border: string;
  existing: MetricContent | undefined;
  onSave: (data: { metricKey: string; subtext: string; prompt: string; story: string; imageUrl: string; quote: string; quoteAuthor: string }) => void;
  isSaving: boolean;
}

function MetricEditor({ metricKey, label, color, accent, border, existing, onSave, isSaving }: MetricEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [subtext, setSubtext] = useState(existing?.subtext || "");
  const [prompt, setPrompt] = useState((existing as any)?.prompt || "");
  const [story, setStory] = useState(existing?.story || "");
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl || "");
  const [quote, setQuote] = useState(existing?.quote || "");
  const [quoteAuthor, setQuoteAuthor] = useState(existing?.quoteAuthor || "");

  // Sync when existing content loads
  useEffect(() => {
    setSubtext(existing?.subtext || "");
    setPrompt((existing as any)?.prompt || "");
    setStory(existing?.story || "");
    setImageUrl(existing?.imageUrl || "");
    setQuote(existing?.quote || "");
    setQuoteAuthor(existing?.quoteAuthor || "");
  }, [existing]);

  const hasContent = !!(existing?.story || existing?.imageUrl || existing?.quote || existing?.subtext || (existing as any)?.prompt);

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

          {/* Short Description (subtext — shown on Settings page) */}
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Short Description
            </label>
            <p className="text-[10px] text-muted-foreground/70 mb-1.5">Shown on the Settings page in the Core Metrics pane.</p>
            <Input
              placeholder={`e.g. Intentional time management`}
              value={subtext}
              onChange={e => setSubtext(e.target.value)}
              className="text-sm"
              maxLength={200}
              data-testid={`input-subtext-${metricKey.toLowerCase()}`}
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{subtext.length}/200</p>
          </div>

          {/* Metrics Prompt (prompt — shown on Today scoring page) */}
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Metrics Prompt
            </label>
            <p className="text-[10px] text-muted-foreground/70 mb-1.5">Shown inside the scoring card on the Today page when users rate this metric.</p>
            <Textarea
              placeholder={`e.g. Did you manage your time with intention today?`}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              maxLength={300}
              data-testid={`input-prompt-${metricKey.toLowerCase()}`}
            />
            <p className="text-[10px] text-muted-foreground mt-1 text-right">{prompt.length}/300</p>
          </div>

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
            onClick={() => onSave({ metricKey, subtext, prompt, story, imageUrl, quote, quoteAuthor })}
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

// ─── Members Tab ─────────────────────────────────────────────────────────────

function MembersTab() {
  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ["/api/admin/members"],
    queryFn: () => apiRequest("GET", "/api/admin/members").then(r => r.json()),
  });

  const proCount = members.filter(m => m.isPro).length;
  const freeCount = members.length - proCount;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Members", value: members.length, color: "text-foreground" },
          { label: "Pro", value: proCount, color: "text-amber-400" },
          { label: "Free", value: freeCount, color: "text-muted-foreground" },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg border border-border bg-muted/30 p-3 text-center">
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Member rows */}
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No members yet.</p>
      ) : (
        <div className="space-y-2">
          {members.map((m, i) => (
            <div
              key={m.id}
              className="rounded-xl border border-border bg-card p-4 space-y-3"
              data-testid={`member-row-${m.id}`}
            >
              {/* Row header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-black text-sm text-primary flex-shrink-0">
                    {(m.displayName || m.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{m.displayName}</p>
                    <p className="text-xs text-muted-foreground">Member #{i + 1}</p>
                  </div>
                </div>
                <PlanBadge isPro={m.isPro} plan={m.plan} />
              </div>

              {/* Masked details grid */}
              <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-border">
                {(m.firstName || m.lastName) && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 w-20 flex-shrink-0">Name</span>
                    <span className="text-xs text-foreground/80">
                      {[m.firstName, m.lastName].filter(Boolean).join(" ")}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 w-20 flex-shrink-0">Username</span>
                  <span className="text-xs font-mono text-foreground/80">{mask(m.username)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 w-20 flex-shrink-0">Email</span>
                  <span className="text-xs font-mono text-foreground/80">{maskEmail(m.email)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 w-20 flex-shrink-0 flex items-center gap-1">
                    <Globe className="w-2.5 h-2.5" /> TZ
                  </span>
                  <span className="text-xs font-mono text-foreground/80">{m.timezone || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 w-20 flex-shrink-0 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> Joined
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </div>

                {/* Latest score */}
                {m.latestScore && (
                  <div className="flex items-center gap-2 pt-1 mt-1 border-t border-border">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 w-20 flex-shrink-0">Last Score</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-black ${
                        m.latestScore.score > 0 ? "text-green-400"
                        : m.latestScore.score < 0 ? "text-red-400"
                        : "text-muted-foreground"
                      }`}>
                        {m.latestScore.score > 0 ? `+${m.latestScore.score}` : m.latestScore.score}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {m.latestScore.wins}W / {m.latestScore.losses}L
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        {new Date(m.latestScore.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"content" | "members" | "pages">("content");
  const [savingPageKey, setSavingPageKey] = useState<string | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.email !== ADMIN_EMAIL) setLocation("/dashboard");
  }, [user]);

  const { data: pagesArray = [], isLoading: pagesLoading } = useQuery<SitePage[]>({
    queryKey: ["/api/pages"],
    queryFn: () => apiRequest("GET", "/api/pages").then(r => r.json()),
  });
  const pagesMap: Record<string, SitePage> = {};
  pagesArray.forEach(p => { pagesMap[p.pageKey] = p; });

  const savePageMutation = useMutation({
    mutationFn: (data: any) => {
      setSavingPageKey(data.pageKey);
      return apiRequest("PUT", `/api/admin/pages/${data.pageKey}`, data).then(r => r.json());
    },
    onSuccess: (_, vars) => {
      setSavingPageKey(null);
      queryClient.invalidateQueries({ queryKey: ["/api/pages"] });
      toast({ title: "Saved", description: `${vars.pageKey} page updated.` });
    },
    onError: (e: any) => {
      setSavingPageKey(null);
      toast({ title: "Error", description: e.message || "Save failed", variant: "destructive" });
    },
  });

  const { data: contentArray = [], isLoading } = useQuery<MetricContent[]>({
    queryKey: ["/api/metric-content"],
    queryFn: () => apiRequest("GET", "/api/metric-content").then(r => r.json()),
  });

  const contentMap: ContentMap = {};
  contentArray.forEach(c => { contentMap[c.metricKey] = c; });

  const saveMutation = useMutation({
    mutationFn: (data: { metricKey: string; subtext: string; prompt: string; story: string; imageUrl: string; quote: string; quoteAuthor: string }) => {
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
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight uppercase">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">Sweet Momentum control panel</p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 border border-border mb-6">
        {([
          { key: "content", label: "Metric Content", icon: Settings2 },
          { key: "pages",   label: "Pages",          icon: FileText },
          { key: "members", label: "Members",         icon: Users },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            data-testid={`tab-${key}`}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === key
                ? "bg-card border border-border text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "content" && (
        <>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Configure the story, image, and quote shown in each metric's info modal. Users can open these by tapping the info icon on the Today page.
          </p>
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
        </>
      )}

      {activeTab === "pages" && (
        <>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Configure the three content pages accessible to all users: <strong>Story of Momentum</strong>, <strong>Daily Tracking</strong>, and <strong>Connect</strong>.
          </p>
          {pagesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {PAGE_DEFS.map(p => (
                <PageEditor
                  key={p.key}
                  pageKey={p.key}
                  label={p.label}
                  icon={p.icon}
                  accent={p.accent}
                  border={p.border}
                  color={p.color}
                  existing={pagesMap[p.key]}
                  onSave={data => savePageMutation.mutate(data)}
                  isSaving={savingPageKey === p.key && savePageMutation.isPending}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "members" && <MembersTab />}
    </div>
  );
}
