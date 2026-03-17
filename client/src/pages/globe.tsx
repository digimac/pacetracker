import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Zap, Globe, RefreshCw } from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type ScorePoint = {
  userId: number;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  timezone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  coordinates: [number, number]; // [lon, lat]
  score: number;
  wins: number;
  losses: number;
  date: string;
};

/** Derive "K.M." style initials from first/last name or displayName fallback */
function getInitials(point: ScorePoint): string {
  const first = point.firstName?.trim();
  const last = point.lastName?.trim();
  if (first && last) return `${first[0].toUpperCase()}.${last[0].toUpperCase()}.`;
  if (first) return `${first[0].toUpperCase()}.`;
  // Fall back to splitting displayName on spaces
  const parts = (point.displayName || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0].toUpperCase()}.${parts[parts.length - 1][0].toUpperCase()}.`;
  if (parts.length === 1) return `${parts[0][0].toUpperCase()}.`;
  return "?";
}

function ScoreMarker({
  point,
  isHovered,
  onHover,
  onLeave,
}: {
  point: ScorePoint;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const isPositive = point.score > 0;
  const isNegative = point.score < 0;
  const isNeutral = point.score === 0;

  const dotColor = isPositive
    ? "#4ade80"   // green-400
    : isNegative
    ? "#f87171"   // red-400
    : "#94a3b8";  // slate-400

  const glowColor = isPositive
    ? "rgba(74,222,128,0.4)"
    : isNegative
    ? "rgba(248,113,113,0.4)"
    : "rgba(148,163,184,0.2)";

  const label = point.score > 0 ? `+${point.score}` : `${point.score}`;

  return (
    <Marker
      coordinates={point.coordinates}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Glow ring — only when hovered or positive */}
      {(isHovered || isPositive) && (
        <circle
          r={isHovered ? 14 : 10}
          fill={glowColor}
          style={{ transition: "all 0.2s" }}
        />
      )}

      {/* Main dot */}
      <circle
        r={isHovered ? 7 : 5}
        fill={dotColor}
        stroke={isHovered ? "#ffffff" : "rgba(0,0,0,0.4)"}
        strokeWidth={isHovered ? 1.5 : 1}
        style={{ cursor: "pointer", transition: "all 0.15s" }}
      />

      {/* Initials label — below the dot */}
      <text
        textAnchor="middle"
        y={isHovered ? 20 : 17}
        style={{
          fontSize: isHovered ? "7px" : "6px",
          fontFamily: "inherit",
          fontWeight: "700",
          fill: "#cbd5e1",
          letterSpacing: "0.04em",
          pointerEvents: "none",
          transition: "all 0.15s",
          textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        }}
      >
        {getInitials(point)}
      </text>

      {/* Score label — above the dot */}
      <text
        textAnchor="middle"
        y={-10}
        style={{
          fontSize: isHovered ? "8px" : "7px",
          fontFamily: "inherit",
          fontWeight: "900",
          fill: dotColor,
          letterSpacing: "0.05em",
          pointerEvents: "none",
          transition: "all 0.15s",
          textShadow: "0 1px 3px rgba(0,0,0,0.8)",
        }}
      >
        {label}
      </text>

      {/* Tooltip on hover */}
      {isHovered && (
        <g transform="translate(-52, -56)">
          <rect
            width={104}
            height={44}
            rx={6}
            fill="hsl(220 20% 10%)"
            stroke="hsl(220 20% 22%)"
            strokeWidth={1}
          />
          <text
            x={52}
            y={15}
            textAnchor="middle"
            style={{ fontSize: "8px", fill: "#e2e8f0", fontWeight: "700", fontFamily: "inherit" }}
          >
            {point.displayName}
          </text>
          <text
            x={52}
            y={27}
            textAnchor="middle"
            style={{ fontSize: "7px", fill: dotColor, fontWeight: "900", fontFamily: "inherit" }}
          >
            {label} · {point.wins}W / {point.losses}L
          </text>
          <text
            x={52}
            y={39}
            textAnchor="middle"
            style={{ fontSize: "6.5px", fill: "#64748b", fontFamily: "inherit" }}
          >
            {point.city && point.country
              ? `${point.city}${point.region ? `, ${point.region}` : ""} · ${point.country}`
              : point.timezone || ""}
          </text>
        </g>
      )}
    </Marker>
  );
}

export default function GlobePage() {
  const [, setLocation] = useLocation();
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const { data: billing } = useQuery<{ isPro: boolean }>({
    queryKey: ["/api/billing/status"],
    queryFn: () => apiRequest("GET", "/api/billing/status").then(r => r.json()),
  });
  const isPro = billing?.isPro ?? false;

  const { data: points = [], isLoading, refetch, isFetching } = useQuery<ScorePoint[]>({
    queryKey: ["/api/globe/scores"],
    queryFn: () => apiRequest("GET", "/api/globe/scores").then(r => r.json()),
    enabled: isPro,
    refetchInterval: 60_000, // auto-refresh every minute
  });

  // Stats
  const positiveCount = points.filter(p => p.score > 0).length;
  const negativeCount = points.filter(p => p.score < 0).length;
  const neutralCount = points.filter(p => p.score === 0).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-border flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight uppercase">Score Map</h1>
            <p className="text-xs text-muted-foreground">
              {isPro
                ? `${points.length} member${points.length !== 1 ? "s" : ""} plotting · updates every minute`
                : "Live scores plotted by timezone"}
            </p>
          </div>
        </div>

        {isPro && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 gap-1.5 text-xs"
            data-testid="btn-refresh-globe"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        )}
      </div>

      {/* Pro gate */}
      {!isPro ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
              <Globe className="w-8 h-8 text-primary/60" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight uppercase mb-2">Score Map</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                See where other Sweet Momentum members are scoring their days — plotted live on a world map, tied to their local timezone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> Win days</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Loss days</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Neutral</span>
            </div>
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
              <p className="text-xs text-yellow-400 font-semibold mb-1 flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" /> Pro Feature
              </p>
              <p className="text-xs text-muted-foreground mb-3">Unlock Score Map and custom metrics with Pro.</p>
              <Button size="sm" onClick={() => setLocation("/billing")} className="gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Legend / stats strip */}
          <div className="flex items-center gap-4 px-4 md:px-6 py-2.5 border-b border-border flex-shrink-0 flex-wrap gap-y-2">
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-green-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                {positiveCount} Win
              </span>
              <span className="flex items-center gap-1.5 text-red-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                {negativeCount} Loss
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground font-bold">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                {neutralCount} Neutral
              </span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                Scroll to zoom · Drag to pan
              </Badge>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 relative bg-[hsl(220_20%_6%)] min-h-0">
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <p className="text-xs">Loading scores...</p>
                </div>
              </div>
            ) : (
              <ComposableMap
                projection="geoMercator"
                style={{ width: "100%", height: "100%" }}
                projectionConfig={{ scale: 130, center: [10, 15] }}
              >
                <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={8}>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map(geo => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill="hsl(220 15% 14%)"
                          stroke="hsl(220 15% 20%)"
                          strokeWidth={0.4}
                          style={{
                            default: { outline: "none" },
                            hover: { outline: "none", fill: "hsl(220 15% 17%)" },
                            pressed: { outline: "none" },
                          }}
                        />
                      ))
                    }
                  </Geographies>

                  {points.map(point => (
                    <ScoreMarker
                      key={point.userId}
                      point={point}
                      isHovered={hoveredId === point.userId}
                      onHover={() => setHoveredId(point.userId)}
                      onLeave={() => setHoveredId(null)}
                    />
                  ))}
                </ZoomableGroup>
              </ComposableMap>
            )}

            {/* Empty state overlay */}
            {!isLoading && points.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-sm font-bold text-muted-foreground">No scores yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Score today to appear on the map
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
