/**
 * Simple mode — a reversible, app-wide switch (Admin → Content → App Mode) that trims
 * Sweet Momentum to its core loop: get a reminder, score 6 metrics, see your streak.
 *
 * Nothing is deleted. When Simple mode is off, every page and section comes back
 * exactly as before. Components read the flag with `useSimpleMode()`.
 */
import { createContext, useContext, useEffect, useState } from "react";

type SimpleModeState = { simpleMode: boolean; loaded: boolean; setSimpleMode: (v: boolean) => void };

const SimpleModeContext = createContext<SimpleModeState>({ simpleMode: false, loaded: false, setSimpleMode: () => {} });

export function SimpleModeProvider({ children }: { children: React.ReactNode }) {
  const [simpleMode, setSimpleMode] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/public/app-config", { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => setSimpleMode(d?.simpleMode !== false))
      .catch(() => setSimpleMode(true))
      .finally(() => setLoaded(true));
  }, []);
  return (
    <SimpleModeContext.Provider value={{ simpleMode, loaded, setSimpleMode }}>
      {children}
    </SimpleModeContext.Provider>
  );
}

export const useSimpleMode = () => useContext(SimpleModeContext);

/** The only signed-in pages in Simple mode (plus billing + admin, which stay reachable). */
export const SIMPLE_MODE_PATHS = ["/today", "/history", "/settings"];

/** True if `path` is hidden in Simple mode and should redirect to Today. */
export function isHiddenInSimpleMode(path: string): boolean {
  if (SIMPLE_MODE_PATHS.includes(path)) return false;
  if (path.startsWith("/billing") || path === "/admin") return false;
  return true;
}
