import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Marketing landing page — clean URL, no hash routing
  app.get("/start", (_req, res) => {
    res.sendFile(path.resolve(distPath, "start.html"));
  });

  // Legal pages — clean URLs
  app.get("/terms",   (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));
  app.get("/privacy", (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));
  app.get("/eula",    (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
