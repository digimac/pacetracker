import { useEffect, useRef } from "react";
import { X, Quote } from "lucide-react";
import type { MetricContent } from "@shared/schema";

const METRIC_COLORS: Record<string, { accent: string; glow: string; bg: string }> = {
  TIME: { accent: "text-violet-400", glow: "shadow-violet-500/20", bg: "from-violet-500/10" },
  GOAL: { accent: "text-amber-400",  glow: "shadow-amber-500/20",  bg: "from-amber-500/10"  },
  TEAM: { accent: "text-cyan-400",   glow: "shadow-cyan-500/20",   bg: "from-cyan-500/10"   },
  TASK: { accent: "text-emerald-400",glow: "shadow-emerald-500/20",bg: "from-emerald-500/10" },
  VIEW: { accent: "text-rose-400",   glow: "shadow-rose-500/20",   bg: "from-rose-500/10"   },
  PACE: { accent: "text-blue-400",   glow: "shadow-blue-500/20",   bg: "from-blue-500/10"   },
};

const DEFAULT_CONTENT: Record<string, { story: string; quote: string; quoteAuthor: string }> = {
  TIME: {
    story: "Time is the one resource you can never reclaim. How you spend each hour is a vote for the life you want to live. Intentional time management means choosing what matters most and protecting it fiercely.",
    quote: "The key is not to prioritize what's on your schedule, but to schedule your priorities.",
    quoteAuthor: "Stephen Covey",
  },
  GOAL: {
    story: "A goal without a plan is just a wish. Each day you pursue your primary goal with focus, you build the momentum that transforms vision into reality. Small consistent steps compound into extraordinary outcomes.",
    quote: "A goal is not always meant to be reached; it often serves simply as something to aim at.",
    quoteAuthor: "Bruce Lee",
  },
  TEAM: {
    story: "No one achieves greatness alone. Your contribution to the people around you — teammates, colleagues, family — shapes the collective energy you all move through. Show up for others and they show up for you.",
    quote: "Alone we can do so little; together we can do so much.",
    quoteAuthor: "Helen Keller",
  },
  TASK: {
    story: "The most important task of the day rarely feels the most urgent. Choosing to tackle your highest-leverage work before the day dilutes your attention is the discipline that separates consistent performers from the rest.",
    quote: "Do the hard jobs first. The easy jobs will take care of themselves.",
    quoteAuthor: "Dale Carnegie",
  },
  VIEW: {
    story: "Perspective is the lens through which every event passes. Keeping a clear view means stepping back from the noise to see the bigger picture — your purpose, your trajectory, and what truly matters long-term.",
    quote: "We can complain because rose bushes have thorns, or rejoice because thorns have roses.",
    quoteAuthor: "Alphonse Karr",
  },
  PACE: {
    story: "Sustainable performance comes from finding the right rhythm — not sprinting until burnout, not coasting below potential. Pace is the art of knowing when to push, when to recover, and how to maintain momentum over the long run.",
    quote: "It does not matter how slowly you go as long as you do not stop.",
    quoteAuthor: "Confucius",
  },
};

interface MetricInfoModalProps {
  metricKey: string;
  metricLabel: string;
  content: MetricContent | undefined;
  onClose: () => void;
}

export default function MetricInfoModal({ metricKey, metricLabel, content, onClose }: MetricInfoModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const colors = METRIC_COLORS[metricKey] || METRIC_COLORS["PACE"];
  const defaults = DEFAULT_CONTENT[metricKey];

  const story = content?.story || defaults?.story || "";
  const imageUrl = content?.imageUrl || null;
  const quote = content?.quote || defaults?.quote || "";
  const quoteAuthor = content?.quoteAuthor || defaults?.quoteAuthor || "";

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      data-testid="metric-info-modal-overlay"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal panel */}
      <div
        className={`
          relative w-full max-w-md bg-background rounded-2xl border border-border
          shadow-2xl ${colors.glow} overflow-hidden
          animate-in fade-in zoom-in-95 duration-200
        `}
        data-testid="metric-info-modal"
      >
        {/* Hero image */}
        {imageUrl && (
          <div className="relative h-40 w-full overflow-hidden">
            <img
              src={imageUrl}
              alt={`${metricLabel} visual`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80" />
          </div>
        )}

        {/* Header */}
        <div className={`px-6 pt-5 pb-3 bg-gradient-to-b ${colors.bg} to-transparent`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className={`text-2xl font-black tracking-widest ${colors.accent}`}>
                {metricLabel}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5 tracking-widest uppercase font-medium">
                Core Metric
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
              data-testid="btn-close-metric-modal"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-5">
          {/* Story */}
          {story && (
            <div>
              <p className="text-sm leading-relaxed text-foreground/90">{story}</p>
            </div>
          )}

          {/* Quote */}
          {quote && (
            <div className={`border-l-2 ${colors.accent.replace("text-", "border-")} pl-4 py-1`}>
              <div className="flex gap-2 items-start">
                <Quote className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${colors.accent} opacity-70`} />
                <div>
                  <p className="text-sm italic text-foreground/80 leading-relaxed">"{quote}"</p>
                  {quoteAuthor && (
                    <p className={`text-xs font-semibold mt-1 ${colors.accent}`}>— {quoteAuthor}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
