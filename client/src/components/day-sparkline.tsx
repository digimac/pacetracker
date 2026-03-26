import { useState, useRef } from "react";

export type TimelineEvent = {
  metricKey: string;
  metricLabel: string;
  rating: "success" | "setback";
  ratedAt: string | null;
};

export const CORE_METRIC_COLORS: Record<string, string> = {
  TIME: "#a78bfa",
  GOAL: "#34d399",
  TEAM: "#60a5fa",
  TASK: "#f59e0b",
  VIEW: "#f472b6",
  PACE: "#FF6E00",
};

const CUSTOM_METRIC_PALETTE = [
  "#e879f9", "#22d3ee", "#fb923c", "#a3e635", "#38bdf8", "#f43f5e", "#4ade80", "#fbbf24",
];

export function getMetricColor(metricKey: string, customIndex: number): string {
  return CORE_METRIC_COLORS[metricKey] ?? CUSTOM_METRIC_PALETTE[customIndex % CUSTOM_METRIC_PALETTE.length];
}

export function DaySparkline({ events }: { events: TimelineEvent[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; time: string; rating: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 600;
  const H = 72;
  const PAD_X = 28;
  const MID_Y = H / 2;
  const DOT_R = 5;
  const OFFSET_Y = 18;
  const TOOLTIP_ABOVE = 18;

  function timeToX(iso: string): number {
    const d = new Date(iso);
    const minutes = d.getHours() * 60 + d.getMinutes();
    return PAD_X + ((minutes / 1440) * (W - PAD_X * 2));
  }

  function showTooltip(e: TimelineEvent, svgX: number, dotY: number) {
    const d = new Date(e.ratedAt!);
    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;
    const scaleX = svgRect.width / W;
    const scaleY = svgRect.height / H;
    const tooltipY = (dotY - DOT_R - TOOLTIP_ABOVE) * scaleY;
    setTooltip({
      x: svgX * scaleX,
      y: Math.max(0, tooltipY),
      label: e.metricLabel,
      time: timeStr,
      rating: e.rating,
    });
  }

  const ticks = [
    { hour: 6,  label: "6am" },
    { hour: 12, label: "12pm" },
    { hour: 18, label: "6pm" },
  ];

  const validEvents = events.filter(e => e.ratedAt);

  return (
    <div className="relative" onClick={e => { if ((e.target as SVGElement).tagName !== "circle") setTooltip(null); }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 72 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Midline */}
        <line x1={PAD_X} y1={MID_Y} x2={W - PAD_X} y2={MID_Y} stroke="currentColor" strokeOpacity={0.2} strokeWidth={1} />

        {/* Hour ticks */}
        {ticks.map(t => {
          const x = PAD_X + (((t.hour * 60) / 1440) * (W - PAD_X * 2));
          return (
            <g key={t.hour}>
              <line x1={x} y1={MID_Y - 4} x2={x} y2={MID_Y + 4} stroke="currentColor" strokeOpacity={0.3} strokeWidth={1} />
              <text x={x} y={H - 4} textAnchor="middle" fontSize={9} fill="hsl(var(--foreground))" opacity={0.6}>{t.label}</text>
            </g>
          );
        })}

        {/* Start / end labels */}
        <text x={PAD_X} y={H - 4} textAnchor="middle" fontSize={9} fill="hsl(var(--foreground))" opacity={0.5}>12am</text>
        <text x={W - PAD_X} y={H - 4} textAnchor="middle" fontSize={9} fill="hsl(var(--foreground))" opacity={0.5}>12am</text>

        {/* Events */}
        {validEvents.map((e, i) => {
          const x = timeToX(e.ratedAt!);
          const isSuccess = e.rating === "success";
          const dotY = isSuccess ? MID_Y - OFFSET_Y : MID_Y + OFFSET_Y;
          const customIdx = validEvents.filter(ev => !CORE_METRIC_COLORS[ev.metricKey]).findIndex(ev => ev.metricKey === e.metricKey);
          const color = getMetricColor(e.metricKey, customIdx < 0 ? 0 : customIdx);
          return (
            <g key={i}>
              <line x1={x} y1={MID_Y} x2={x} y2={dotY} stroke={color} strokeWidth={1} strokeOpacity={0.4} />
              <circle
                cx={x} cy={dotY} r={DOT_R + 6}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => showTooltip(e, x, dotY)}
                onMouseLeave={() => setTooltip(null)}
                onClick={ev => { ev.stopPropagation(); showTooltip(e, x, dotY); }}
              />
              <circle
                cx={x} cy={dotY} r={DOT_R}
                fill={color}
                opacity={0.9}
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 pointer-events-none bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs shadow-lg -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <p className="font-bold text-foreground">{tooltip.label}</p>
          <p className={`text-[10px] font-semibold ${tooltip.rating === "success" ? "text-green-400" : "text-red-400"}`}>
            {tooltip.rating} · {tooltip.time}
          </p>
        </div>
      )}
    </div>
  );
}
