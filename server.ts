import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  // FIXED: Use Render's dynamic port or default to 3000 locally
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Helper to dynamically attach the GitHub token if it exists
  const getGithubHeaders = () => {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "RepoMind-AI",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
  };

  // GitHub Proxy to avoid CORS and handle basic auth if needed
  app.get("/api/github/repo", async (req, res) => {
    const { owner, repo, path: repoPath = "" } = req.query;
    if (!owner || !repo) {
      return res.status(400).json({ error: "Owner and repo are required" });
    }

    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${repoPath}`;
      const response = await axios.get(url, {
        headers: getGithubHeaders(),
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
        // FIXED: Authenticate tree fetch to bypass 60/hr rate limit
        headers: getGithubHeaders(), 
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("GitHub Tree Fetch Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to fetch tree from GitHub",
      });
    }
  });

  app.get("/api/github/raw", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") return res.status(400).json({ error: "URL is required" });

    try {
      const headers: Record<string, string> = { "User-Agent": "RepoMind-AI" };
      
      // FIXED: Only attach the GitHub token if the destination is officially GitHub
      const parsedUrl = new URL(url);
      if (parsedUrl.hostname === "raw.githubusercontent.com" && process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      }

      const response = await axios.get(url, { headers });
      res.send(response.data);
    } catch (error: any) {
      console.error("GitHub Raw Fetch Error:", error.response?.data || error.message);
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

  // FIXED: Explicitly listen on 0.0.0.0 for cloud providers
  app.listen(PORT as number, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();