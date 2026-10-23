import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { countDayTiers } from "@/lib/day-quality";

/** Sweet / Strong / Solid / Off breakdown for a set of day totals. Used on Dashboard and History. */
export function DayQualityCard({ totals, label, className = "mb-6" }: { totals: number[]; label: string; className?: string }) {
  const totalDays = totals.length;
  if (totalDays === 0) return null;
  const dayTiers = countDayTiers(totals);
  const pct = (n: number) => Math.round((n / totalDays) * 100);
  const tiers = [
    { key: "sweet" as const, name: "Sweet", dot: "bg-[#85FF00]", note: "6+ metrics net" },
    { key: "strong" as const, name: "Strong", dot: "bg-green-500", note: "4–5 metrics net" },
    { key: "solid" as const, name: "Solid", dot: "bg-primary", note: "1–3 metrics net" },
    { key: "off" as const, name: "Off", dot: "bg-muted-foreground/40", note: "even or below" },
  ];
  return (
    <Card className={className} data-testid="card-day-quality">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold uppercase tracking-wider">Day Quality — {label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-muted mb-4">
          {tiers.map(t => dayTiers[t.key] > 0 && (
            <div key={t.key} className={t.dot} style={{ width: `${pct(dayTiers[t.key])}%` }} />
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiers.map(t => (
            <div key={t.key}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.name}</span>
              </div>
              <div className="text-xl font-black">{dayTiers[t.key]}</div>
              <div className="text-[11px] text-muted-foreground">{pct(dayTiers[t.key])}% · {t.note}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
