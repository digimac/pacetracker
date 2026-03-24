import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { useAuth } from "@/App";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type LoginPageConfig = {
  title: string | null;
  body: string | null;
  heroImageUrl: string | null;
} | null;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch admin-configured login page content (public endpoint, no auth needed)
  const { data: config } = useQuery<LoginPageConfig>({
    queryKey: ["/api/public/login-page"],
    queryFn: () => apiRequest("GET", "/api/public/login-page").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setUser(data.user);
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const headline = config?.title?.trim() || null;
  const bodyText  = config?.body?.trim()  || null;
  const bgImage   = config?.heroImageUrl?.trim() || null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-background">

      {/* Background image with overlay */}
      {bgImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          {/* Dark overlay so text / form remain readable */}
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}

      {/* All content above the background */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">

        {/* Logo / App name */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-4">
            <img src="/favicon.png" alt="Sweet Momentum" className="w-full h-full object-contain" />
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${bgImage ? "text-white" : ""}`}>
            SWEET MOMENTUM
          </h2>
          <p className={`text-sm mt-1 ${bgImage ? "text-white/70" : "text-muted-foreground"}`}>
            Your daily performance system
          </p>
        </div>

        {/* Admin-configured headline */}
        {headline && (
          <h1 className="font-black tracking-tight uppercase text-center mb-2 text-white drop-shadow-lg w-full" style={{ fontFamily: '"vandertak-capslock-side", sans-serif', fontWeight: 400, fontSize: '4.75rem', lineHeight: '4.5rem' }}>
            {headline}
          </h1>
        )}

        {/* Admin-configured body text */}
        {bodyText && (
          <p className="text-sm text-center mb-6 leading-relaxed text-white/80 drop-shadow w-full">
            {bodyText}
          </p>
        )}

        <Card className={bgImage ? "bg-card/90 backdrop-blur-sm border-white/10 w-full" : "w-full"}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign In</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    data-testid="input-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading} data-testid="button-login">
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-3 text-right">
              <Link href="/forgot-password">
                <a className="text-xs text-muted-foreground hover:text-primary transition-colors">Forgot password?</a>
              </Link>
            </div>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              <span>No account? </span>
              <Link href="/register">
                <a className="text-primary hover:underline font-medium">Create one</a>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
