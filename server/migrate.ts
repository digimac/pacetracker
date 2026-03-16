import path from "path";

/**
 * Runs Drizzle migrations at server startup.
 * Safe to call unconditionally — skips if DATABASE_URL is not set.
 *
 * In production (dist/index.cjs), migrations are copied to dist/migrations/
 * by the build script. __dirname resolves to the dist/ folder.
 * In development, migrations/ lives at the repo root (process.cwd()).
 */
export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("[migrate] No DATABASE_URL — skipping migrations");
    return;
  }

  try {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { migrate } = await import("drizzle-orm/neon-http/migrator");

    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    // Production: migrations are copied to dist/migrations/ by the build script
    // Development: migrations live at the repo root
    const isProd = process.env.NODE_ENV === "production";
    const migrationsFolder = isProd
      ? path.join(__dirname, "migrations")   // dist/migrations/
      : path.join(process.cwd(), "migrations"); // <repo-root>/migrations/

    console.log("[migrate] Running migrations from:", migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log("[migrate] Migrations complete ✓");
  } catch (err: any) {
    console.error("[migrate] Migration failed:", err.message);
    // Don't crash the server on migration failure
  }
}
