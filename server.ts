import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as fs from 'fs';
import fetch from "node-fetch";
import { createProxyMiddleware } from "http-proxy-middleware";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

console.log("FAL_KEY loaded:", process.env.FAL_KEY ? `YES` : "NO");

// Proxy for ComfyUI
app.use("/api/comfy/proxy", createProxyMiddleware({
  changeOrigin: true,
  ws: true,
  logger: console,
    // Dynamic target routing
    router: (req) => {
      try {
        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const target = url.searchParams.get("target");
        if (target) return target;
      } catch (e) {
        console.error("[Proxy Router] Error parsing target:", e);
      }
      return "http://127.0.0.1:8000";
    },
    // Rewrite path
    pathRewrite: (path) => {
      let newPath = path.replace(/^\/api\/comfy\/proxy/, "");
      try {
          const [pathname, search] = newPath.split("?");
          const searchParams = new URLSearchParams(search);
          searchParams.delete("target");
          const newSearch = searchParams.toString();
          return pathname + (newSearch ? `?${newSearch}` : "");
      } catch (e) {
          return newPath;
      }
    },
    // Headers
    on: {
      proxyReq: (proxyReq: any) => {
         const targetHost = proxyReq.getHeader('host');
         if (targetHost) {
            const origin = `http://${targetHost}`;
            proxyReq.setHeader("Origin", origin);
            proxyReq.setHeader("Referer", origin);
         }
      },
      proxyReqWs: (proxyReq: any, req: any) => {
         try {
             const url = new URL(req.url || "", `http://${req.headers.host}`);
             const target = url.searchParams.get("target") || "http://127.0.0.1:8000";
             const targetUrl = new URL(target);
             proxyReq.setHeader("Origin", targetUrl.origin);
             proxyReq.setHeader("Referer", targetUrl.origin);
         } catch (e) {
             console.error("[ProxyReqWs] Error setting headers:", e);
         }
      },
    },
  }));
  
  app.use(express.json());
  
  // Serve static files from dist in production
  if (process.env.NODE_ENV === 'production') {
      app.use(express.static(join(__dirname, "dist")));
  }
  
  // Token Proxy
  app.post("/api/fal/realtime-token", async (req: Request, res: Response) => {
    const { app: falApp } = req.body;
    const appPath = falApp ?? "fal-ai/flux-2/klein";
    const alias = appPath.split("/")[1] ?? appPath;
    try {
      const response = await fetch("https://rest.alpha.fal.ai/tokens/", {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          allowed_apps: [alias],
          token_expiration: 120,
        }),
      });
  
      if (!response.ok) {
        const text = await response.text();
        console.error("Token error:", text);
        return res.status(response.status).send(text);
      }
  
      const raw = await response.text();
      let token;
      try {
        token = JSON.parse(raw);
        if (typeof token === "object" && token.detail) token = token.detail;
      } catch {
        token = raw;
      }
      res.send(typeof token === "string" ? token : JSON.stringify(token));
    } catch (err) {
      console.error("Token fetch failed:", err);
      res.status(500).send("Token generation failed");
    }
  });
  
  app.post("/api/comfy/ping", async (req: Request, res: Response) => {
    try {
      const { host } = req.body;
      if (!host || typeof host !== "string") return res.status(400).json({ error: "missing host" });
  
      const normalizedHost = host.match(/^https?:\/\//) ? host : `http://${host}`;
      const upstream = await fetch(normalizedHost, { method: "GET", redirect: "follow", timeout: 5000 } as any);
  
      if (!upstream.ok && upstream.status !== 200) {
        return res.status(502).json({ ok: false, status: upstream.status, statusText: upstream.statusText });
      }
  
      return res.json({ ok: true, status: upstream.status, statusText: upstream.statusText });
    } catch (err: any) {
      console.error("[comfy ping]", err?.message || err);
      return res.status(500).json({ ok: false, error: err.message || String(err) });
    }
// Duplicate block removed
  });

  // Workflow Management
  const WORKFLOW_DIR = join(process.cwd(), 'Workflow');
  
  // List workflows
  app.get("/api/workflows", (_req: Request, res: Response) => {
      try {
          if (!fs.existsSync(WORKFLOW_DIR)) {
              return res.json([]);
          }
          const files = fs.readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.json'));
          res.json(files);
      } catch (e: any) {
          console.error("Error listing workflows:", e);
          res.status(500).json({ error: "Failed to list workflows" });
      }
  });

  // Get workflow content
  app.get("/api/workflows/:name", (req: Request, res: Response) => {
      try {
          const name = req.params.name;
          // Basic sanitization to prevent directory traversal
          if (name.includes('..') || name.includes('/') || name.includes('\\')) {
              return res.status(400).json({ error: "Invalid filename" });
          }
          const filePath = join(WORKFLOW_DIR, name);
          if (!fs.existsSync(filePath)) {
              return res.status(404).json({ error: "Workflow not found" });
          }
          const content = fs.readFileSync(filePath, 'utf-8');
          res.json(JSON.parse(content));
      } catch (e: any) {
          console.error("Error reading workflow:", e);
          res.status(500).json({ error: "Failed to read workflow" });
      }
  });

// SPA Catch-all (Production only)
if (process.env.NODE_ENV === 'production') {
    app.get("*", (req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith("/api")) return next();
        res.sendFile(join(__dirname, "dist", "index.html"));
    });
}

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error("Server error:", err);
  }
  process.exit(1);
});
