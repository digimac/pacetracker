import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/App";
import { useLocation } from "wouter";
import { useState } from "react";
import { Users, UserPlus, Send, X, Clock, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type Connection = {
  connectionId: number;
  partnerId: number;
  partnerName: string;
  todayScore: number | null;
};

// ── Geometry helpers ────────────────────────────────────────────────────────
function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function scoreColor(score: number | null): string {
  if (score === null) return "#555";
  if (score >= 7) return "#FF6E00";
  if (score > 0)  return "#85FF00";
  if (score < 0)  return "#ff5555";
  return "#555";
}

// ── Network Diagram ─────────────────────────────────────────────────────────
function NetworkDiagram({ user, partners }: { user: any; partners: Connection[] }) {
  const CX = 400;
  const CY = 360;
  const ORBIT_R = 200;        // radius of partner orbit
  const CENTER_R = 54;        // radius of user node
  const PARTNER_R = 42;       // radius of partner nodes
  const SVG_W = 800;
  const SVG_H = 720;

  const userInitials = getInitials(
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.displayName || user.email
  );
  const userDisplayName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.displayName || user.email;

  // Spread partners evenly around the circle
  const angleStep = partners.length > 0 ? 360 / partners.length : 0;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-auto select-none"
      style={{ maxHeight: "680px" }}
    >
      <defs>
        {/* Radial glow for center node */}
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#FF6E00" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FF6E00" stopOpacity="0" />
        </radialGradient>
        {/* Subtle orbit ring gradient */}
        <radialGradient id="orbitGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.04)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* Partner node glow per score */}
        {partners.map((p, i) => (
          <radialGradient key={`pg-${i}`} id={`partnerGlow-${i}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={scoreColor(p.todayScore)} stopOpacity="0.2" />
            <stop offset="100%" stopColor={scoreColor(p.todayScore)} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>

      {/* Orbit rings */}
      <circle cx={CX} cy={CY} r={ORBIT_R + 30} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} strokeDasharray="4 8" />
      <circle cx={CX} cy={CY} r={ORBIT_R}      fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      <circle cx={CX} cy={CY} r={ORBIT_R - 30} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={1} strokeDasharray="2 10" />

      {/* Center glow halo */}
      <circle cx={CX} cy={CY} r={CENTER_R + 40} fill="url(#centerGlow)" />

      {/* Connecting lines */}
      {partners.map((p, i) => {
        const angle = i * angleStep;
        const pos   = polarToXY(CX, CY, ORBIT_R, angle);
        const col   = scoreColor(p.todayScore);
        return (
          <line
            key={`line-${i}`}
            x1={CX} y1={CY}
            x2={pos.x} y2={pos.y}
            stroke={col}
            strokeWidth={1.5}
            strokeOpacity={0.35}
            strokeDasharray="6 5"
          />
        );
      })}

      {/* Partner nodes */}
      {partners.map((p, i) => {
        const angle    = i * angleStep;
        const pos      = polarToXY(CX, CY, ORBIT_R, angle);
        const col      = scoreColor(p.todayScore);
        const initials = getInitials(p.partnerName);
        const score    = p.todayScore;

        // Label position — push further out
        const labelPos = polarToXY(CX, CY, ORBIT_R + PARTNER_R + 20, angle);
        // Anchor text based on left/right half
        const textAnchor = pos.x < CX - 10 ? "end" : pos.x > CX + 10 ? "start" : "middle";

        return (
          <g key={`partner-${i}`}>
            {/* Glow halo */}
            <circle cx={pos.x} cy={pos.y} r={PARTNER_R + 20} fill={`url(#partnerGlow-${i})`} />

            {/* Outer ring */}
            <circle cx={pos.x} cy={pos.y} r={PARTNER_R + 3}
              fill="none"
              stroke={col}
              strokeWidth={1.5}
              strokeOpacity={0.4}
            />

            {/* Node background */}
            <circle cx={pos.x} cy={pos.y} r={PARTNER_R}
              fill="hsl(220, 14%, 10%)"
              stroke={col}
              strokeWidth={2}
            />

            {/* Initials */}
            <text
              x={pos.x} y={pos.y - 5}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={14}
              fontWeight="800"
              fontFamily="'Cabinet Grotesk', system-ui, sans-serif"
              fill={col}
            >
              {initials}
            </text>

            {/* Score */}
            <text
              x={pos.x} y={pos.y + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fontWeight="700"
              fontFamily="monospace"
              fill={col}
              opacity={0.85}
            >
              {score === null ? "—" : score > 0 ? `+${score}` : `${score}`}
            </text>

            {/* Name label outside node */}
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              fontSize={11}
              fontWeight="600"
              fontFamily="'Cabinet Grotesk', system-ui, sans-serif"
              fill="rgba(255,255,255,0.55)"
            >
              {p.partnerName.length > 18 ? p.partnerName.slice(0, 16) + "…" : p.partnerName}
            </text>
          </g>
        );
      })}

      {/* CENTER NODE */}
      {/* Outer pulse ring */}
      <circle cx={CX} cy={CY} r={CENTER_R + 10}
        fill="none"
        stroke="rgba(255,110,0,0.25)"
        strokeWidth={2}
      />
      {/* Node bg */}
      <circle cx={CX} cy={CY} r={CENTER_R}
        fill="hsl(220, 14%, 8%)"
        stroke="#FF6E00"
        strokeWidth={2.5}
      />
      {/* User initials */}
      <text
        x={CX} y={CY - 7}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={18}
        fontWeight="900"
        fontFamily="'Cabinet Grotesk', system-ui, sans-serif"
        fill="#FF6E00"
      >
        {userInitials}
      </text>
      {/* "You" label */}
      <text
        x={CX} y={CY + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fontWeight="700"
        fontFamily="'Cabinet Grotesk', system-ui, sans-serif"
        fill="rgba(255,110,0,0.7)"
        letterSpacing="0.1em"
      >
        YOU
      </text>

      {/* Display name below center */}
      <text
        x={CX} y={CY + CENTER_R + 16}
        textAnchor="middle"
        fontSize={12}
        fontWeight="700"
        fontFamily="'Cabinet Grotesk', system-ui, sans-serif"
        fill="rgba(255,255,255,0.45)"
      >
        {userDisplayName.length > 20 ? userDisplayName.slice(0, 18) + "…" : userDisplayName}
      </text>

      {/* Empty state text (no partners yet) */}
      {partners.length === 0 && (
        <text
          x={CX} y={CY + 100}
          textAnchor="middle"
          fontSize={13}
          fill="rgba(255,255,255,0.25)"
          fontFamily="'Cabinet Grotesk', system-ui, sans-serif"
        >
          No momentum partners yet
        </text>
      )}
    </svg>
  );
}

// ── Legend ──────────────────────────────────────────────────────────────────
function Legend() {
  const items = [
    { color: "#FF6E00", label: "Score 7+ (High momentum)" },
    { color: "#85FF00", label: "Positive score" },
    { color: "#ff5555", label: "Negative score" },
    { color: "#555",    label: "No score today" },
  ];
  return (
    <div className="flex flex-wrap gap-4 justify-center mt-2">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-[11px] text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
type Invite = {
  id: number;
  inviteeEmail: string;
  status: string;
  createdAt: string;
};

// ── Invite Panel ────────────────────────────────────────────────────────────
function InvitePanel() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const { data: invites = [], refetch: refetchInvites } = useQuery<Invite[]>({
    queryKey: ["/api/invites"],
    queryFn: () => apiRequest("GET", "/api/invites").then(r => r.json()),
    staleTime: 30_000,
  });

  const pendingInvites = invites.filter(i => i.status === "pending");

  const sendInvite = useMutation({
    mutationFn: () => apiRequest("POST", "/api/invites", {
      inviteeEmail: email.trim(),
      message: message.trim() || undefined,
    }),
    onSuccess: () => {
      toast({ title: "Invite sent", description: `Momentum partner invite sent to ${email.trim()}` });
      setEmail("");
      setMessage("");
      setOpen(false);
      refetchInvites();
      queryClient.invalidateQueries({ queryKey: ["/api/connections"] });
    },
    onError: (e: any) => {
      toast({
        title: "Could not send invite",
        description: e.message?.replace(/^\d+: /, "") || "Please try again",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="rounded-xl border border-border bg-muted/10 overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
        onClick={() => setOpen(v => !v)}
        data-testid="invite-panel-toggle"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">Invite a Momentum Partner</span>
          {pendingInvites.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {pendingInvites.length} pending
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">

          {/* Invite form */}
          <div className="space-y-2">
            <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Send Invite</p>
            <div className="flex gap-2">
              <Input
                id="network-invite-email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && email.trim()) sendInvite.mutate(); }}
                className="text-sm flex-1"
                data-testid="network-invite-email"
              />
              <Button
                size="sm"
                disabled={!email.trim() || sendInvite.isPending}
                onClick={() => sendInvite.mutate()}
                className="gap-1.5 flex-shrink-0"
                data-testid="network-invite-send-btn"
              >
                <Send className="w-3.5 h-3.5" />
                {sendInvite.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
            <Textarea
              placeholder="Add a personal note (optional)"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              maxLength={300}
              className="resize-none text-sm"
              data-testid="network-invite-message"
            />
            <p className="text-[10px] text-muted-foreground/50 text-right">{message.length}/300</p>
          </div>

          {/* Pending invites list */}
          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Pending Invites</p>
              {pendingInvites.map(inv => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
                >
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                  <span className="flex-1 text-sm text-muted-foreground truncate">{inv.inviteeEmail}</span>
                  <span className="text-[10px] text-muted-foreground/40">
                    {new Date(inv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {pendingInvites.length === 0 && (
            <p className="text-xs text-muted-foreground/50 text-center py-1">No pending invites.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function NetworkPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: billing } = useQuery<{ isPro: boolean }>({
    queryKey: ["/api/billing/status"],
    queryFn: () => apiRequest("GET", "/api/billing/status").then(r => r.json()),
    staleTime: 60_000,
  });
  const isPro = billing?.isPro ?? false;

  const { data: partners = [], isLoading } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
    queryFn: () => apiRequest("GET", "/api/connections").then(r => r.json()),
    staleTime: 60_000,
    enabled: isPro,
  });

  if (!user) return null;

  // Gate: Pro only
  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Users className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-lg font-black tracking-tight">Momentum Network</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Your momentum network diagram is a Pro feature. Upgrade to see your partners mapped in a visual network.
        </p>
        <button
          className="mt-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold"
          onClick={() => navigate("/billing")}
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Momentum Network
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Your confirmed momentum partners and today's scores.
        </p>
      </div>

      {/* Diagram card */}
      <div className="rounded-xl border border-border bg-muted/10 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Loading network…
          </div>
        ) : (
          <div className="p-4 md:p-6">
            <NetworkDiagram user={user} partners={partners} />
            <Legend />
          </div>
        )}
      </div>

      {/* Partner list below */}
      {partners.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase mb-2">
            Partner Summary
          </p>
          {partners.map(p => {
            const col = scoreColor(p.todayScore);
            const initials = getInitials(p.partnerName);
            return (
              <div
                key={p.connectionId}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border flex-shrink-0"
                  style={{ background: `${col}18`, borderColor: `${col}50`, color: col }}
                >
                  {initials}
                </div>
                <span className="flex-1 text-sm font-semibold text-foreground">{p.partnerName}</span>
                <span
                  className="text-sm font-black tabular-nums"
                  style={{ color: col }}
                >
                  {p.todayScore === null ? "—" : p.todayScore > 0 ? `+${p.todayScore}` : `${p.todayScore}`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Invite panel — always visible for Pro users */}
      <div className="mt-4">
        <InvitePanel />
      </div>
    </div>
  );
}
