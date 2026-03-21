import React, { useState, useEffect } from 'react';
import { 
  Github, 
  Search, 
  FileCode, 
  Folder, 
  MessageSquare, 
  Layout, 
  Rocket, 
  ChevronRight, 
  Loader2,
  Code2,
  Info,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { fetchRepoTree, fetchRawContent, parseGithubUrl } from './services/github';
import { analyzeCodebase, generateUML, suggestChanges } from './services/gemini';
import Mermaid from './components/Mermaid';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [repoData, setRepoData] = useState<{ owner: string; repo: string } | null>(null);
  const [tree, setTree] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [uml, setUml] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'summary' | 'uml' | 'deploy' | 'oauth' | 'tweaks'>('summary');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Feature Tweaks State
  const [tweakPrompt, setTweakPrompt] = useState('');
  const [tweakResponse, setTweakResponse] = useState('');
  const [isTweaking, setIsTweaking] = useState(false);
  
  // Render Deployment State
  const [renderApiKey, setRenderApiKey] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleFetchRepo = async () => {
    const parsed = parseGithubUrl(url);
    if (!parsed) {
      alert('Invalid GitHub URL');
      return;
    }

    setLoading(true);
    setRepoData(parsed);
    try {
      const treeData = await fetchRepoTree(parsed.owner, parsed.repo, branch);
      setTree(treeData);
      
      setIsAnalyzing(true);
      
      // Filter "garbage" and select important files for context
      const garbagePatterns = [
        'node_modules', 'dist', 'build', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', 
        'package-lock.json', 'yarn.lock', '.git', '.DS_Store', 'LICENSE'
      ];
      
      const importantFiles = treeData.tree.filter((f: any) => 
        f.type === 'blob' && 
        !garbagePatterns.some(p => f.path.includes(p)) &&
        (f.path.match(/\.(ts|tsx|js|jsx|py|go|rs|java|cpp|rb|php|cs|json|yml|yaml|Dockerfile)$/i))
      );

      // Get top 10 most relevant files (prioritize config and core logic)
      const prioritizedFiles = importantFiles.sort((a: any, b: any) => {
        const score = (path: string) => {
          if (path.includes('package.json') || path.includes('Dockerfile') || path.includes('docker-compose')) return 100;
          if (path.includes('src/index') || path.includes('src/main') || path.includes('app.')) return 90;
          if (path.includes('config') || path.includes('env')) return 80;
          return 0;
        };
        return score(b.path) - score(a.path);
      }).slice(0, 10);

      const fileContents = await Promise.all(
        prioritizedFiles.map(async (f: any) => ({
          path: f.path,
          content: await fetchRawContent(`https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${f.path}`)
        }))
      );

      const fileTreeStr = treeData.tree
        .filter((f: any) => !garbagePatterns.some(p => f.path.includes(p)))
        .map((f: any) => f.path)
        .join('\n');

      const result = await analyzeCodebase(fileTreeStr, fileContents);
      setAnalysis(result);
      
      const generatedUml = await generateUML(JSON.stringify(result));
      setUml(generatedUml);

    } catch (error) {
      console.error(error);
      alert('Failed to fetch repository');
    } finally {
      setLoading(false);
      setIsAnalyzing(false);
    }
  };

  // const handleDeployToRender = async () => {
  //   if (!renderApiKey) {
  //     setDeployStatus({ type: 'error', message: 'Please provide a Render API Key.' });
  //     return;
  //   }

  //   setDeploying(true);
  //   setDeployStatus({ type: 'info', message: 'Connecting to Render...' });

  //   try {
  //     const ownersRes = await fetch('/api/render/owners', {
  //       headers: { 'x-render-api-key': renderApiKey }
  //     });
  //     const owners = await ownersRes.json();
  //     if (!owners.length) throw new Error('No Render owners found.');
  //     const ownerId = owners[0].owner.id;

  //     setDeployStatus({ type: 'info', message: 'Creating Web Service with AI-detected commands...' });

  //     const serviceRes = await fetch('/api/render/services', {
  //       method: 'POST',
  //       headers: { 
  //         'Content-Type': 'application/json',
  //         'x-render-api-key': renderApiKey 
  //       },
  //       body: JSON.stringify({
  //         type: 'web_service',
  //         name: repoData?.repo || 'my-repo-mind-app',
  //         ownerId,
  //         repo: url,
  //         autoDeploy: 'yes',
  //         serviceDetails: {
  //           env: analysis.deployment.env || 'node',
  //           region: 'oregon',
  //           plan: 'free',
  //           buildCommand: analysis.deployment.buildCommand,
  //           startCommand: analysis.deployment.startCommand
  //         }
  //       })
  //     });

  //     const service = await serviceRes.json();
  //     if (service.error) throw new Error(service.error);

  //     setDeployStatus({ 
  //       type: 'success', 
  //       message: `Deployment started! Service URL: ${service.service.dashboardUrl}` 
  //     });
  //   } catch (error: any) {
  //     setDeployStatus({ type: 'error', message: error.message || 'Deployment failed.' });
  //   } finally {
  //     setDeploying(false);
  //   }
  // };

  const handleDeployToRender = async () => {
    // 1. Clean the key to remove accidental spaces
    const cleanApiKey = renderApiKey.trim();

    if (!cleanApiKey) {
      setDeployStatus({ type: 'error', message: 'Please provide a Render API Key.' });
      return;
    }

    // 2. Quick format check (Render keys always start with rnd_)
    if (!cleanApiKey.startsWith('rnd_')) {
      setDeployStatus({ type: 'error', message: 'Invalid API Key format. It should start with "rnd_".' });
      return;
    }

    setDeploying(true);
    setDeployStatus({ type: 'info', message: 'Connecting to Render...' });
try {
      // 1. Fetch Owners
      const ownersRes = await fetch('/api/render/owners', {
        headers: { 
          'Authorization': `Bearer ${cleanApiKey}`, 
          'Accept': 'application/json' 
        }
      });
// try {
//       // 🚨 TEMPORARY DEBUG FIX: Paste your exact new key inside the quotes
//       const debugKey = "rnd_biZSlowljEIPphlMZ1IlFoksM6t9"; 

//       const ownersRes = await fetch('/api/render/owners', {
//         headers: { 
//           'Authorization': `Bearer ${debugKey}`, // Use the hardcoded key
//           'Accept': 'application/json' 
//         }
//       });

      if (!ownersRes.ok) throw new Error(`Failed to fetch owners: ${ownersRes.statusText}`);

      const owners = await ownersRes.json();
      if (!owners || !owners.length) throw new Error('No Render owners found for this API key.');
      
      const ownerId = owners[0].owner.id; // <-- YEH LINE MISSING THI
  
      // 2. Create the service
      const serviceRes = await fetch('/api/render/services', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${renderApiKey}`, // Changed to Bearer token
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          type: 'web_service',
          name: repoData?.repo || 'repo-mind-deployment',
          ownerId: ownerId,
          repo: url,
          autoDeploy: 'no',
          serviceDetails: {
            env: analysis.deployment.env || 'node',
            region: 'oregon',
            plan: 'free',
            buildCommand: analysis.deployment.buildCommand || 'npm install && npm run build',
            startCommand: analysis.deployment.startCommand || 'npm start'
          }
        })
      });

      const serviceData = await serviceRes.json();
      
      if (!serviceRes.ok) {
        throw new Error(serviceData.message || 'Deployment failed to create.');
      }

      setDeployStatus({ 
        type: 'success', 
        message: `Deployment started! View dashboard: ${serviceData.dashboardUrl}` 
      });

    } catch (error: any) {
      console.error("Render Deploy Error:", error);
      setDeployStatus({ type: 'error', message: error.message || 'Deployment failed.' });
    } finally {
      setDeploying(false);
    }
  };

  const handleTweak = async () => {
    if (!tweakPrompt || !analysis) return;
    setIsTweaking(true);
    try {
      const res = await suggestChanges(JSON.stringify(analysis), tweakPrompt);
      setTweakResponse(res);
    } catch (error) {
      console.error(error);
      alert('Failed to get tweak suggestions');
    } finally {
      setIsTweaking(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-bottom border-white/5 bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Code2 className="text-zinc-950 w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">RepoMind <span className="text-emerald-500">AI</span></h1>
          </div>
          
          <div className="flex-1 max-w-2xl mx-12 flex gap-2">
            <div className="relative group flex-1">
              <input 
                type="text" 
                placeholder="https://github.com/owner/repo"
                className="w-full bg-zinc-800/50 border border-white/10 rounded-full px-6 py-2.5 pl-12 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFetchRepo()}
              />
              <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
            </div>
            <div className="relative group w-32">
              <input 
                type="text" 
                placeholder="branch"
                className="w-full bg-zinc-800/50 border border-white/10 rounded-full px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>
            <button 
              onClick={handleFetchRepo}
              disabled={loading}
              className="bg-emerald-500 text-zinc-950 px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <a href="https://render.com" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
              Render <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {!repoData ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl"
            >
              <h2 className="text-4xl font-bold mb-4">The ultimate repo intelligence platform.</h2>
              <p className="text-zinc-400 text-lg mb-8">
                AI-driven analysis of file trees, automated Render deployments, and custom GCP OAuth setup scripts.
              </p>
              <div className="grid grid-cols-2 gap-4 text-left">
                {[
                  { icon: Layout, title: 'Deep Tree Analysis', desc: 'Recursive file tree inspection.' },
                  { icon: ShieldCheck, title: 'OAuth Automation', desc: 'GCP setup scripts via gcloud CLI.' },
                  { icon: Rocket, title: 'AI Deployment', desc: 'One-click Render setup.' },
                  { icon: FileCode, title: 'Multi-UML', desc: 'Class, Sequence, and State diagrams.' }
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl">
                    <item.icon className="w-6 h-6 text-emerald-500 mb-2" />
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-xs text-zinc-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-8">
            {/* Sidebar - Recursive Tree */}
            <aside className="col-span-3 space-y-6">
              <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4 px-2">File Tree</h3>
                <div className="space-y-1 font-mono text-[11px]">
                  {tree?.tree.filter((f: any) => !f.path.includes('node_modules')).slice(0, 100).map((file: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors truncate">
                      {file.type === 'tree' ? <Folder className="w-3 h-3 text-emerald-500/70" /> : <FileCode className="w-3 h-3 text-zinc-500" />}
                      <span>{file.path}</span>
                    </div>
                  ))}
                  {tree?.tree.length > 100 && <p className="text-[10px] text-zinc-600 px-2 mt-2 italic">...and {tree.tree.length - 100} more files</p>}
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <div className="col-span-9 space-y-6">
              {/* Tabs */}
              <div className="flex gap-2 p-1 bg-zinc-900/50 border border-white/5 rounded-xl w-fit">
                {[
                  { id: 'summary', label: 'Intelligence', icon: Info },
                  { id: 'uml', label: 'Architecture', icon: Layout },
                  { id: 'tweaks', label: 'Feature Tweaks', icon: MessageSquare },
                  { id: 'deploy', label: 'Auto-Deploy', icon: Rocket },
                  { id: 'oauth', label: 'OAuth Setup', icon: ShieldCheck }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      activeTab === tab.id 
                        ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20" 
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-8 min-h-[600px]">
                <AnimatePresence mode="wait">
                  {activeTab === 'summary' && (
                    <motion.div 
                      key="summary"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      {isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                          <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                          <p className="text-zinc-400">AI is performing deep tree analysis...</p>
                        </div>
                      ) : analysis ? (
                        <div className="grid grid-cols-2 gap-6">
                          <div className="col-span-2 bg-zinc-800/30 p-6 rounded-2xl border border-white/5">
                            <h2 className="text-2xl font-bold text-emerald-500 mb-2">{analysis.name}</h2>
                            <p className="text-zinc-400">{analysis.purpose}</p>
                          </div>
                          
                          <div className="bg-zinc-800/30 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-4">Tech Stack</h3>
                            <div className="flex flex-wrap gap-2">
                              {analysis.techStack.map((tech: string, i: number) => (
                                <span key={i} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-medium border border-emerald-500/20">
                                  {tech}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="bg-zinc-800/30 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-4">Architecture</h3>
                            <p className="text-sm text-zinc-300 font-mono">{analysis.architecture}</p>
                          </div>

                          <div className="col-span-2 bg-zinc-800/30 p-6 rounded-2xl border border-white/5">
                            <h3 className="text-sm font-semibold text-zinc-500 uppercase mb-4">Core Modules</h3>
                            <div className="grid grid-cols-2 gap-4">
                              {analysis.modules.map((mod: any, i: number) => (
                                <div key={i} className="p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                                  <h4 className="font-bold text-emerald-400 mb-1">{mod.name}</h4>
                                  <p className="text-xs text-zinc-400 leading-relaxed">{mod.responsibility}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-zinc-400">No analysis available yet.</p>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'uml' && (
                    <motion.div 
                      key="uml"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-8"
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">Multi-Perspective Diagrams</h2>
                        <span className="text-xs bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded border border-emerald-500/20">Class | Sequence | State</span>
                      </div>
                      <div className="prose prose-invert max-w-none">
                        <ReactMarkdown components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-mermaid/.exec(className || '');
                            return !inline && match ? (
                              <Mermaid chart={String(children).replace(/\n$/, '')} />
                            ) : (
                              <code className={className} {...props}>{children}</code>
                            );
                          }
                        }}>
                          {uml}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'tweaks' && (
                    <motion.div 
                      key="tweaks"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-6"
                    >
                      <div className="bg-zinc-800/30 p-8 rounded-3xl border border-white/5">
                        <h2 className="text-2xl font-bold mb-2">Feature Tweaks & Integration</h2>
                        <p className="text-zinc-400 mb-8">Ask for code changes, feature integrations, or architectural improvements based on the current codebase.</p>
                        
                        <div className="space-y-4">
                          <textarea 
                            className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-6 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none"
                            placeholder="e.g., 'How can I add a dark mode toggle to this app?' or 'Implement a new API endpoint for user profile updates.'"
                            value={tweakPrompt}
                            onChange={(e) => setTweakPrompt(e.target.value)}
                          />
                          <button 
                            onClick={handleTweak}
                            disabled={isTweaking || !tweakPrompt}
                            className="bg-emerald-500 text-zinc-950 px-8 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            {isTweaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                            {isTweaking ? 'Analyzing...' : 'Get Suggestions'}
                          </button>
                        </div>

                        {tweakResponse && (
                          <div className="mt-12 space-y-4">
                            <div className="flex items-center gap-2 text-emerald-500 font-semibold mb-4">
                              <Code2 className="w-5 h-5" />
                              <h3>AI Recommendations</h3>
                            </div>
                            <div className="prose prose-invert max-w-none bg-zinc-950/50 p-8 rounded-2xl border border-white/5">
                              <ReactMarkdown>{tweakResponse}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'deploy' && (
                    <motion.div 
                      key="deploy"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-8"
                    >
                      <div className="bg-emerald-500/5 border border-emerald-500/20 p-8 rounded-3xl">
                        <div className="flex items-center gap-6 mb-8">
                          <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                            <Rocket className="text-emerald-500 w-8 h-8" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold">AI-Powered Auto-Deploy</h2>
                            <p className="text-zinc-400">Render deployment using AI-detected build and start commands.</p>
                          </div>
                        </div>

                        {analysis?.deployment && (
                          <div className="mb-8 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                                <p className="text-[10px] text-zinc-500 uppercase mb-1">Build Command</p>
                                <code className="text-xs text-emerald-400">{analysis.deployment.buildCommand}</code>
                              </div>
                              <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                                <p className="text-[10px] text-zinc-500 uppercase mb-1">Start Command</p>
                                <code className="text-xs text-emerald-400">{analysis.deployment.startCommand}</code>
                              </div>
                            </div>
                            {analysis.deployment.envVars?.length > 0 && (
                              <div className="p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                                <p className="text-[10px] text-zinc-500 uppercase mb-2">Required Env Vars</p>
                                <div className="flex flex-wrap gap-2">
                                  {analysis.deployment.envVars.map((v: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 bg-zinc-950 px-2 py-1 rounded text-[10px]">
                                      <span className="text-zinc-500">{v.key}:</span>
                                      <span className="text-emerald-400">{v.value}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="space-y-6 max-w-lg">
                          <div>
                            <label className="block text-sm font-medium text-zinc-500 mb-2 uppercase tracking-wider">Render API Key</label>
                            <input 
                              type="password" 
                              placeholder="rnd_..."
                              className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                              value={renderApiKey}
                              onChange={(e) => setRenderApiKey(e.target.value)}
                            />
                          </div>

                          <button 
                            onClick={handleDeployToRender}
                            disabled={deploying}
                            className="w-full bg-emerald-500 text-zinc-950 font-bold py-4 rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {deploying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Rocket className="w-5 h-5" />}
                            {deploying ? 'Executing AI Deployment...' : 'Deploy to Render'}
                          </button>

                          {deployStatus && (
                            <div className={cn(
                              "p-4 rounded-xl text-sm border",
                              deployStatus.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" :
                              deployStatus.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                              "bg-zinc-800 border-white/5 text-zinc-300"
                            )}>
                              {deployStatus.message}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'oauth' && (
                    <motion.div 
                      key="oauth"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="space-y-8"
                    >
                      <div className="bg-zinc-900/50 border border-white/5 p-8 rounded-3xl">
                        <div className="flex items-center gap-6 mb-8">
                          <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/5">
                            <ShieldCheck className="text-emerald-500 w-8 h-8" />
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold">Google OAuth Blocker Fix</h2>
                            <p className="text-zinc-400">AI-generated gcloud scripts to bypass manual GCP configuration.</p>
                          </div>
                        </div>

                        {analysis?.oauth?.required ? (
                          <div className="space-y-6">
                            <div className="p-6 bg-zinc-950 rounded-2xl border border-white/5">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <Terminal className="w-4 h-4 text-emerald-500" />
                                  <h3 className="font-semibold">Setup Script</h3>
                                </div>
                                <button 
                                  onClick={() => copyToClipboard(analysis.oauth.gcloudScript)}
                                  className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
                                >
                                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                  {copied ? 'Copied!' : 'Copy Script'}
                                </button>
                              </div>
                              <pre className="text-[11px] text-zinc-400 bg-zinc-900 p-4 rounded-xl overflow-x-auto custom-scrollbar leading-relaxed">
                                {analysis.oauth.gcloudScript}
                              </pre>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-zinc-800/30 rounded-xl border border-white/5">
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Detected Env Vars</h4>
                                <div className="flex flex-wrap gap-2">
                                  {analysis.oauth.envVars.map((v: string, i: number) => (
                                    <code key={i} className="text-[10px] bg-zinc-900 px-2 py-1 rounded text-emerald-400">{v}</code>
                                  ))}
                                </div>
                              </div>
                              <div className="p-4 bg-zinc-800/30 rounded-xl border border-white/5">
                                <h4 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Instructions</h4>
                                <p className="text-[11px] text-zinc-400">Run the script in your terminal (requires gcloud CLI). It will create the project and output your credentials.</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                            <ShieldCheck className="w-12 h-12 mb-4 opacity-20" />
                            <p>No OAuth requirements detected in this codebase.</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
