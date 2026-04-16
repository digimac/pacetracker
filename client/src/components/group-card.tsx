/**
 * GroupCard — compact Today-page widget showing the user's Momentum Group scores.
 * Shown below the Momentum Partners card.
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

type Group = {
  id: number;
  name: string;
  description: string | null;
  moderatorId: number;
  maxSeats: number;
};

type EnrichedMember = {
  id: number;
  userId: number | null;
  inviteEmail: string | null;
  status: string;
  displayName: string | null;
  todayScore: number | null;
};

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 7) return "text-[#FF6E00]";
  if (score > 0)  return "text-green-400";
  if (score < 0)  return "text-red-400";
  return "text-muted-foreground";
}

function MemberDot({ member, currentUserId }: { member: EnrichedMember; currentUserId: number }) {
  const isMe = member.userId === currentUserId;
  const initials = getInitials(member.displayName);
  const col = scoreColor(member.todayScore);
  const score = member.todayScore;
  const isPending = member.status === "invited" && !member.userId;

  return (
    <div
      className="flex flex-col items-center gap-1 min-w-[64px]"
      title={member.displayName || member.inviteEmail || "Pending invite"}
    >
      <div
        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-black ${
          isMe ? "border-[#FF6E00] bg-[#FF6E00]/10" : isPending ? "border-border bg-muted/20" : "border-border bg-muted/20"
        }`}
      >
        {isPending ? (
          <span className="text-muted-foreground/40 text-[10px]">?</span>
        ) : (
          <span className={isMe ? "text-[#FF6E00]" : col}>{initials}</span>
        )}
      </div>
      {!isPending && (
        <span className={`text-xs font-black tabular-nums ${col}`}>
          {score === null ? "—" : score > 0 ? `+${score}` : `${score}`}
        </span>
      )}
      {isPending && (
        <span className="text-[9px] text-muted-foreground/40">Pending</span>
      )}
    </div>
  );
}

export function GroupCard({ userId }: { userId: number }) {
  const [, navigate] = useLocation();

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    queryFn: () => apiRequest("GET", "/api/groups").then(r => r.json()),
    staleTime: 60_000,
  });

  // Fetch full data for each group (members + scores)
  const { data: groupDetails = [] } = useQuery<Array<{ group: Group; members: EnrichedMember[]; isModerator: boolean }>>({
    queryKey: ["/api/groups/details", groups.map(g => g.id)],
    queryFn: async () => {
      if (groups.length === 0) return [];
      return Promise.all(
        groups.map(g => apiRequest("GET", `/api/groups/${g.id}`).then(r => r.json()))
      );
    },
    enabled: groups.length > 0,
    staleTime: 60_000,
  });

  if (groupDetails.length === 0) return null;

  return (
    <>
      {groupDetails.map(({ group, members }) => {
        const active = members.filter(m => m.status !== "removed");
        // Average score of members who have scored today
        const scored = active.filter(m => m.todayScore !== null);
        const avg = scored.length > 0
          ? (scored.reduce((s, m) => s + (m.todayScore ?? 0), 0) / scored.length).toFixed(1)
          : null;

        return (
          <section key={group.id} className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                {group.name}
              </p>
              <div className="flex items-center gap-3">
                {avg !== null && (
                  <span className="text-[10px] text-muted-foreground">
                    Avg <span className="font-black text-foreground">{avg}</span>
                  </span>
                )}
                <button
                  className="text-[10px] text-primary font-bold hover:underline"
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  View →
                </button>
              </div>
            </div>

            {/* Member dots row */}
            <div className="flex flex-wrap gap-3 px-1">
              {active.map(m => (
                <MemberDot key={m.id} member={m} currentUserId={userId} />
              ))}
            </div>

            {/* Seat usage bar */}
            <div className="mt-3">
              <div className="flex justify-between mb-1">
                <span className="text-[9px] text-muted-foreground/50">{active.length}/{group.maxSeats} seats</span>
              </div>
              <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-1 rounded-full bg-primary/50 transition-all"
                  style={{ width: `${(active.length / group.maxSeats) * 100}%` }}
                />
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
