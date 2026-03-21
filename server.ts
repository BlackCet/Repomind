import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // GitHub Proxy to avoid CORS and handle basic auth if needed
  app.get("/api/github/repo", async (req, res) => {
    const { owner, repo, path: repoPath = "" } = req.query;
    if (!owner || !repo) {
      return res.status(400).json({ error: "Owner and repo are required" });
    }

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}`;
      const response = await axios.get(url, {
        headers: { 
  Accept: "application/vnd.github.v3+json", 
  "User-Agent": "RepoMind-AI",
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}` 
},
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to fetch from GitHub",
      });
    }
  });

  app.get("/api/github/tree", async (req, res) => {
    const { owner, repo, branch = "main" } = req.query;
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
      const response = await axios.get(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "RepoMind-AI",
        },
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to fetch tree from GitHub",
      });
    }
  });

  app.get("/api/github/raw", async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
      const response = await axios.get(url as string, {
        headers: { "User-Agent": "RepoMind-AI" },
      });
      res.send(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).send("Failed to fetch raw content");
    }
  });

  // Render API Proxy
  app.get("/api/render/owners", async (req, res) => {
    const apiKey = req.headers["x-render-api-key"];
    if (!apiKey) return res.status(401).json({ error: "API Key required" });

    try {
      const response = await axios.get("https://api.render.com/v1/owners", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Render API failed" });
    }
  });

  app.post("/api/render/services", async (req, res) => {
    const apiKey = req.headers["x-render-api-key"];
    if (!apiKey) return res.status(401).json({ error: "API Key required" });

    try {
      const response = await axios.post("https://api.render.com/v1/services", req.body, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Render API failed" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
