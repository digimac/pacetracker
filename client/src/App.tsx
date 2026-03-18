import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState, createContext, useContext } from "react";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import DashboardPage from "@/pages/dashboard";
import TodayPage from "@/pages/today";
import HistoryPage from "@/pages/history";
import SettingsPage from "@/pages/settings";
import BillingPage from "@/pages/billing";
import AdminPage from "@/pages/admin";
import GlobePage from "@/pages/globe";
import StoryPage from "@/pages/story";
import TrackingGuidePage from "@/pages/tracking-guide";
import ConnectPage from "@/pages/connect";
import InvitePage from "@/pages/invite";
import AppLayout from "@/components/app-layout";

function BillingSuccessPage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/billing/status"] });
    setTimeout(() => setLocation("/billing"), 3000);
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-black mb-2">Welcome to Pro!</h2>
        <p className="text-muted-foreground text-sm">Your subscription is now active. Redirecting you back...</p>
      </div>
    </div>
  );
}

// Theme context
interface ThemeContextType {
  theme: "dark" | "light";
  toggleTheme: () => void;
}
export const ThemeContext = createContext<ThemeContextType>({ theme: "dark", toggleTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

// Auth context
interface AuthUser { id: number; email: string; username: string; displayName: string; firstName?: string | null; lastName?: string | null; city?: string | null; region?: string | null; country?: string | null; }
interface AuthContextType {
  user: AuthUser | null;
  setUser: (u: AuthUser | null) => void;
  isLoading: boolean;
}
export const AuthContext = createContext<AuthContextType>({ user: null, setUser: () => {}, isLoading: true });
export const useAuth = () => useContext(AuthContext);

function Router() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      // Redirect unauthenticated users to login — EXCEPT for public pages
      const isPublic =
        location === "/register" ||
        location.startsWith("/forgot-password") ||
        location.startsWith("/reset-password") ||
        location.startsWith("/invite/");
      if (!user && !isPublic) setLocation("/login");
      // Redirect authenticated users away from auth pages
      if (user && (location === "/login" || location === "/register" || location === "/")) setLocation("/dashboard");
    }
  }, [user, isLoading, location]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // These routes render regardless of auth state — bypasses Switch entirely
  if (location.startsWith("/reset-password")) return <ResetPasswordPage />;
  if (location.startsWith("/forgot-password")) return <ForgotPasswordPage />;
  if (location.startsWith("/invite/")) {
    // Pass token via Route so useParams works inside InvitePage
    return (
      <Switch>
        <Route path="/invite/:token" component={InvitePage} />
      </Switch>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/register" component={RegisterPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/today" component={TodayPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/billing" component={BillingPage} />
        <Route path="/billing/success" component={BillingSuccessPage} />
        <Route path="/billing/cancel" component={BillingPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/globe" component={GlobePage} />
        <Route path="/story" component={StoryPage} />
        <Route path="/tracking" component={TrackingGuidePage} />
        <Route path="/connect" component={ConnectPage} />
        <Route path="/admin" component={AdminPage} />
        <Route component={DashboardPage} />
      </Switch>
    </AppLayout>
  );
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setUser(data.user);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme(t => t === "dark" ? "light" : "dark") }}>
      <AuthContext.Provider value={{ user, setUser, isLoading }}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter hook={useHashLocation}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}
