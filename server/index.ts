import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from "./migrate";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

// Trust Render/Cloudflare reverse proxy so sessions work correctly behind HTTPS termination
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // 1. Run DB migrations FIRST — this ensures the session table exists
  await runMigrations();

  // 2. NOW set up session middleware, after the session table is guaranteed to exist
  function buildSessionStore() {
    if (process.env.DATABASE_URL) {
      try {
        const PgSession = connectPgSimple(session);
        const store = new PgSession({
          pool,
          tableName: "session",
          createTableIfMissing: false, // table is created by migration 0009
        });
        store.on("error", (err: any) => {
          console.error("[session-store] PgSession error:", err?.message || err);
        });
        console.log("[session-store] Using PostgreSQL session store");
        return store;
      } catch (err: any) {
        console.error("[session-store] Failed to init PgSession, falling back to memory:", err?.message);
      }
    }
    const MemStore = MemoryStore(session);
    console.log("[session-store] Using in-memory session store (no DATABASE_URL)");
    return new MemStore({ checkPeriod: 86400000 });
  }

  app.use(session({
    secret: process.env.SESSION_SECRET || "pacetracker-secret-2024",
    resave: true,
    saveUninitialized: false,
    rolling: true,
    store: buildSessionStore(),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }));

  // 3. Register all API routes
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
