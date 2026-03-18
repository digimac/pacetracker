import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { CustomMetric, UserSchedule } from "@shared/schema";
import { Plus, Trash2, Save, Clock, Lock, Zap, Globe, GripVertical, Users, Send, X, CheckCircle } from "lucide-react";
import { useAuth } from "@/App";
import { TIMEZONE_OPTIONS, getBrowserTimezone } from "@/hooks/use-user-timezone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const METRIC_EMOJIS = ["⭐", "💪", "🧠", "📚", "🥗", "🏃", "😴", "💧", "🎯", "🌱"];

const CORE_METRIC_INFO = [
  { key: "TIME", label: "TIME", desc: "Intentional time management" },
  { key: "GOAL", label: "GOAL", desc: "Primary goal pursuit" },
  { key: "TEAM", label: "TEAM", desc: "Positive team contribution" },
  { key: "TASK", label: "TASK", desc: "Key task completion" },
  { key: "VIEW", label: "VIEW", desc: "Vision and perspective clarity" },
  { key: "PACE", label: "PACE", desc: "Rhythm and pace maintenance" },
];

// ─── Sortable metric row (used inside drag context) ─────────────────────────
function SortableMetricRow({ metric, onDelete }: { metric: CustomMetric; onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: metric.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border"
      data-testid={`custom-metric-${metric.id}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
        data-testid={`drag-handle-${metric.id}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-lg flex-shrink-0">{metric.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold uppercase tracking-wider truncate">{metric.name}</p>
        {metric.description && <p className="text-xs text-muted-foreground truncate">{metric.description}</p>}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(metric.id)}
        className="text-destructive flex-shrink-0"
        data-testid={`btn-delete-metric-${metric.id}`}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Profile — name + location
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    city: user?.city || "",
    region: user?.region || "",
    country: user?.country || "",
  });

  // Keep form in sync if user context loads after mount
  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      city: user?.city || "",
      region: user?.region || "",
      country: user?.country || "",
    });
  }, [user?.firstName, user?.lastName, user?.city, user?.region, user?.country]);

  const saveProfile = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/auth/profile", profileForm).then(r => r.json()),
    onSuccess: (data) => {
      if (data.user) setUser(data.user);
      toast({ title: "Profile saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const { data: billing } = useQuery<{ isPro: boolean }>({  
    queryKey: ["/api/billing/status"],
    queryFn: () => apiRequest("GET", "/api/billing/status").then(r => r.json()),
  });
  const isPro = billing?.isPro ?? false;

  // Metric content — used to show admin-configured subtext on core metrics
  const { data: metricContentArray = [] } = useQuery<{ metricKey: string; subtext: string | null }[]>({
    queryKey: ["/api/metric-content"],
    queryFn: () => apiRequest("GET", "/api/metric-content").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const metricSubtext: Record<string, string> = {};
  metricContentArray.forEach(c => { if (c.subtext) metricSubtext[c.metricKey] = c.subtext; });

  // Schedule
  const { data: schedule } = useQuery<UserSchedule | null>({
    queryKey: ["/api/schedule"],
    queryFn: () => apiRequest("GET", "/api/schedule").then(r => r.json()),
  });

  const [scheduleForm, setScheduleForm] = useState({
    wakeTime: "06:00",
    sleepTime: "22:00",
    workStartTime: "09:00",
    workEndTime: "17:00",
    timezone: "America/New_York",
    dailyGoal: "",
  });

  useEffect(() => {
    if (schedule) {
      setScheduleForm({
        wakeTime: schedule.wakeTime || "06:00",
        sleepTime: schedule.sleepTime || "22:00",
        workStartTime: schedule.workStartTime || "09:00",
        workEndTime: schedule.workEndTime || "17:00",
        timezone: schedule.timezone || getBrowserTimezone(),
        dailyGoal: schedule.dailyGoal || "",
      });
    } else {
      // Auto-detect browser timezone for new users
      setScheduleForm(f => ({
        ...f,
        timezone: f.timezone === "America/New_York" ? getBrowserTimezone() : f.timezone,
      }));
    }
  }, [schedule]);

  const savSchedule = useMutation({
    mutationFn: () => apiRequest("POST", "/api/schedule", scheduleForm).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      toast({ title: "Schedule saved" });
    },
  });

  // Custom Metrics
  const { data: customMetrics = [] } = useQuery<CustomMetric[]>({
    queryKey: ["/api/metrics/custom"],
    queryFn: () => apiRequest("GET", "/api/metrics/custom").then(r => r.json()),
  });

  // Local ordered list for optimistic drag-and-drop
  const [orderedMetrics, setOrderedMetrics] = useState<CustomMetric[]>([]);
  useEffect(() => { setOrderedMetrics(customMetrics); }, [customMetrics]);

  const [newMetric, setNewMetric] = useState({ name: "", description: "", emoji: "⭐" });

  const addMetric = useMutation({
    mutationFn: () => apiRequest("POST", "/api/metrics/custom", {
      name: newMetric.name,
      description: newMetric.description,
      emoji: newMetric.emoji,
      sortOrder: customMetrics.length,
      isActive: true,
    }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metrics/custom"] });
      setNewMetric({ name: "", description: "", emoji: "⭐" });
      toast({ title: "Custom metric added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMetric = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/metrics/custom/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metrics/custom"] });
      toast({ title: "Metric removed" });
    },
  });

  const reorderMetrics = useMutation({
    mutationFn: (order: number[]) =>
      apiRequest("PUT", "/api/metrics/custom/reorder", { order }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/metrics/custom"] });
    },
    onError: () => {
      // Roll back optimistic update on failure
      setOrderedMetrics(customMetrics);
      toast({ title: "Error", description: "Could not save order", variant: "destructive" });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedMetrics(prev => {
      const oldIdx = prev.findIndex(m => m.id === active.id);
      const newIdx = prev.findIndex(m => m.id === over.id);
      const next = arrayMove(prev, oldIdx, newIdx);
      // Persist new order
      reorderMetrics.mutate(next.map(m => m.id));
      return next;
    });
  }

  const canAddMore = customMetrics.length < 4;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-black tracking-tight uppercase">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your daily performance system</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary flex-shrink-0">
              {user?.displayName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold">{user?.displayName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name</Label>
              <Input
                placeholder="First"
                value={profileForm.firstName}
                onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))}
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name</Label>
              <Input
                placeholder="Last"
                value={profileForm.lastName}
                onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))}
                data-testid="input-last-name"
              />
            </div>
          </div>
          {/* Location */}
          <div className="pt-2 border-t border-border space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Location</p>
            <p className="text-[11px] text-muted-foreground/70 -mt-1">Used to pinpoint your dot on the Score Map. General location only — not exact.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">City</Label>
                <Input
                  placeholder="e.g. New York"
                  value={profileForm.city}
                  onChange={e => setProfileForm(f => ({ ...f, city: e.target.value }))}
                  data-testid="input-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">State / Province</Label>
                <Input
                  placeholder="e.g. NY"
                  value={profileForm.region}
                  onChange={e => setProfileForm(f => ({ ...f, region: e.target.value }))}
                  data-testid="input-region"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Country</Label>
                <Input
                  placeholder="e.g. USA"
                  value={profileForm.country}
                  onChange={e => setProfileForm(f => ({ ...f, country: e.target.value }))}
                  data-testid="input-country"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={() => saveProfile.mutate()}
            disabled={saveProfile.isPending}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="btn-save-profile"
          >
            <Save className="w-3.5 h-3.5 mr-2" />
            {saveProfile.isPending ? "Saving..." : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      {/* Core Metrics Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Core Metrics</CardTitle>
          <CardDescription className="text-xs">The 6 fixed daily performance metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            {CORE_METRIC_INFO.map(m => (
              <div key={m.key} className="flex items-center gap-3 py-1.5">
                <span className="text-xs font-black tracking-widest w-12 text-primary">{m.label}</span>
                <span className="text-xs text-muted-foreground">{metricSubtext[m.key] || m.desc}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            Core metrics are fixed and cannot be modified. Each earns +1 for success, -1 for setback.
          </p>
        </CardContent>
      </Card>

      {/* Custom Metrics */}
      <Card className={!isPro ? "opacity-90" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            Custom Metrics
            {isPro ? (
              <Badge className="text-[10px]">{customMetrics.length}/4</Badge>
            ) : (
              <Badge className="text-[10px] bg-yellow-500/20 text-yellow-400 border-yellow-500/30 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Pro
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            Add up to 4 personal metrics (exercise, nutrition, reading, etc.){isPro && orderedMetrics.length > 1 ? " · drag to reorder" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isPro && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 flex items-start gap-3">
              <Lock className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-400 mb-1">Pro Feature</p>
                <p className="text-xs text-muted-foreground mb-3">Custom metrics are available on the Pro plan. Upgrade to add up to 4 personal metrics like exercise, nutrition, reading, or deep work.</p>
                <Button size="sm" onClick={() => setLocation("/billing")} className="h-7 text-xs gap-1.5">
                  <Zap className="w-3 h-3" />
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          )}
          {orderedMetrics.length > 0 ? (
            isPro ? (
              // Pro users — drag-and-drop sortable list
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={orderedMetrics.map(m => m.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {orderedMetrics.map(m => (
                      <SortableMetricRow
                        key={m.id}
                        metric={m}
                        onDelete={id => deleteMetric.mutate(id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              // Free users — static list (no drag handles)
              <div className="space-y-2">
                {orderedMetrics.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border" data-testid={`custom-metric-${m.id}`}>
                    <span className="text-lg flex-shrink-0">{m.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold uppercase tracking-wider truncate">{m.name}</p>
                      {m.description && <p className="text-xs text-muted-foreground truncate">{m.description}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMetric.mutate(m.id)}
                      className="text-destructive flex-shrink-0"
                      data-testid={`btn-delete-metric-${m.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground py-2">No custom metrics added yet.</p>
          )}

          {canAddMore && isPro && (
            <div className="pt-2 border-t border-border space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Add New Metric</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {METRIC_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => setNewMetric(m => ({ ...m, emoji: e }))}
                    className={`w-8 h-8 rounded-md text-base flex items-center justify-center transition-all ${
                      newMetric.emoji === e ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-muted"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Metric name (e.g. Exercise)"
                  value={newMetric.name}
                  onChange={e => setNewMetric(m => ({ ...m, name: e.target.value }))}
                  data-testid="input-metric-name"
                />
                <Button
                  onClick={() => addMetric.mutate()}
                  disabled={!newMetric.name.trim() || addMetric.isPending}
                  size="icon"
                  data-testid="btn-add-metric"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <Input
                placeholder="Description (optional)"
                value={newMetric.description}
                onChange={e => setNewMetric(m => ({ ...m, description: e.target.value }))}
                data-testid="input-metric-description"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Schedule */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Daily Schedule
          </CardTitle>
          <CardDescription className="text-xs">Configure your typical daily structure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Wake Time</Label>
              <Input
                type="time"
                value={scheduleForm.wakeTime}
                onChange={e => setScheduleForm(f => ({ ...f, wakeTime: e.target.value }))}
                data-testid="input-wake-time"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sleep Time</Label>
              <Input
                type="time"
                value={scheduleForm.sleepTime}
                onChange={e => setScheduleForm(f => ({ ...f, sleepTime: e.target.value }))}
                data-testid="input-sleep-time"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Work Start</Label>
              <Input
                type="time"
                value={scheduleForm.workStartTime}
                onChange={e => setScheduleForm(f => ({ ...f, workStartTime: e.target.value }))}
                data-testid="input-work-start"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Work End</Label>
              <Input
                type="time"
                value={scheduleForm.workEndTime}
                onChange={e => setScheduleForm(f => ({ ...f, workEndTime: e.target.value }))}
                data-testid="input-work-end"
              />
            </div>
          </div>
          {/* Timezone */}
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              Timezone
            </Label>
            <Select
              value={scheduleForm.timezone}
              onValueChange={val => setScheduleForm(f => ({ ...f, timezone: val }))}
            >
              <SelectTrigger data-testid="select-timezone" className="text-xs">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {["UTC", "Americas", "Europe", "Asia/Pacific", "Africa"].map(group => {
                  const groupOptions = TIMEZONE_OPTIONS.filter(tz => tz.group === group);
                  if (groupOptions.length === 0) return null;
                  return (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                        {group}
                      </div>
                      {groupOptions.map(tz => (
                        <SelectItem key={tz.value} value={tz.value} className="text-xs">
                          {tz.label}
                        </SelectItem>
                      ))}
                    </div>
                  );
                })}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground/60">
              Used to determine your local "today" for scoring.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Daily Goal Statement</Label>
            <Textarea
              placeholder="Your guiding daily intention..."
              value={scheduleForm.dailyGoal}
              onChange={e => setScheduleForm(f => ({ ...f, dailyGoal: e.target.value }))}
              rows={2}
              className="resize-none"
              data-testid="textarea-daily-goal"
            />
          </div>
          <Button
            onClick={() => savSchedule.mutate()}
            disabled={savSchedule.isPending}
            className="w-full"
            data-testid="btn-save-schedule"
          >
            <Save className="w-4 h-4 mr-2" />
            {savSchedule.isPending ? "Saving..." : "Save Schedule"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Connections ─────────────────────────────────────────────────────── */}
      <ConnectionsCard />
    </div>
  );
}

// ─── Connections Card ─────────────────────────────────────────────────────────
interface Connection {
  connectionId: number;
  partnerId: number;
  partnerName: string;
  partnerUsername: string;
  todayScore: number | null;
  connectedSince: string;
}

interface SentInvite {
  id: number;
  inviteeEmail: string | null;
  inviteePhone: string | null;
  status: string;
  createdAt: string;
  expiresAt: string;
}

function ConnectionsCard() {
  const { toast } = useToast();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);

  const { data: connections = [], refetch: refetchConnections } = useQuery<Connection[]>({
    queryKey: ["/api/connections"],
    queryFn: () => apiRequest("GET", "/api/connections").then(r => r.json()),
    refetchInterval: 30_000, // re-check every 30s so accepted invites appear promptly
  });

  const { data: sentInvites = [], refetch: refetchInvites } = useQuery<SentInvite[]>({
    queryKey: ["/api/invites"],
    queryFn: () => apiRequest("GET", "/api/invites").then(r => r.json()),
    refetchInterval: 30_000,
  });

  // Only show pending invites that haven't been accepted/expired AND don't already
  // have a matching confirmed connection (handles the case where cache is slightly stale)
  const confirmedEmails = new Set(
    connections.map(c => c.partnerUsername.toLowerCase())
  );
  const pendingInvites = sentInvites.filter(i =>
    i.status === "pending" &&
    new Date(i.expiresAt) > new Date()
  );

  const sendInvite = useMutation({
    mutationFn: () => apiRequest("POST", "/api/invites", { inviteeEmail: inviteEmail, message: inviteMessage || undefined }),
    onSuccess: () => {
      toast({ title: "Invite sent", description: `An invite was sent to ${inviteEmail}` });
      setInviteEmail("");
      setInviteMessage("");
      setShowInviteForm(false);
      refetchInvites();
      refetchConnections();
    },
    onError: (e: any) => {
      toast({ title: "Could not send invite", description: e.message?.replace(/^\d+: /, "") || "Please try again", variant: "destructive" });
    },
  });

  const removeConnection = useMutation({
    mutationFn: (partnerId: number) => apiRequest("DELETE", `/api/connections/${partnerId}`),
    onSuccess: () => {
      toast({ title: "Connection removed" });
      refetchConnections();
      refetchInvites(); // re-check invite statuses too
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const scoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 7) return "text-[#FF6E00]";
    if (score >= 4) return "text-yellow-400";
    return "text-red-400";
  };

  const hasAny = connections.length > 0 || pendingInvites.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" /> Accountability Partners
            </CardTitle>
            <CardDescription className="text-xs mt-1">Invite a trusted friend to share daily scores</CardDescription>
          </div>
          {!showInviteForm && (
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowInviteForm(true)} data-testid="btn-show-invite-form">
              <Plus className="w-3 h-3 mr-1" /> Invite
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Invite form */}
        {showInviteForm && (
          <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email address</Label>
              <Input
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Personal message <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea
                placeholder="Add a short note to your invite..."
                value={inviteMessage}
                onChange={e => setInviteMessage(e.target.value)}
                rows={2}
                maxLength={300}
                className="resize-none text-sm"
                data-testid="textarea-invite-message"
              />
              <p className="text-[11px] text-muted-foreground text-right">{inviteMessage.length}/300</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-[#FF6E00] hover:bg-[#e06300] text-white text-xs"
                disabled={!inviteEmail || sendInvite.isPending}
                onClick={() => sendInvite.mutate()}
                data-testid="btn-send-invite"
              >
                <Send className="w-3 h-3 mr-1.5" />
                {sendInvite.isPending ? "Sending..." : "Send Invite"}
              </Button>
              <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowInviteForm(false)} data-testid="btn-cancel-invite">
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasAny && (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No accountability partners yet.</p>
            <p className="text-xs mt-1">Send an invite to get started.</p>
          </div>
        )}

        {/* Confirmed partners */}
        {connections.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-green-500" /> Confirmed
            </p>
            <div className="space-y-2">
              {connections.map((c) => (
                <div key={c.connectionId} className="flex items-center justify-between p-3 bg-muted/20 border border-border rounded-lg" data-testid={`connection-row-${c.partnerId}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary">
                      {c.partnerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.partnerName}</p>
                      <p className="text-xs text-muted-foreground">@{c.partnerUsername}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Today</p>
                      <p className={`text-base font-black ${scoreColor(c.todayScore)}`}>
                        {c.todayScore !== null ? c.todayScore : "—"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                      onClick={() => removeConnection.mutate(c.partnerId)}
                      data-testid={`btn-remove-connection-${c.partnerId}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-yellow-500" /> Pending
            </p>
            <div className="space-y-2">
              {pendingInvites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-muted/10 border border-dashed border-border rounded-lg" data-testid={`invite-row-${inv.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5 text-yellow-500/60" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{inv.inviteeEmail || inv.inviteePhone}</p>
                      <p className="text-xs text-muted-foreground">Invite pending · expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-yellow-500 border-yellow-500/30 bg-yellow-500/10">
                    Awaiting
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
