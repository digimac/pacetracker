import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, Zap, Star, Crown, ExternalLink, CalendarClock } from "lucide-react";
import { format } from "date-fns";

type BillingStatus = {
  isPro: boolean;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  prices: {
    monthly: string;
    annual: string;
    monthlyAmount: number;
    annualAmount: number;
  };
};

const FREE_FEATURES = [
  "All 6 core daily metrics (TIME, GOAL, TEAM, TASK, VIEW, PACE)",
  "Daily scoring with WIN / LOSS / SKIP",
  "7-day performance dashboard",
  "Daily notes",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Up to 4 custom metrics (exercise, nutrition, reading, etc.)",
  "Full history — unlimited date range",
  "Weekly, monthly & yearly analytics",
  "Score Map — see where members are scoring worldwide",
  "1-on-1 coaching sessions via Zoom",
  "Priority support",
];

export default function BillingPage() {
  const { toast } = useToast();

  const { data: billing, isLoading } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    queryFn: () => apiRequest("GET", "/api/billing/status").then(r => r.json()),
  });

  const checkoutMutation = useMutation({
    mutationFn: (priceId: string) =>
      apiRequest("POST", "/api/billing/checkout", { priceId }).then(r => r.json()),
    onSuccess: (data) => {
      if (data.url) {
        // Use location.href so Stripe redirect isn't blocked as a popup
        window.location.href = data.url;
      } else if (data.error) {
        toast({ title: "Subscribe error", description: data.error, variant: "destructive" });
      }
    },
    onError: (e: any) => toast({ title: "Checkout error", description: e.message || "Could not start checkout. Please try again.", variant: "destructive" }),
  });

  const portalMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/billing/portal").then(r => r.json()),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (e: any) => toast({ title: "Portal error", description: e.message || "Could not open subscription portal", variant: "destructive" }),
  });

  const monthlyPrice    = billing?.prices.monthlyAmount     ? `$${(billing.prices.monthlyAmount / 100).toFixed(2)}`          : "$9.99";
  const annualPrice     = billing?.prices.annualAmount      ? `$${(billing.prices.annualAmount / 100).toFixed(2)}`           : "$99.00";
  const annualMonthly   = billing?.prices.annualAmount      ? `$${((billing.prices.annualAmount / 100) / 12).toFixed(2)}`   : "$8.25";
  const grpMonthlyPrice = billing?.prices.groupMonthlyAmount ? `$${(billing.prices.groupMonthlyAmount / 100).toFixed(2)}`   : "$95.00";
  const grpAnnualPrice  = billing?.prices.groupAnnualAmount  ? `$${(billing.prices.groupAnnualAmount / 100).toFixed(2)}`    : "$899.00";
  const grpAnnualMonthly = billing?.prices.groupAnnualAmount ? `$${((billing.prices.groupAnnualAmount / 100) / 12).toFixed(2)}` : "$74.92";
  const isGroup = billing?.plan === "group_monthly" || billing?.plan === "group_annual";

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="h-8 bg-muted rounded w-40 mb-6 animate-pulse" />
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-black tracking-tight uppercase">Plans & Subscribe</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Choose the plan that fits your momentum</p>
      </div>

      {/* Current plan banner if Pro */}
      {billing?.isPro && (
        <Card className="mb-6 border-primary/40 bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-bold">
                  Sweet Momentum Pro — {billing.plan === "pro_annual" ? "Annual" : "Monthly"}
                </p>
                {billing.currentPeriodEnd && (
                  <p className="text-xs text-muted-foreground">
                    Renews {format(new Date(billing.currentPeriodEnd), "MMMM d, yyyy")}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              data-testid="button-manage-billing"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              {portalMutation.isPending ? "Opening..." : "Manage Subscription"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── All plan cards — current plan full-width, others in 2-col grid ── */}
      {(() => {
        const plan = billing?.plan || "free";

        // ── Card definitions ──────────────────────────────────────────────────
        const freeCard = (
          <Card key="free" className={`relative ${plan === "free" ? "border-primary/40 ring-1 ring-primary/20" : ""}`}>
            {plan === "free" && <Badge className="absolute -top-3 left-4 bg-primary text-primary-foreground text-[10px]">Current Plan</Badge>}
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-black uppercase tracking-wide">Free</CardTitle>
              <CardDescription className="text-xs">Core metrics, always free</CardDescription>
              <div className="mt-2"><span className="text-3xl font-black">$0</span><span className="text-muted-foreground text-sm ml-1">/ forever</span></div>
            </CardHeader>
            <CardContent className="space-y-2">
              {FREE_FEATURES.map(f => (<div key={f} className="flex items-start gap-2 text-xs text-muted-foreground"><Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />{f}</div>))}
              <div className="pt-3"><Button variant="outline" className="w-full" disabled size="sm">Current Plan</Button></div>
            </CardContent>
          </Card>
        );

        const proMonthlyCard = (
          <Card key="pro_monthly" className={`relative ${plan === "pro_monthly" ? "border-primary/40 ring-1 ring-primary/20" : ""}`}>
            {plan === "pro_monthly" && <Badge className="absolute -top-3 left-4 bg-primary text-primary-foreground text-[10px]">Current Plan</Badge>}
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1"><CardTitle className="text-base font-black uppercase tracking-wide">Pro</CardTitle><Zap className="w-4 h-4 text-primary" /></div>
              <CardDescription className="text-xs">Full access, billed monthly</CardDescription>
              <div className="mt-2"><span className="text-3xl font-black">{monthlyPrice}</span><span className="text-muted-foreground text-sm ml-1">/ month</span></div>
            </CardHeader>
            <CardContent className="space-y-2">
              {PRO_FEATURES.map(f => (<div key={f} className="flex items-start gap-2 text-xs"><Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />{f}</div>))}
              <div className="pt-3">
                <Button className="w-full" size="sm" onClick={() => checkoutMutation.mutate(billing?.prices.monthly || "")} disabled={checkoutMutation.isPending || plan === "pro_monthly"} data-testid="button-subscribe-monthly">
                  {plan === "pro_monthly" ? "Current Plan" : checkoutMutation.isPending ? "Opening..." : "Subscribe Monthly"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );

        const proAnnualCard = (
          <Card key="pro_annual" className={`relative ${plan === "pro_annual" ? "border-primary/40 ring-1 ring-primary/20" : "border-primary/20 bg-primary/[0.02]"}`}>
            <div className="absolute -top-3 left-4">
              {plan === "pro_annual" ? <Badge className="bg-primary text-primary-foreground text-[10px]">Current Plan</Badge> : <Badge className="bg-green-600 text-white text-[10px]">Best Value</Badge>}
            </div>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-1"><CardTitle className="text-base font-black uppercase tracking-wide">Pro Annual</CardTitle><Star className="w-4 h-4 text-yellow-400" /></div>
              <CardDescription className="text-xs">Full access, billed yearly — save ~17%</CardDescription>
              <div className="mt-2"><span className="text-3xl font-black">{annualMonthly}</span><span className="text-muted-foreground text-sm ml-1">/ month</span><p className="text-xs text-muted-foreground mt-0.5">{annualPrice} billed annually</p></div>
            </CardHeader>
            <CardContent className="space-y-2">
              {PRO_FEATURES.map(f => (<div key={f} className="flex items-start gap-2 text-xs"><Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />{f}</div>))}
              <div className="pt-3">
                <Button className="w-full" size="sm" onClick={() => checkoutMutation.mutate(billing?.prices.annual || "")} disabled={checkoutMutation.isPending || plan === "pro_annual"} data-testid="button-subscribe-annual">
                  {plan === "pro_annual" ? "Current Plan" : checkoutMutation.isPending ? "Opening..." : "Subscribe Annually"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );

        const grpMonthlyCard = (
          <Card key="group_monthly" className={`relative ${plan === "group_monthly" ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
            {plan === "group_monthly" && <Badge className="absolute -top-3 left-4 bg-primary text-primary-foreground text-[10px]">Current Plan</Badge>}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-1"><CardTitle className="text-base">Group</CardTitle><Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Monthly</Badge></div>
              <div className="flex items-baseline gap-1"><span className="text-3xl font-black">{grpMonthlyPrice}</span><span className="text-sm text-muted-foreground">/mo</span></div>
              <p className="text-xs text-muted-foreground">Up to 10 seats · ~$9.50/seat/mo</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm">{["10 member seats","All Pro features per seat","Group moderator dashboard","Member invite emails","Discount code for new members","Seat expansion on request"].map(f => <li key={f} className="flex items-center gap-2"><span className="text-green-400 text-xs">✔</span>{f}</li>)}</ul>
              <Button className="w-full" onClick={() => checkoutMutation.mutate(billing?.prices.groupMonthly || "")} disabled={checkoutMutation.isPending || plan === "group_monthly" || !billing?.prices.groupMonthly} variant={plan === "group_monthly" ? "outline" : "default"} data-testid="button-group-monthly">
                {plan === "group_monthly" ? "Current Plan" : !billing?.prices.groupMonthly ? "Coming Soon" : checkoutMutation.isPending ? "Opening..." : "Subscribe Monthly"}
              </Button>
            </CardContent>
          </Card>
        );

        const grpAnnualCard = (
          <Card key="group_annual" className={`relative ${plan === "group_annual" ? "border-primary/40 ring-1 ring-primary/20" : "border-green-500/20 bg-green-500/[0.02]"}`}>
            <div className="absolute -top-3 left-4">
              {plan === "group_annual" ? <Badge className="bg-primary text-primary-foreground text-[10px]">Current Plan</Badge> : <Badge className="bg-green-600 text-white text-[10px]">Best Group Value</Badge>}
            </div>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-1"><CardTitle className="text-base">Group Annual</CardTitle><Badge variant="outline" className="text-[10px] border-green-500/30 text-green-400">Annual</Badge></div>
              <div className="flex items-baseline gap-1"><span className="text-3xl font-black">{grpAnnualPrice}</span><span className="text-sm text-muted-foreground">/yr</span></div>
              <p className="text-xs text-muted-foreground">{grpAnnualMonthly}/mo · ~$7.49/seat/mo</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm">{["10 member seats","All Pro features per seat","Group moderator dashboard","Member invite emails","Discount code for new members","Seat expansion on request","Priority support"].map(f => <li key={f} className="flex items-center gap-2"><span className="text-green-400 text-xs">✔</span>{f}</li>)}</ul>
              <Button className="w-full" onClick={() => checkoutMutation.mutate(billing?.prices.groupAnnual || "")} disabled={checkoutMutation.isPending || plan === "group_annual" || !billing?.prices.groupAnnual} variant={plan === "group_annual" ? "outline" : "default"} data-testid="button-group-annual">
                {plan === "group_annual" ? "Current Plan" : !billing?.prices.groupAnnual ? "Coming Soon" : checkoutMutation.isPending ? "Opening..." : "Subscribe Annually"}
              </Button>
            </CardContent>
          </Card>
        );

        // All cards in order
        const allCards: { id: string; node: React.ReactNode }[] = [
          { id: "free",          node: freeCard },
          { id: "pro_monthly",   node: proMonthlyCard },
          { id: "pro_annual",    node: proAnnualCard },
          { id: "group_monthly", node: grpMonthlyCard },
          { id: "group_annual",  node: grpAnnualCard },
        ];

        const currentCard = allCards.find(c => c.id === plan);
        const otherCards  = allCards.filter(c => c.id !== plan);

        return (
          <div className="space-y-4">
            {/* Current plan — full width */}
            {currentCard && (
              <div className="pt-3">
                <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase mb-3">Your Current Plan</p>
                {currentCard.node}
              </div>
            )}

            {/* Other options — 2-col grid */}
            <div>
              <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase mb-3">Other Options</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherCards.map(c => c.node)}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Manage subscription for Pro users */}
      {billing?.isPro && (
        <p className="text-xs text-center text-muted-foreground mt-6">
          Update payment method, view invoices, or cancel at any time via the{" "}
          <button
            className="text-primary hover:underline"
            onClick={() => portalMutation.mutate()}
          >
            subscription portal
          </button>.
        </p>
      )}

      <p className="text-xs text-center text-muted-foreground mt-4">
        Payments processed securely by Stripe. Cancel anytime.
      </p>
    </div>
  );
}
