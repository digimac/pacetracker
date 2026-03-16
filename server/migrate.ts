/**
 * Runs Drizzle migrations at server startup.
 * Safe to call unconditionally — skips if DATABASE_URL is not set.
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

    console.log("[migrate] Running database migrations...");
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("[migrate] Migrations complete");
  } catch (err: any) {
    console.error("[migrate] Migration error:", err.message);
    // Don't crash the server on migration failure — log and continue
  }
}
