import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/App";
import { Users, CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";

interface InvitePreview {
  senderName: string;
  message: string | null;
  inviteeEmail: string | null;
  status: string;
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setUser } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Registration form
  const [mode, setMode] = useState<"choose" | "register" | "login">("choose");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiRequest("GET", `/api/invites/${token}`)
      .then(r => r.json())
      .then((data: InvitePreview) => {
        setPreview(data);
        if (data.inviteeEmail) setEmail(data.inviteeEmail);
      })
      .catch(e => setError(e.message?.replace(/^\d+: /, "") || "Invite not found"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Use raw fetch so we can inspect 409 status before throwing
      const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
      const res = await fetch(`${API_BASE}/api/invites/${token}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, displayName, password }),
      });
      const data = await res.json();
      if (res.status === 409 && data.existingAccount) {
        // Email already has an account — auto-switch to login with email pre-filled
        setLoginEmail(email);
        setMode("login");
        toast({ title: "Account already exists", description: "Please log in below to accept the invite.", variant: "destructive" });
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }
      if (data.inviteError) {
        toast({ title: "Account created, but invite issue", description: data.inviteError, variant: "destructive" });
      }
      if (data.user) setUser(data.user); // update auth context so Router doesn't redirect to login
      setAccepted(true);
      setTimeout(() => setLocation("/dashboard"), 2000);
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message?.replace(/^\d+: /, "") || "Please try again", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Single atomic request: login + accept in one round-trip
      const res = await apiRequest("POST", `/api/invites/${token}/login`, {
        email: loginEmail, password: loginPassword,
      });
      const data = await res.json();
      if (data.inviteError) {
        toast({ title: "Logged in, but invite issue", description: data.inviteError, variant: "destructive" });
      }
      if (data.user) setUser(data.user); // update auth context so Router doesn't redirect to login
      setAccepted(true);
      setTimeout(() => setLocation("/dashboard"), 2000);
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message?.replace(/^\d+: /, "") || "Invalid credentials", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF6E00]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <XCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Invite unavailable</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => setLocation("/login")} variant="outline">Go to login</Button>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-[#FF6E00] mx-auto" />
          <h1 className="text-xl font-bold text-foreground">You're connected!</h1>
          <p className="text-muted-foreground">You and {preview?.senderName} are now momentum partners. Redirecting to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-[#FF6E00]/10 rounded-full flex items-center justify-center mx-auto">
            <Users className="w-7 h-7 text-[#FF6E00]" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">You've been invited</h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-semibold text-foreground">{preview?.senderName}</span> wants you as their momentum partner on Sweet Momentum.
          </p>
        </div>

        {/* Sender message */}
        {preview?.message && (
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground italic">"{preview.message}"</p>
            <p className="text-xs text-muted-foreground mt-2">— {preview.senderName}</p>
          </div>
        )}

        {/* What this means */}
        <div className="bg-card border border-border rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What momentum partners see</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-[#FF6E00] shrink-0" /> Each other's daily score (0–10)</li>
            <li className="flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-[#FF6E00] shrink-0" /> Name only</li>
            <li className="flex items-center gap-2"><XCircle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" /> No individual metric details</li>
            <li className="flex items-center gap-2"><XCircle className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" /> No notes or personal content</li>
          </ul>
        </div>

        {/* Mode chooser */}
        {mode === "choose" && (
          <div className="space-y-3">
            <Button
              className="w-full bg-[#FF6E00] hover:bg-[#e06300] text-white font-bold h-12"
              onClick={() => setMode("register")}
              data-testid="btn-create-account"
            >
              Create free account &amp; accept <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" className="w-full h-12" onClick={() => setMode("login")} data-testid="btn-already-have-account">
              I already have an account
            </Button>
          </div>
        )}

        {/* Register form */}
        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required data-testid="input-invite-email" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="inv-display">Display name</Label>
              <Input id="inv-display" value={displayName} onChange={e => setDisplayName(e.target.value)} required placeholder="Your Name" data-testid="input-invite-display" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-password">Password</Label>
              <Input id="inv-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} data-testid="input-invite-password" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-[#FF6E00] hover:bg-[#e06300] text-white font-bold h-12" data-testid="btn-invite-register">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create account &amp; connect
            </Button>
            <button type="button" className="text-xs text-muted-foreground w-full text-center hover:text-foreground" onClick={() => setMode("choose")}>← Back</button>
          </form>
        )}

        {/* Login form */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="inv-login-email">Email</Label>
              <Input id="inv-login-email" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required data-testid="input-invite-login-email" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-login-password">Password</Label>
              <Input id="inv-login-password" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required data-testid="input-invite-login-password" />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-[#FF6E00] hover:bg-[#e06300] text-white font-bold h-12" data-testid="btn-invite-login">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log in &amp; accept invite
            </Button>
            <button type="button" className="text-xs text-muted-foreground w-full text-center hover:text-foreground" onClick={() => setMode("choose")}>← Back</button>
          </form>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Free tier — no credit card required. This invite expires in 7 days.
        </p>
      </div>
    </div>
  );
}
