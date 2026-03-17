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
import { Plus, Trash2, Save, Clock, Lock, Zap, Globe } from "lucide-react";
import { useAuth } from "@/App";
import { TIMEZONE_OPTIONS, getBrowserTimezone } from "@/hooks/use-user-timezone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";

const METRIC_EMOJIS = ["⭐", "💪", "🧠", "📚", "🥗", "🏃", "😴", "💧", "🎯", "🌱"];

const CORE_METRIC_INFO = [
  { key: "TIME", label: "TIME", desc: "Intentional time management" },
  { key: "GOAL", label: "GOAL", desc: "Primary goal pursuit" },
  { key: "TEAM", label: "TEAM", desc: "Positive team contribution" },
  { key: "TASK", label: "TASK", desc: "Key task completion" },
  { key: "VIEW", label: "VIEW", desc: "Vision and perspective clarity" },
  { key: "PACE", label: "PACE", desc: "Rhythm and pace maintenance" },
];

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Profile — first / last name
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
  });

  // Keep form in sync if user context loads after mount
  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
    });
  }, [user?.firstName, user?.lastName]);

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
          <Button
            onClick={() => saveProfile.mutate()}
            disabled={saveProfile.isPending}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="btn-save-profile"
          >
            <Save className="w-3.5 h-3.5 mr-2" />
            {saveProfile.isPending ? "Saving..." : "Save Name"}
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
                <span className="text-xs text-muted-foreground">{m.desc}</span>
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
          <CardDescription className="text-xs">Add up to 4 personal metrics (exercise, nutrition, reading, etc.)</CardDescription>
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
          {customMetrics.length > 0 ? (
            <div className="space-y-2">
              {customMetrics.map(m => (
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
    </div>
  );
}
