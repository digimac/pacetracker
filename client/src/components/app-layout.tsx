import { Link, useLocation } from "wouter";
import { useAuth, useTheme } from "@/App";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import {
  LayoutDashboard,
  CalendarCheck,
  History,
  Settings,
  Moon,
  Sun,
  LogOut,
  Menu,
  CreditCard,
  ShieldCheck,
  Globe,
  BookOpen,
  Monitor,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PerplexityAttribution from "@/components/PerplexityAttribution";

const ADMIN_EMAIL = "track@sweetmo.io";

const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Today", icon: CalendarCheck, path: "/today" },
  { label: "History", icon: History, path: "/history" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const { data: billing } = useQuery<{ isPro: boolean }>({
    queryKey: ["/api/billing/status"],
    queryFn: () => apiRequest("GET", "/api/billing/status").then(r => r.json()),
    enabled: !!user,
    staleTime: 60_000,
  });
  const isPro = billing?.isPro ?? false;
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(
    location === "/settings" || location.startsWith("/billing")
  );

  async function handleLogout() {
    await apiRequest("POST", "/api/auth/logout");
    queryClient.clear();
    setUser(null);
  }

  const initials = user?.displayName?.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 flex flex-col
        w-64 bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]
        transition-transform duration-200 md:translate-x-0
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-[hsl(var(--sidebar-border))]">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0">
            <img src="/favicon.png" alt="Sweet Momentum" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-[hsl(var(--sidebar-foreground))]">SWEET MOMENTUM</span>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] -mt-0.5 tracking-widest uppercase">Daily Metrics</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const active = location === path || (location === "/" && path === "/dashboard");
            return (
              <div key={path}>
                <button
                  type="button"
                  data-testid={`nav-${label.toLowerCase()}`}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                    ${active
                      ? "bg-primary text-primary-foreground"
                      : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                    }
                  `}
                  onClick={() => {
                    setMobileOpen(false);
                    setLocation(path);
                    if (path === "/settings") setSettingsExpanded(e => !e);
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {path === "/settings" && (
                    <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                      settingsExpanded ? "rotate-180" : ""
                    }`} />
                  )}
                </button>
                {/* Billing nested under Settings — visible only when expanded */}
                {path === "/settings" && settingsExpanded && (
                  <button
                    type="button"
                    data-testid="nav-billing"
                    className={`
                      w-full flex items-center gap-3 pl-9 pr-3 py-2 mt-0.5 rounded-lg text-sm font-medium transition-all duration-150
                      ${(location === "/billing" || location.startsWith("/billing"))
                        ? "bg-primary text-primary-foreground"
                        : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                      }
                    `}
                    onClick={() => { setMobileOpen(false); setLocation("/billing"); }}
                  >
                    <CreditCard className="w-4 h-4 flex-shrink-0" />
                    Billing
                  </button>
                )}
              </div>
            );
          })}

          {/* Content pages — all users */}
          <div className="pt-2 mt-2 border-t border-[hsl(var(--sidebar-border))]">
            {([
              { label: "The Story", icon: BookOpen, path: "/story" },
              { label: "Daily Tracking", icon: Monitor, path: "/tracking" },
              { label: "Connect", icon: MessageSquare, path: "/connect" },
            ] as const).map(({ label, icon: Icon, path }) => {
              const active = location === path;
              return (
                <button
                  key={path}
                  type="button"
                  data-testid={`nav-${label.toLowerCase().replace(/ /g, "-")}`}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                    ${active
                      ? "bg-primary text-primary-foreground"
                      : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                    }
                  `}
                  onClick={() => { setMobileOpen(false); setLocation(path); }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Globe — Pro only */}
          {isPro && (
            <button
              type="button"
              data-testid="nav-globe"
              onClick={() => { setMobileOpen(false); setLocation("/globe"); }}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${location === "/globe"
                    ? "bg-primary text-primary-foreground"
                    : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                  }
                `}
                onClick={() => setMobileOpen(false)}
              >
                <Globe className="w-4 h-4 flex-shrink-0" />
                Score Map
              </button>
          )}

          {/* Admin link — only visible to admin user */}
          {isAdmin && (
            <div className="pt-2 mt-2 border-t border-[hsl(var(--sidebar-border))]">
              <button
              type="button"
              data-testid="nav-admin"
              onClick={() => { setMobileOpen(false); setLocation("/admin"); }}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                    ${location === "/admin"
                      ? "bg-primary text-primary-foreground"
                      : "text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))]"
                    }
                  `}
                  onClick={() => setMobileOpen(false)}
                >
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  Admin
                </button>
            </div>
          )}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-[hsl(var(--sidebar-border))] space-y-2">
          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate text-foreground">{user?.displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.username}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="flex-1 h-8"
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="flex-1 h-8 text-destructive"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-background">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)} data-testid="button-mobile-menu">
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-bold text-sm tracking-tight">SWEET MOMENTUM</span>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </header>

        <main className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1">{children}</div>
          {/* Legal footer */}
          <footer className="border-t border-border px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/terms">
              <a className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">Terms &amp; Conditions</a>
            </Link>
            <Link href="/privacy">
              <a className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">Privacy Policy</a>
            </Link>
            <Link href="/eula">
              <a className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors">EULA</a>
            </Link>
            <span className="text-[10px] text-muted-foreground/30 ml-auto">&copy; {new Date().getFullYear()} Sweet Momentum</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
