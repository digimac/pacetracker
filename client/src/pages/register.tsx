import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { useAuth } from "@/App";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { USER_CATEGORIES } from "@/lib/categories";
import { MapPin, ArrowRight, SkipForward, MessageSquare, Bell } from "lucide-react";

type Step = "account" | "location" | "category" | "sms";

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("account");
  const [form, setForm] = useState({ displayName: "", email: "", password: "", phone: "" });
  const [location, setLocationForm] = useState({ city: "", region: "", country: "" });
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function updateLocation(field: string, value: string) {
    setLocationForm(f => ({ ...f, [field]: value }));
  }

  // Step 1: Create account
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { phone, ...coreForm } = form;
      const res = await apiRequest("POST", "/api/auth/register", coreForm);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setUser(data.user);
      // Save phone if provided
      if (phone.trim()) {
        await apiRequest("PATCH", "/api/auth/profile", { phone: phone.trim() }).catch(() => {});
      }
      // Move to optional location step
      setStep("location");
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Step 2: Save location (optional)
  async function handleSaveLocation() {
    setLocationLoading(true);
    try {
      const res = await apiRequest("PATCH", "/api/auth/profile", {
        city: location.city.trim(),
        region: location.region.trim(),
        country: location.country.trim(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save location");
      setUser(data.user);
      setStep("category");
    } catch (err: any) {
      toast({ title: "Couldn't save location", description: err.message, variant: "destructive" });
    } finally {
      setLocationLoading(false);
    }
  }

  function handleSkipLocation() {
    setStep("category");
  }

  const [smsOptInLoading, setSmsOptInLoading] = useState(false);

  function afterCategory() {
    // If user provided a phone number, show SMS opt-in step
    if (form.phone.trim()) { setStep("sms"); } else { setLocation("/dashboard"); }
  }

  async function handleSaveCategory() {
    if (!selectedCategory) { afterCategory(); return; }
    setCategoryLoading(true);
    try {
      const res = await apiRequest("PATCH", "/api/auth/profile", { category: selectedCategory });
      const data = await res.json();
      if (data.user) setUser(data.user);
    } catch {}
    finally { setCategoryLoading(false); }
    afterCategory();
  }

  async function handleSmsOptIn(optIn: boolean) {
    setSmsOptInLoading(true);
    try {
      await apiRequest("PATCH", "/api/auth/profile", { smsOptIn: optIn }).catch(() => {});
    } finally {
      setSmsOptInLoading(false);
    }
    setLocation("/dashboard");
  }

  const hasLocationData = location.city.trim() || location.country.trim();

  // Fetch admin-configured register page background
  const { data: config } = useQuery<{ heroImageUrl?: string | null } | null>({
    queryKey: ["/api/public/register-page"],
    queryFn: () => apiRequest("GET", "/api/public/register-page").then(r => r.json()),
    staleTime: 5 * 60_000,
  });
  const bgImage = config?.heroImageUrl?.trim() || null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-background">
      {/* Background image */}
      {bgImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}
      <div className="w-full max-w-sm relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-4">
            <img src="/favicon.png" alt="Sweet Momentum" className="w-full h-full object-contain" />
          </div>
          <h1 className={`font-bold tracking-tight ${bgImage ? "text-white" : ""}`} style={{ fontSize: '3.25rem', lineHeight: '2.5rem' }}>SWEET MOMENTUM</h1>
          <p className={`text-sm mt-1 ${bgImage ? "text-white/70" : "text-muted-foreground"}`}>Start tracking your daily performance</p>
          <a
            href="https://sweetmo.io/start"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm font-semibold text-primary hover:underline underline-offset-4"
          >
            What is SweetMo.io?
          </a>
        </div>

        {/* Step 1: Account Creation */}
        {step === "account" && (
          <Card className={bgImage ? "bg-card/90 backdrop-blur-sm border-white/10" : ""}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Create Account</CardTitle>
              <CardDescription>Set up your Sweet Momentum profile</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Full Name</Label>
                  <Input
                    id="displayName"
                    placeholder="Your Name"
                    value={form.displayName}
                    onChange={e => update("displayName", e.target.value)}
                    required
                    data-testid="input-display-name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => update("email", e.target.value)}
                    required
                    data-testid="input-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => update("password", e.target.value)}
                    required
                    minLength={6}
                    data-testid="input-password"
                  />
                </div>

                {/* Phone number — optional, collected early for SMS opt-in */}
                <div className="space-y-1.5">
                  <Label htmlFor="register-phone" className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                    Mobile Number
                    <span className="text-muted-foreground font-normal text-xs ml-1">(optional)</span>
                  </Label>
                  <Input
                    id="register-phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={form.phone}
                    onChange={e => update("phone", e.target.value)}
                    data-testid="input-phone-register"
                  />
                  <p className="text-[11px] text-muted-foreground/60 leading-snug">
                    {form.phone.trim()
                      ? "🔔 You'll be able to opt in to SMS alerts on the next step — score reminders, partner updates, and app notifications."
                      : "Add your number to enable optional SMS reminders. You can also do this later in Settings."}
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={loading} data-testid="button-register">
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                <span>Already have an account? </span>
                <Link href="/login">
                  <a className="text-primary hover:underline font-medium">Sign in</a>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Optional Location */}
        {step === "location" && (
          <Card className={bgImage ? "bg-card/90 backdrop-blur-sm border-white/10" : ""}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-lg">Your Location</CardTitle>
              </div>
              <CardDescription>
                Optionally add your general location to appear on the Score Map. This is not mandatory and can be set later in Settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="e.g. Austin"
                  value={location.city}
                  onChange={e => updateLocation("city", e.target.value)}
                  data-testid="input-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="region">State / Province</Label>
                <Input
                  id="region"
                  placeholder="e.g. Texas"
                  value={location.region}
                  onChange={e => updateLocation("region", e.target.value)}
                  data-testid="input-region"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="e.g. United States"
                  value={location.country}
                  onChange={e => updateLocation("country", e.target.value)}
                  data-testid="input-country"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={handleSkipLocation}
                  disabled={locationLoading}
                  data-testid="button-skip-location"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip for now
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  onClick={handleSaveLocation}
                  disabled={locationLoading || !hasLocationData}
                  data-testid="button-save-location"
                >
                  {locationLoading ? "Saving..." : (
                    <>
                      Save & Continue
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Only your general city/region is used — exact address is never stored.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Community Category */}
        {step === "category" && (
          <Card className={bgImage ? "bg-card/90 backdrop-blur-sm border-white/10" : ""}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-lg">
                  🌟
                </div>
                <CardTitle className="text-lg">Your Community</CardTitle>
              </div>
              <CardDescription>
                Choose the category that best reflects your journey. This personalises your Sweet Momentum experience and is optional — you can always change it later in Settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {USER_CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setSelectedCategory(k => k === cat.key ? "" : cat.key)}
                    data-testid={`btn-category-${cat.key}`}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border text-left transition-all ${
                      selectedCategory === cat.key
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-muted/20 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <span className="text-xl leading-none">{cat.emoji}</span>
                    <span className="text-sm font-semibold">{cat.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 gap-1.5"
                  onClick={() => setLocation("/dashboard")}
                  disabled={categoryLoading}
                  data-testid="button-skip-category"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip for now
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  onClick={handleSaveCategory}
                  disabled={categoryLoading || !selectedCategory}
                  data-testid="button-save-category"
                >
                  {categoryLoading ? "Saving..." : (
                    <>
                      Continue
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: SMS Opt-In (only if phone was provided) */}
        {step === "sms" && (
          <Card className={bgImage ? "bg-card/90 backdrop-blur-sm border-white/10" : ""}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-lg">SMS Notifications</CardTitle>
              </div>
              <CardDescription className="text-sm leading-relaxed">
                Would you like to receive optional SMS alerts on <strong className="text-foreground">{form.phone.trim()}</strong>?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">You may receive:</p>
                <ul className="space-y-1.5">
                  {[
                    "Daily score reminders if you haven't logged yet",
                    "Alerts when a momentum partner scores their day",
                    "App updates and important notifications",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="text-primary mt-0.5">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-[12px] text-muted-foreground leading-relaxed border border-border rounded-lg p-3 bg-muted/10" data-testid="text-sms-consent-disclosure">
                By tapping "Yes, enable SMS notifications" below, you agree to receive recurring transactional text messages from Sweet Momentum (daily score reminders, a one-time welcome message, and momentum partner alerts) at the number provided. <strong className="text-foreground">Message frequency varies (typically 0–7 msgs/week).</strong> {" "}<strong className="text-foreground">Message and data rates may apply.</strong> {" "}<strong className="text-foreground">Reply STOP to cancel, HELP for help.</strong> Consent is not a condition of purchase. See our{" "}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Terms</a>
                {" "}and{" "}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Privacy Policy</a>.
              </p>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  className="w-full gap-2"
                  disabled={smsOptInLoading}
                  onClick={() => handleSmsOptIn(true)}
                  data-testid="button-sms-opt-in"
                >
                  <Bell className="w-4 h-4" />
                  {smsOptInLoading ? "Saving..." : "Yes, enable SMS notifications"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  disabled={smsOptInLoading}
                  onClick={() => handleSmsOptIn(false)}
                  data-testid="button-sms-skip"
                >
                  <SkipForward className="w-3.5 h-3.5 mr-1.5" />
                  No thanks, skip for now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
