import axios from 'axios';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  Filter,
  History,
  Package,
  RefreshCcw,
  Search,
  ShieldAlert,
  Sparkles,
  TerminalSquare,
  Upload,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { requestApi } from '../lib/api';

const HISTORY_KEY = 'unifix_dependency_audit_history';

const KNOWN_DEPRECATED = {
  request: 'Deprecated. Prefer axios, fetch, or undici.',
  moment: 'Legacy heavy date library. Consider date-fns, Day.js, or Luxon.',
  uuid: 'Older major versions are common legacy baggage. Prefer a modern major release.',
  'node-sass': 'Deprecated in favor of sass.',
  tslint: 'Deprecated in favor of ESLint.',
  'left-pad': 'Usually unnecessary utility dependency.',
};

const KNOWN_MAJOR_BASELINES = {
  react: 18,
  'react-dom': 18,
  next: 14,
  express: 4,
  axios: 1,
  vite: 5,
  webpack: 5,
  typescript: 5,
  eslint: 9,
  mongoose: 8,
  tailwindcss: 3,
};

const PACKAGE_MANAGER_OPTIONS = ['npm', 'pnpm', 'yarn'];

const normalizeGithubUrl = (value) => {
  let url = value.trim();
  if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
    url = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  return url;
};

const extractMajor = (version = '') => {
  const match = String(version).match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

const detectPackageManager = (parsed, manifestName, manifestPath) => {
  const pathText = `${manifestName} ${manifestPath}`.toLowerCase();
  if (parsed.packageManager) {
    const known = PACKAGE_MANAGER_OPTIONS.find((manager) => parsed.packageManager.startsWith(manager));
    if (known) return known;
  }
  if (pathText.includes('pnpm-lock')) return 'pnpm';
  if (pathText.includes('yarn.lock')) return 'yarn';
  return 'npm';
};

const buildInstallCommand = (manager, name, scope, mode = 'upgrade') => {
  if (mode === 'remove') {
    if (manager === 'pnpm') return `pnpm remove ${name}`;
    if (manager === 'yarn') return `yarn remove ${name}`;
    return `npm uninstall ${name}`;
  }

  const isDev = scope === 'devDependency';
  if (manager === 'pnpm') {
    return isDev ? `pnpm add -D ${name}@latest` : `pnpm add ${name}@latest`;
  }
  if (manager === 'yarn') {
    return isDev ? `yarn add -D ${name}@latest` : `yarn add ${name}@latest`;
  }
  return isDev ? `npm install -D ${name}@latest` : `npm install ${name}@latest`;
};

const getLifecycleScripts = (scripts = {}) => {
  const lifecycleKeys = ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly'];
  return lifecycleKeys.filter((key) => scripts[key]);
};

const parseManifest = (content, manifestName = 'package.json', manifestPath = '') => {
  const parsed = JSON.parse(content);
  const manager = detectPackageManager(parsed, manifestName, manifestPath);
  const lifecycleScripts = getLifecycleScripts(parsed.scripts || {});
  const duplicateNames = new Set(
    Object.keys(parsed.dependencies || {}).filter((name) => Object.prototype.hasOwnProperty.call(parsed.devDependencies || {}, name))
  );

  const enrichRows = (entries, scope) => entries.map(([name, version]) => {
    const notes = [];
    const flags = [];
    const major = extractMajor(version);
    const deprecated = KNOWN_DEPRECATED[name];
    const baseline = KNOWN_MAJOR_BASELINES[name];
    const unstableSpecifier = /(?:\blatest\b|\*|github:|git\+|https?:\/\/)/i.test(String(version));
    const duplicate = duplicateNames.has(name);
    const severeOutdated = baseline && major !== null && major + 2 <= baseline;
    const mildlyOutdated = baseline && major !== null && major < baseline && !severeOutdated;

    let riskLevel = 'low';
    if (deprecated) {
      notes.push(deprecated);
      flags.push('deprecated');
      riskLevel = 'high';
    }
    if (severeOutdated) {
      notes.push(`Pinned to a much older major than the common current baseline (${baseline}).`);
      flags.push('outdated-major');
      riskLevel = 'high';
    } else if (mildlyOutdated) {
      notes.push(`Behind the common current major baseline (${baseline}).`);
      flags.push('outdated');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    if (unstableSpecifier) {
      notes.push('Uses a floating or non-registry specifier, which reduces reproducibility.');
      flags.push('unstable-specifier');
      if (riskLevel === 'low') riskLevel = 'medium';
    }
    if (duplicate) {
      notes.push('Declared in both dependencies and devDependencies.');
      flags.push('duplicate-scope');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    return {
      name,
      version,
      scope,
      manager,
      major,
      duplicate,
      deprecated: Boolean(deprecated),
      unstableSpecifier,
      riskLevel,
      flags,
      notes,
      fixCommand: buildInstallCommand(manager, name, scope),
      removeCommand: buildInstallCommand(manager, name, scope, 'remove'),
    };
  });

  const dependencies = enrichRows(Object.entries(parsed.dependencies || {}), 'dependency');
  const devDependencies = enrichRows(Object.entries(parsed.devDependencies || {}), 'devDependency');
  const rows = [...dependencies, ...devDependencies];
  const riskCounts = rows.reduce((acc, row) => {
    acc[row.riskLevel] += 1;
    return acc;
  }, { low: 0, medium: 0, high: 0 });

  return {
    parsed,
    manager,
    lifecycleScripts,
    rows,
    stats: {
      dependencies: dependencies.length,
      devDependencies: devDependencies.length,
      scripts: Object.keys(parsed.scripts || {}).length,
      lifecycleScripts: lifecycleScripts.length,
      name: parsed.name || 'Unknown package',
      version: parsed.version || 'N/A',
      private: Boolean(parsed.private),
      highRiskPackages: riskCounts.high,
      mediumRiskPackages: riskCounts.medium,
    },
  };
};

const extractFixCommands = (auditResult = '') => {
  const matches = auditResult.match(/(?:npm|pnpm|yarn)\s+[^\n]+/g) || [];
  return [...new Set(matches.map((command) => command.trim()))];
};

const scoreManifest = (rows, commandCount, lifecycleCount) => {
  const riskPenalty = rows.reduce((sum, row) => {
    if (row.riskLevel === 'high') return sum + 14;
    if (row.riskLevel === 'medium') return sum + 6;
    return sum + 1;
  }, 0);

  const rawScore = 100
    - Math.min(riskPenalty, 55)
    - Math.min(commandCount * 4, 20)
    - Math.min(lifecycleCount * 8, 16);

  return Math.max(12, Math.round(rawScore));
};

const buildLocalRecommendations = (rows, manager) => {
  const commands = [];

  rows.forEach((row) => {
    if (row.riskLevel !== 'low' || row.unstableSpecifier) {
      commands.push(buildInstallCommand(manager || row.manager, row.name, row.scope));
    }
    if (row.deprecated && row.name === 'request') {
      commands.push(buildInstallCommand(manager || row.manager, row.name, row.scope, 'remove'));
    }
    if (row.deprecated && row.name === 'moment') {
      commands.push(`# Review ${row.name}: replace with a modern date library before removing it.`);
    }
  });

  return [...new Set(commands)];
};

const buildExportReport = ({ manifestData, manifestName, manifestPath, auditResult, fixCommands, qualityScore }) => {
  return JSON.stringify({
    generatedAt: new Date().toISOString(),
    manifestName,
    manifestPath,
    qualityScore,
    summary: manifestData?.stats || null,
    manager: manifestData?.manager || 'npm',
    lifecycleScripts: manifestData?.lifecycleScripts || [],
    packages: manifestData?.rows || [],
    fixCommands,
    aiReport: auditResult,
  }, null, 2);
};

const badgeTone = {
  low: 'bg-emerald-500/15 text-emerald-200',
  medium: 'bg-amber-500/15 text-amber-200',
  high: 'bg-rose-500/15 text-rose-200',
};

const cardClass = 'rounded-[28px] border border-white/10 bg-slate-950/80 p-6 shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl';
const shellCardClass = 'rounded-[32px] border border-white/10 bg-slate-950/80 shadow-[0_60px_140px_rgba(15,23,42,0.45)] backdrop-blur-2xl';

const StatCard = ({ label, value, hint, accent = 'text-white' }) => (
  <div className="min-h-[148px] rounded-[28px] border border-white/10 bg-slate-950/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
    <div className="min-h-[34px] text-[9px] font-black uppercase leading-4 tracking-[0.18em] text-slate-500 sm:text-[10px]">
      {label}
    </div>
    <div className={`mt-4 break-words text-2xl font-black leading-tight sm:text-3xl ${accent}`}>{value}</div>
    {hint ? <div className="mt-2 text-sm text-slate-400">{hint}</div> : null}
  </div>
);

const fallbackCopy = (value) => {
  const textArea = document.createElement('textarea');
  textArea.value = value;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
};

const DependencyAudit = () => {
  const [githubUrl, setGithubUrl] = useState('');
  const [manualPaste, setManualPaste] = useState('');
  const [packageContent, setPackageContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState('');
  const [manifestName, setManifestName] = useState('package.json');
  const [manifestPath, setManifestPath] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [sortKey, setSortKey] = useState('riskLevel');
  const [sortDirection, setSortDirection] = useState('desc');
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState('');
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Failed to restore dependency audit history', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
  }, [history]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const manifestData = useMemo(() => {
    if (!packageContent) return null;
    try {
      return parseManifest(packageContent, manifestName, manifestPath);
    } catch (error) {
      return { error: error.message, rows: [], stats: null, manager: 'npm', lifecycleScripts: [] };
    }
  }, [packageContent, manifestName, manifestPath]);

  const aiFixCommands = useMemo(() => extractFixCommands(auditResult), [auditResult]);

  const localFixCommands = useMemo(() => {
    if (!manifestData?.rows?.length) return [];
    return buildLocalRecommendations(manifestData.rows, manifestData.manager);
  }, [manifestData]);

  const fixCommands = useMemo(() => [...new Set([...localFixCommands, ...aiFixCommands])], [localFixCommands, aiFixCommands]);

  const filteredRows = useMemo(() => {
    if (!manifestData?.rows) return [];

    const riskOrder = { low: 1, medium: 2, high: 3 };

    const nextRows = manifestData.rows
      .filter((row) => scopeFilter === 'all' || row.scope === scopeFilter)
      .filter((row) => riskFilter === 'all' || row.riskLevel === riskFilter)
      .filter((row) => {
        const haystack = `${row.name} ${row.version} ${row.scope} ${row.notes.join(' ')}`.toLowerCase();
        return haystack.includes(searchQuery.toLowerCase());
      });

    nextRows.sort((a, b) => {
      let left = a[sortKey];
      let right = b[sortKey];

      if (sortKey === 'riskLevel') {
        left = riskOrder[a.riskLevel];
        right = riskOrder[b.riskLevel];
      }

      if (typeof left === 'string' || typeof right === 'string') {
        const direction = sortDirection === 'asc' ? 1 : -1;
        return String(left || '').localeCompare(String(right || '')) * direction;
      }

      const direction = sortDirection === 'asc' ? 1 : -1;
      return ((left || 0) - (right || 0)) * direction;
    });

    return nextRows;
  }, [manifestData, riskFilter, scopeFilter, searchQuery, sortKey, sortDirection]);

  const qualityScore = useMemo(() => {
    if (!manifestData?.rows) return 100;
    return scoreManifest(manifestData.rows, fixCommands.length, manifestData.lifecycleScripts.length);
  }, [manifestData, fixCommands.length]);

  const topRisks = useMemo(() => {
    if (!manifestData?.rows) return [];
    return manifestData.rows
      .filter((row) => row.riskLevel !== 'low' || row.notes.length)
      .sort((a, b) => (a.riskLevel === b.riskLevel ? a.name.localeCompare(b.name) : (a.riskLevel === 'high' ? -1 : 1)))
      .slice(0, 6);
  }, [manifestData]);

  const copyToClipboard = async (value) => {
    if (!value?.trim()) {
      setToast('Nothing to copy');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopy(value);
      }
      setToast('Copied to clipboard');
    } catch (error) {
      try {
        fallbackCopy(value);
        setToast('Copied to clipboard');
      } catch {
        console.error('Copy failed:', error);
        setToast('Copy failed');
      }
    }
  };

  const handleCopyWithFeedback = async (value, key) => {
    const didCopy = await (async () => {
      if (!value?.trim()) {
        setToast('Nothing to copy');
        return false;
      }

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          fallbackCopy(value);
        }
        setToast('Copied to clipboard');
        return true;
      } catch (error) {
        try {
          fallbackCopy(value);
          setToast('Copied to clipboard');
          return true;
        } catch {
          console.error('Copy failed:', error);
          setToast('Copy failed');
          return false;
        }
      }
    })();

    if (!didCopy) return;

    setCopiedKey(key);
    window.setTimeout(() => {
      setCopiedKey((current) => (current === key ? '' : current));
    }, 1800);
  };

  const loadManifestBuffer = (content, name, pathLabel) => {
    setPackageContent(content);
    setManualPaste(content);
    setManifestName(name);
    setManifestPath(pathLabel);
    setAuditResult('');
  };

  const handleFetch = async () => {
    if (!githubUrl.trim()) return;
    setLoading(true);
    try {
      const url = normalizeGithubUrl(githubUrl);
      const res = await axios.get(url);
      loadManifestBuffer(JSON.stringify(res.data, null, 2), url.split('/').pop() || 'package.json', url);
    } catch (error) {
      alert(error?.message || 'Failed to fetch manifest');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFromRepo = async () => {
    if (!window.electronAPI?.pickAuditManifest) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.pickAuditManifest();
      if (result?.canceled) return;
      loadManifestBuffer(result.content || '', result.fileName || 'package.json', result.filePath || '');
    } catch (error) {
      alert(error?.message || 'Failed to open manifest');
    } finally {
      setLoading(false);
    }
  };

  const handleAudit = async () => {
    if (!packageContent) return;
    setLoading(true);
    try {
      const res = await requestApi({
        method: 'post',
        url: '/ai/analyze-dependencies',
        data: { packageJsonContent: packageContent },
      });
      const feedback = res.data.feedback || '';
      const currentManifest = manifestData;
      setAuditResult(feedback);
      setHistory((prev) => [
        {
          id: Date.now(),
          manifestName,
          manifestPath,
          snapshot: packageContent,
          time: new Date().toLocaleString(),
          manager: currentManifest?.manager || 'npm',
          dependencies: currentManifest?.stats?.dependencies || 0,
          devDependencies: currentManifest?.stats?.devDependencies || 0,
          highRiskPackages: currentManifest?.stats?.highRiskPackages || 0,
          commands: extractFixCommands(feedback).length,
        },
        ...prev,
      ]);
      setToast('Audit completed');
    } catch (error) {
      alert(error?.response?.data?.error || 'Audit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      loadManifestBuffer(String(ev.target?.result || ''), file.name, file.name);
    };
    reader.readAsText(file);
  };

  const handleApplyManualPaste = () => {
    if (!manualPaste.trim()) return;
    loadManifestBuffer(manualPaste, manifestName || 'package.json', manifestPath || 'Manual input');
    setToast('Manual manifest loaded');
  };

  const handleReset = () => {
    setGithubUrl('');
    setManualPaste('');
    setPackageContent('');
    setAuditResult('');
    setManifestName('package.json');
    setManifestPath('');
    setSearchQuery('');
    setScopeFilter('all');
    setRiskFilter('all');
    setToast('Audit workspace reset');
  };

  const handleExportReport = () => {
    if (!manifestData?.rows?.length) {
      setToast('Nothing to export');
      return;
    }

    const data = buildExportReport({ manifestData, manifestName, manifestPath, auditResult, fixCommands, qualityScore });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${manifestName.replace(/[^a-z0-9.-]+/gi, '-').replace(/^-|-$/g, '') || 'dependency-audit'}-report.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setToast('Audit report exported');
  };

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative overflow-hidden pb-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_26%),radial-gradient(circle_at_78%_18%,rgba(168,85,247,0.12),transparent_22%),radial-gradient(circle_at_20%_24%,rgba(16,185,129,0.08),transparent_18%)]" />
        <div className="relative mx-auto max-w-7xl px-6 pt-10 lg:px-10">
          <section className={`${shellCardClass} relative overflow-hidden p-8 lg:p-10`}>
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 opacity-95" />
            <div className="absolute -right-16 top-0 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-20 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
            <div className="relative flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-sm text-sky-200 shadow-[0_20px_60px_rgba(56,189,248,0.12)]">
                  <WandSparkles size={14} className="text-sky-300" />
                  Risk heuristics + AI remediation
                </div>
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Dependency intelligence that feels like a
                  <span className="bg-gradient-to-r from-sky-300 via-white to-violet-300 bg-clip-text text-transparent"> command center</span>
                </h1>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
                  Import a manifest, score package health, surface the highest-risk dependencies, and export a clean remediation plan without losing the premium dashboard feel.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:w-[420px]">
                <div className="rounded-[24px] border border-rose-400/15 bg-rose-400/10 px-4 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-200/80">Score</div>
                  <div className="mt-2 flex items-center gap-2 text-2xl font-black text-white"><ShieldAlert size={18} className="text-rose-300" />{qualityScore}/100</div>
                </div>
                <div className="rounded-[24px] border border-sky-400/15 bg-sky-400/10 px-4 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-200/80">Packages</div>
                  <div className="mt-2 flex items-center gap-2 text-2xl font-black text-white"><Package size={18} className="text-sky-300" />{manifestData?.rows?.length || 0}</div>
                </div>
                <div className="rounded-[24px] border border-emerald-400/15 bg-emerald-400/10 px-4 py-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/80">Manager</div>
                  <div className="mt-2 flex items-center gap-2 text-2xl font-black text-white"><TerminalSquare size={18} className="text-emerald-300" />{manifestData?.manager || 'npm'}</div>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-8 space-y-8">
            {toast ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {toast}
              </div>
            ) : null}

            <div className="grid gap-8 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-4">
          <div className={cardClass}>
            <div className="mb-6 flex items-center gap-3 text-white">
              <FileJson size={20} className="text-sky-400" />
              <h2 className="text-lg font-bold">Manifest Source</h2>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Fetch via URL</label>
                <div className="flex gap-2">
                  <input
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-sky-500/30"
                    placeholder="GitHub raw or blob URL..."
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                  />
                  <button className="rounded-2xl bg-sky-500 px-4 py-3 text-white hover:bg-sky-400" onClick={handleFetch} disabled={loading}>
                    <ExternalLink size={18} />
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  onClick={handleOpenFromRepo}
                  disabled={!window.electronAPI?.pickAuditManifest || loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Package size={16} />
                  Open From Repo
                </button>

                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition-all hover:border-sky-500/30 hover:bg-white/10">
                  <input type="file" className="hidden" accept=".json,.lock,.yml,.yaml" onChange={handleUpload} />
                  <Upload size={16} />
                  Upload Manifest
                </label>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-slate-400">Manual Paste</h3>
              <button className="text-xs font-semibold text-sky-300 hover:text-sky-200" onClick={handleApplyManualPaste}>
                Use Buffer
              </button>
            </div>
            <textarea
              value={manualPaste}
              onChange={(e) => setManualPaste(e.target.value)}
              placeholder="Paste package.json content here..."
              className="h-56 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-blue-200 outline-none focus:border-sky-500/30"
            />
          </div>

          <div className={cardClass}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-slate-400">Manifest Buffer</h3>
              {packageContent ? (
                <button className="text-xs font-semibold text-sky-300 hover:text-sky-200" onClick={() => setPackageContent('')}>
                  Clear
                </button>
              ) : null}
            </div>

            {packageContent ? (
              <>
                <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-400">
                  <div className="font-semibold text-slate-200">{manifestName}</div>
                  <div className="mt-1 break-all">{manifestPath || 'Manual buffer'}</div>
                </div>
                <pre className="h-[200px] overflow-y-auto rounded-2xl bg-black/30 p-4 text-[11px] leading-relaxed text-blue-300">
                  <code>{packageContent}</code>
                </pre>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black uppercase tracking-[0.24em] text-white transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={handleAudit}
                    disabled={loading || !packageContent || manifestData?.error}
                  >
                    {loading ? 'Running Audit...' : 'Run AI Audit'}
                  </button>
                  <button
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                    onClick={handleReset}
                  >
                    <RefreshCcw size={16} className="mr-2 inline-block" />
                    Reset
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-500">
                Add a manifest to unlock the audit workspace.
              </div>
            )}
          </div>

          <div className={cardClass}>
            <div className="mb-4 flex items-center gap-2 text-white">
              <History size={16} />
              <h3 className="text-sm font-bold uppercase tracking-[0.24em] text-slate-400">Audit History</h3>
            </div>
            <div className="space-y-3">
              {history.length ? history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => loadManifestBuffer(entry.snapshot || packageContent, entry.manifestName, entry.manifestPath)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300 transition-all hover:bg-white/10"
                >
                  <div className="font-semibold text-white">{entry.manifestName}</div>
                  <div className="mt-1 text-xs text-slate-500">{entry.time}</div>
                  <div className="mt-2 text-xs text-slate-400">
                    {entry.dependencies} deps • {entry.devDependencies} devDeps • {entry.highRiskPackages || 0} high risk • {entry.commands} commands
                  </div>
                </button>
              )) : (
                <p className="text-sm text-slate-500">No saved audit history yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6 lg:col-span-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <StatCard label="Package" value={manifestData?.stats?.name || 'No manifest'} hint={manifestData?.stats?.version || 'N/A'} accent="text-white text-lg" />
            <StatCard label="Dependencies" value={manifestData?.stats?.dependencies || 0} />
            <StatCard label="Dev Dependencies" value={manifestData?.stats?.devDependencies || 0} />
            <StatCard label="High Risk" value={manifestData?.stats?.highRiskPackages || 0} accent="text-rose-300" />
            <StatCard label="Lifecycle Hooks" value={manifestData?.stats?.lifecycleScripts || 0} accent="text-amber-300" />
            <StatCard label="Fix Commands" value={fixCommands.length} accent="text-sky-300" />
          </div>

          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <div className={`${cardClass} max-w-full overflow-hidden`}>
              <div className="mb-5 flex flex-col gap-4">
                <div className="flex items-center gap-3 text-white">
                  <Search size={20} className="text-sky-400" />
                  <h2 className="text-xl font-black">Structured Results</h2>
                </div>
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search packages..."
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-500/30"
                    />
                  </div>
                  <div className="relative">
                    <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <select
                      value={scopeFilter}
                      onChange={(e) => setScopeFilter(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 py-2 pl-9 pr-8 text-sm text-white outline-none focus:border-sky-500/30"
                    >
                      <option value="all">All scopes</option>
                      <option value="dependency">Dependencies</option>
                      <option value="devDependency">Dev dependencies</option>
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  </div>
                  <div className="relative">
                    <ShieldAlert size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <select
                      value={riskFilter}
                      onChange={(e) => setRiskFilter(e.target.value)}
                      className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 py-2 pl-9 pr-8 text-sm text-white outline-none focus:border-sky-500/30"
                    >
                      <option value="all">All risks</option>
                      <option value="high">High risk</option>
                      <option value="medium">Medium risk</option>
                      <option value="low">Low risk</option>
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  </div>
                  <div className="flex min-w-0 gap-3">
                    <div className="relative min-w-0 flex-1">
                      <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value)}
                        className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2 pr-8 text-sm text-white outline-none focus:border-sky-500/30"
                      >
                        <option value="riskLevel">Sort: Risk</option>
                        <option value="name">Sort: Name</option>
                        <option value="scope">Sort: Scope</option>
                        <option value="version">Sort: Version</option>
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                    <button
                      onClick={toggleSortDirection}
                      className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10"
                    >
                      {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                    </button>
                  </div>
                </div>
              </div>

              {manifestData?.error ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                  Invalid manifest JSON: {manifestData.error}
                </div>
              ) : filteredRows.length ? (
                <div className="audit-results-shell max-w-full overflow-x-auto overflow-y-auto rounded-2xl border border-white/10">
                  <div className="grid min-w-[760px] grid-cols-[minmax(220px,1.6fr)_110px_130px_90px_120px] gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    <span>Package</span>
                    <span>Version</span>
                    <span>Scope</span>
                    <span>Risk</span>
                    <span>Action</span>
                  </div>
                  <div className="audit-results-scroll max-h-[440px] overflow-y-scroll">
                    {filteredRows.map((row) => (
                      <div key={`${row.scope}-${row.name}`} className="grid min-w-[760px] grid-cols-[minmax(220px,1.6fr)_110px_130px_90px_120px] gap-3 border-b border-white/5 px-4 py-4 text-sm text-slate-300">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-white">{row.name}</div>
                          {row.notes.length ? (
                            <div className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">
                              {row.notes.join(' ')}
                            </div>
                          ) : (
                            <div className="mt-2 line-clamp-2 text-xs text-slate-500">No immediate risk signals detected.</div>
                          )}
                        </div>
                        <div className="truncate">{row.version}</div>
                        <div>
                          <span className={`inline-flex max-w-full truncate rounded-full px-3 py-1 text-xs font-semibold ${
                            row.scope === 'dependency' ? 'bg-sky-500/15 text-sky-200' : 'bg-violet-500/15 text-violet-200'
                          }`}>
                            {row.scope}
                          </span>
                        </div>
                        <div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeTone[row.riskLevel]}`}>
                            {row.riskLevel}
                          </span>
                        </div>
                        <div>
                          <button
                            onClick={() => handleCopyWithFeedback(row.fixCommand, `row-${row.scope}-${row.name}`)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                          >
                            <Copy size={12} />
                            {copiedKey === `row-${row.scope}-${row.name}` ? 'Copied' : 'Copy Fix'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-10 text-center text-slate-500">
                  No dependency rows available yet.
                </div>
              )}
            </div>

            <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-1">
              <div className={`${cardClass} h-fit`}>
                <div className="mb-4 flex items-center gap-3 text-white">
                  <AlertTriangle size={18} className="text-amber-400" />
                  <h3 className="text-lg font-black">Top Risk Signals</h3>
                </div>
                {topRisks.length ? (
                  <div className="space-y-3">
                    {topRisks.map((row) => (
                      <div key={`${row.scope}-${row.name}-risk`} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold text-white">{row.name}</div>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeTone[row.riskLevel]}`}>
                            {row.riskLevel}
                          </span>
                        </div>
                        <div className="mt-2 text-xs leading-relaxed text-slate-400">
                          {row.notes.join(' ') || 'No notable notes.'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-500">
                    Load a manifest to calculate local risk signals.
                  </div>
                )}
              </div>

              <div className={`${cardClass} h-fit`}>
                <div className="mb-4 flex items-center gap-3 text-white">
                  <Sparkles size={18} className="text-emerald-400" />
                  <h3 className="text-lg font-black">Manifest Insights</h3>
                </div>
                {manifestData?.stats ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                      Package manager: <span className="font-semibold text-white">{manifestData.manager}</span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                      Private package: <span className="font-semibold text-white">{manifestData.stats.private ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                      Lifecycle scripts: <span className="font-semibold text-white">{manifestData.lifecycleScripts.length || 0}</span>
                      {manifestData.lifecycleScripts.length ? (
                        <div className="mt-2 text-xs text-slate-400">{manifestData.lifecycleScripts.join(', ')}</div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-500">
                    Manifest metadata will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 2xl:grid-cols-2">
            <div className={cardClass}>
              <div className="mb-4 flex items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-3">
                  <WandSparkles size={18} className="text-violet-400" />
                  <h3 className="text-lg font-black">Action Center</h3>
                </div>
                <button
                  onClick={() => handleCopyWithFeedback(fixCommands.join('\n'), 'copy-all')}
                  disabled={!fixCommands.length}
                  className="shrink-0 rounded-2xl bg-sky-500/20 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copiedKey === 'copy-all' ? 'Copied' : 'Copy All'}
                </button>
              </div>
              {fixCommands.length ? (
                <div className="space-y-3">
                  {fixCommands.map((command, index) => (
                    <div key={command} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <pre className="whitespace-pre-wrap text-xs text-slate-300">{command}</pre>
                      <button
                        onClick={() => handleCopyWithFeedback(command, `command-${index}`)}
                        className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-sky-500/20 px-3 py-2 text-xs font-semibold text-sky-200 hover:bg-sky-500/30"
                      >
                        <Copy size={12} />
                        {copiedKey === `command-${index}` ? 'Copied' : 'Copy Command'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-500">
                  Run an audit or load a manifest to generate fix commands.
                </div>
              )}
            </div>

            <div className={cardClass}>
              <div className="mb-4 flex items-center justify-between gap-3 text-white">
                <div className="flex items-center gap-3">
                  <Sparkles size={18} className="text-emerald-400" />
                  <h3 className="text-lg font-black">Intelligence Report</h3>
                </div>
                <button
                  onClick={handleExportReport}
                  disabled={!manifestData?.rows?.length}
                  className="shrink-0 rounded-2xl bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download size={12} className="mr-2 inline-block" />
                  Export
                </button>
              </div>
              {auditResult ? (
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
                  {auditResult.split('\n').map((line, index) => (
                    line.trim() ? (
                      <p
                        key={index}
                        className={`text-sm leading-relaxed ${
                          line.trim().startsWith('###')
                            ? 'pt-4 text-lg font-black text-white'
                            : line.trim().startsWith('**')
                              ? 'font-bold text-sky-300'
                              : 'text-slate-300'
                        }`}
                      >
                        {line.replace(/###|\*\*/g, '')}
                      </p>
                    ) : null
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-500">
                  The AI audit summary will appear here after you run the scan.
                </div>
              )}
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center gap-3 text-white">
              <CheckCircle size={18} className="text-emerald-400" />
              <h3 className="text-lg font-black">What This Upgrade Added</h3>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                'Manual paste buffer',
                'Risk-level analysis',
                'Lifecycle hook detection',
                'Manager-aware fix commands',
                'Exportable JSON report',
              ].map((feature) => (
                <div key={feature} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </section>
            </div>
          <style>{`
        .audit-results-shell::-webkit-scrollbar,
        .audit-results-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }

        .audit-results-shell::-webkit-scrollbar-track,
        .audit-results-scroll::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.55);
          border-radius: 9999px;
        }

        .audit-results-shell::-webkit-scrollbar-thumb,
        .audit-results-scroll::-webkit-scrollbar-thumb {
          background: rgba(96, 165, 250, 0.35);
          border-radius: 9999px;
          border: 2px solid rgba(15, 23, 42, 0.55);
        }

        .audit-results-shell::-webkit-scrollbar-thumb:hover,
        .audit-results-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(96, 165, 250, 0.55);
        }
      `}</style>
          </div>
        </div>
      </div>
    </main>
  );
};

export default DependencyAudit;
