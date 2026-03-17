import path from "path";

/**
 * Runs Drizzle migrations at server startup using standard pg driver.
 * Compatible with any PostgreSQL host (Render, Neon, Supabase, etc.)
 * Safe to call unconditionally — skips if DATABASE_URL is not set.
 */
export async function runMigrations(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.log("[migrate] No DATABASE_URL — skipping migrations");
    return;
  }

  try {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });

    const db = drizzle(pool);

    // In production the build copies migrations/ next to dist/index.cjs → dist/migrations/
    // __dirname inside the esbuild CJS bundle = the dist/ directory
    const migrationsFolder = path.join(__dirname, "migrations");

    console.log("[migrate] Running migrations from:", migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log("[migrate] Migrations complete ✓");

    await pool.end();
  } catch (err: any) {
    console.error("[migrate] Migration failed:", err.message);
    // Don't crash the server — log and continue
  }
}
