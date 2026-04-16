/**
 * Momentum Groups pages:
 *  /groups      — list of groups + create flow (Pro only)
 *  /groups/:id  — group detail / moderator dashboard
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/App";
import { Route, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Users, Plus, Send, Trash2, UserX, Settings2, Crown,
  AlertTriangle, ChevronRight, Lock,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
type Group = {
  id: number; name: string; description: string | null;
  moderatorId: number; maxSeats: number; discountCode: string | null;
};
type EnrichedMember = {
  id: number; groupId: number; userId: number | null;
  inviteEmail: string | null; status: string;
  displayName: string | null; todayScore: number | null;
};
type GroupDetail = { group: Group; members: EnrichedMember[]; isModerator: boolean };

// ── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
}
function scoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 7) return "text-[#FF6E00]";
  if (score > 0)  return "text-green-400";
  if (score < 0)  return "text-red-400";
  return "text-muted-foreground";
}

// ── Group List Page ─────────────────────────────────────────────────────────
function GroupListPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountCode, setDiscountCode] = useState("");

  const { data: billing } = useQuery<{ isPro: boolean }>({
    queryKey: ["/api/billing/status"],
    queryFn: () => apiRequest("GET", "/api/billing/status").then(r => r.json()),
    staleTime: 60_000,
  });
  const isPro = billing?.isPro ?? false;

  const { data: groups = [], isLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    queryFn: () => apiRequest("GET", "/api/groups").then(r => r.json()),
    staleTime: 30_000,
    enabled: isPro,
  });

  const createGroup = useMutation({
    mutationFn: () => apiRequest("POST", "/api/groups", { name: name.trim(), description: description.trim() || undefined, discountCode: discountCode.trim() || undefined }).then(r => r.json()),
    onSuccess: (g) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({ title: "Group created", description: `"${g.name}" is ready. Start inviting members.` });
      setCreating(false); setName(""); setDescription(""); setDiscountCode("");
      navigate(`/groups/${g.id}`);
    },
    onError: (e: any) => toast({ title: "Could not create group", description: e.message?.replace(/^\d+: /, ""), variant: "destructive" }),
  });

  if (!user) return null;

  if (!isPro) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-lg font-black tracking-tight">Momentum Groups</h1>
        <p className="text-sm text-muted-foreground max-w-xs">
          Momentum Groups are a Pro feature. Upgrade to create and manage groups of up to 10 members.
        </p>
        <Button onClick={() => navigate("/billing")}>Upgrade to Pro</Button>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Momentum Groups
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your groups and invite members.</p>
        </div>
        {!creating && (
          <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5" /> New Group
          </Button>
        )}
      </div>

      {/* Create form */}
      {creating && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Create New Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Group name*" value={name} onChange={e => setName(e.target.value)} className="text-sm" />
            <Textarea placeholder="Short description (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="resize-none text-sm" />
            <Input placeholder="Discount code for new members (optional)" value={discountCode} onChange={e => setDiscountCode(e.target.value)} className="text-sm font-mono" />
            <p className="text-[10px] text-muted-foreground">New members joining through your group invite will see this discount code for their Pro subscription.</p>
            <div className="flex gap-2">
              <Button size="sm" disabled={!name.trim() || createGroup.isPending} onClick={() => createGroup.mutate()}>
                {createGroup.isPending ? "Creating…" : "Create Group"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Groups list */}
      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading groups…</p>}

      {!isLoading && groups.length === 0 && !creating && (
        <div className="rounded-xl border border-border bg-muted/10 p-8 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">You're not part of any Momentum Groups yet.</p>
          <button className="mt-3 text-xs font-bold text-primary underline underline-offset-2" onClick={() => setCreating(true)}>
            Create your first group →
          </button>
        </div>
      )}

      <div className="space-y-3">
        {groups.map(g => (
          <button
            key={g.id}
            className="w-full rounded-xl border border-border bg-muted/10 hover:border-border/60 hover:bg-muted/20 transition-colors px-4 py-3 flex items-center gap-3 text-left"
            onClick={() => navigate(`/groups/${g.id}`)}
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{g.name}</p>
              {g.description && <p className="text-[11px] text-muted-foreground truncate">{g.description}</p>}
            </div>
            {g.moderatorId === user.id && (
              <Crown className="w-3.5 h-3.5 text-[#FF6E00] flex-shrink-0" title="You are the moderator" />
            )}
            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Group Detail Page ───────────────────────────────────────────────────────
function GroupDetailPage({ groupId }: { groupId: number }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [inviteEmail, setInviteEmail] = useState("");
  const [showSeatRequest, setShowSeatRequest] = useState(false);
  const [seatsRequested, setSeatsRequested] = useState("5");
  const [seatReason, setSeatReason] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editing, setEditing] = useState(false);

  const { data, isLoading, refetch } = useQuery<GroupDetail>({
    queryKey: ["/api/groups", groupId],
    queryFn: () => apiRequest("GET", `/api/groups/${groupId}`).then(r => r.json()),
    staleTime: 30_000,
  });

  const inviteMember = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${groupId}/invite`, { email: inviteEmail.trim() }).then(r => r.json()),
    onSuccess: () => {
      toast({ title: "Invite sent", description: `${inviteEmail.trim()} has been added to the group.` });
      setInviteEmail(""); refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
    },
    onError: (e: any) => toast({ title: "Could not invite", description: e.message?.replace(/^\d+: /, ""), variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: number) => apiRequest("DELETE", `/api/groups/${groupId}/members/${memberId}`).then(r => r.json()),
    onSuccess: () => { toast({ title: "Member removed" }); refetch(); },
    onError: (e: any) => toast({ title: "Could not remove", description: e.message?.replace(/^\d+: /, ""), variant: "destructive" }),
  });

  const requestSeats = useMutation({
    mutationFn: () => apiRequest("POST", `/api/groups/${groupId}/request-seats`, { seatsRequested: Number(seatsRequested), reason: seatReason || undefined }).then(r => r.json()),
    onSuccess: (d) => { toast({ title: "Request sent", description: d.message }); setShowSeatRequest(false); setSeatReason(""); },
    onError: (e: any) => toast({ title: "Could not send request", description: e.message?.replace(/^\d+: /, ""), variant: "destructive" }),
  });

  const updateGroup = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/groups/${groupId}`, { name: editName, description: editDesc, discountCode: editCode || null }).then(r => r.json()),
    onSuccess: () => { toast({ title: "Group updated" }); setEditing(false); refetch(); queryClient.invalidateQueries({ queryKey: ["/api/groups"] }); },
    onError: (e: any) => toast({ title: "Update failed", description: e.message?.replace(/^\d+: /, ""), variant: "destructive" }),
  });

  const deleteGroup = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/groups/${groupId}`).then(r => r.json()),
    onSuccess: () => { toast({ title: "Group deleted" }); queryClient.invalidateQueries({ queryKey: ["/api/groups"] }); navigate("/groups"); },
  });

  if (!user) return null;
  if (isLoading) return <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="flex flex-col items-center gap-3 py-16 text-center"><AlertTriangle className="w-8 h-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">Group not found or you don't have access.</p><Button size="sm" onClick={() => navigate("/groups")}>Back to Groups</Button></div>;

  const { group, members, isModerator } = data;
  const active = members.filter(m => m.status !== "removed");
  const atCapacity = active.length >= group.maxSeats;

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <button className="text-muted-foreground hover:text-foreground text-xs" onClick={() => navigate("/groups")}>← Groups</button>
          <span className="text-muted-foreground/30">/</span>
          <h1 className="text-base font-black tracking-tight flex items-center gap-2">
            {group.name}
            {isModerator && <Crown className="w-4 h-4 text-[#FF6E00]" title="You are the moderator" />}
          </h1>
        </div>
        {isModerator && !editing && (
          <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0" onClick={() => { setEditName(group.name); setEditDesc(group.description || ""); setEditCode(group.discountCode || ""); setEditing(true); }}>
            <Settings2 className="w-3.5 h-3.5" /> Edit
          </Button>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <Card className="mb-6">
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider">Edit Group</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Group name" className="text-sm" />
            <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description" rows={2} className="resize-none text-sm" />
            <Input value={editCode} onChange={e => setEditCode(e.target.value)} placeholder="Discount code" className="text-sm font-mono" />
            <div className="flex gap-2 items-center">
              <Button size="sm" onClick={() => updateGroup.mutate()} disabled={!editName.trim() || updateGroup.isPending}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" variant="destructive" className="ml-auto gap-1.5" onClick={() => { if (confirm("Delete this group? This cannot be undone.")) deleteGroup.mutate(); }}>
                <Trash2 className="w-3.5 h-3.5" /> Delete Group
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info row */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{active.length} / {group.maxSeats} seats</span>
          {atCapacity && <Badge variant="destructive" className="text-[9px] px-1 py-0 ml-1">Full</Badge>}
        </div>
        {group.discountCode && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Discount:</span>
            <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono text-foreground">{group.discountCode}</code>
          </div>
        )}
        {group.description && (
          <p className="w-full text-sm text-muted-foreground">{group.description}</p>
        )}
      </div>

      {/* Member grid */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {active.map(m => {
          const col = scoreColor(m.todayScore);
          const initials = getInitials(m.displayName);
          const isPending = !m.userId;
          const isMe = m.userId === user.id;
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-black flex-shrink-0 ${isMe ? "border-[#FF6E00] bg-[#FF6E00]/10" : "border-border bg-muted/20"}`}>
                {isPending ? <span className="text-muted-foreground/30 text-[9px]">?</span> : <span className={isMe ? "text-[#FF6E00]" : col}>{initials}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold truncate">{m.displayName || m.inviteEmail || "Unknown"}</p>
                {isPending && <p className="text-[9px] text-muted-foreground">Invite pending</p>}
                {m.userId === group.moderatorId && <p className="text-[9px] text-[#FF6E00]">Moderator</p>}
              </div>
              <span className={`text-sm font-black tabular-nums flex-shrink-0 ${col}`}>
                {isPending ? "—" : m.todayScore === null ? "—" : m.todayScore > 0 ? `+${m.todayScore}` : `${m.todayScore}`}
              </span>
              {isModerator && m.userId !== user.id && (
                <button className="text-muted-foreground/30 hover:text-destructive transition-colors ml-1 flex-shrink-0" onClick={() => removeMember.mutate(m.id)} title="Remove member">
                  <UserX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite form (moderator only) */}
      {isModerator && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase tracking-wider">
              {atCapacity ? "Group at Capacity" : "Invite a Member"}
            </CardTitle>
            {atCapacity && <CardDescription className="text-xs">You've reached {group.maxSeats} seats. Request more below.</CardDescription>}
          </CardHeader>
          {!atCapacity && (
            <CardContent>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && inviteEmail.trim()) inviteMember.mutate(); }}
                  className="text-sm flex-1"
                />
                <Button size="sm" disabled={!inviteEmail.trim() || inviteMember.isPending} onClick={() => inviteMember.mutate()} className="gap-1.5 flex-shrink-0">
                  <Send className="w-3.5 h-3.5" />
                  {inviteMember.isPending ? "Sending…" : "Invite"}
                </Button>
              </div>
              {group.discountCode && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Invited members will receive the discount code <code className="font-mono">{group.discountCode}</code> in their invite email.
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Request more seats */}
      {isModerator && (
        <div className="rounded-xl border border-border bg-muted/10 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/20 transition-colors"
            onClick={() => setShowSeatRequest(v => !v)}
          >
            <span className="font-semibold">Request Additional Seats</span>
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${showSeatRequest ? "rotate-90" : ""}`} />
          </button>
          {showSeatRequest && (
            <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
              <p className="text-xs text-muted-foreground">Groups support up to {group.maxSeats} members. If you need more, submit a request and the Sweet Momentum team will get back to you within 1-2 business days.</p>
              <div className="flex gap-2 items-center">
                <label className="text-xs text-muted-foreground whitespace-nowrap">Seats needed:</label>
                <Input type="number" min="1" max="50" value={seatsRequested} onChange={e => setSeatsRequested(e.target.value)} className="text-sm w-20 text-center" />
              </div>
              <Textarea placeholder="Reason or context (optional)" value={seatReason} onChange={e => setSeatReason(e.target.value)} rows={2} className="resize-none text-sm" maxLength={500} />
              <Button size="sm" disabled={requestSeats.isPending} onClick={() => requestSeats.mutate()} className="gap-1.5">
                <Send className="w-3.5 h-3.5" />
                {requestSeats.isPending ? "Sending…" : "Send Request"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Router wrapper ───────────────────────────────────────────────────────────
export default function GroupsRouter() {
  return (
    <>
      <Route path="/groups" component={GroupListPage} />
      <Route path="/groups/:id">
        {(params) => <GroupDetailPage groupId={parseInt(params.id)} />}
      </Route>
    </>
  );
}
