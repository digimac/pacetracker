import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { useAuth } from "@/App";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { USER_CATEGORIES } from "@/lib/categories";
import { MapPin, ArrowRight, SkipForward } from "lucide-react";

type Step = "account" | "location" | "category";

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("account");
  const [form, setForm] = useState({ displayName: "", email: "", password: "" });
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
      const res = await apiRequest("POST", "/api/auth/register", form);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setUser(data.user);
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

  async function handleSaveCategory() {
    if (!selectedCategory) { setLocation("/dashboard"); return; }
    setCategoryLoading(true);
    try {
      const res = await apiRequest("PATCH", "/api/auth/profile", { category: selectedCategory });
      const data = await res.json();
      if (data.user) setUser(data.user);
    } catch {}
    finally { setCategoryLoading(false); }
    setLocation("/dashboard");
  }

  const hasLocationData = location.city.trim() || location.country.trim();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto mb-4">
            <img src="/favicon.png" alt="Sweet Momentum" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SWEET MOMENTUM</h1>
          <p className="text-sm text-muted-foreground mt-1">Start tracking your daily performance</p>
        </div>

        {/* Step 1: Account Creation */}
        {step === "account" && (
          <Card>
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
          <Card>
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
          <Card>
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
      </div>
    </div>
  );
}
