import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  CloudCog,
  Download,
  RefreshCcw,
  Save,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  Terminal,
  Upload,
  Wand2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const defaultSettings = {
  theme: 'dark',
  accent: '#58a6ff',
  aiModel: 'ollama',
  autoSave: true,
  secureMode: true,
  automation: true,
  notifications: true,
  debugMode: false,
  verboseLogs: false,
  apiKeysEnabled: true,
};

const engineOptions = [
  {
    id: 'gemini',
    title: 'Gemini 2.0',
    subtitle: 'Cloud-powered intelligence',
    performance: 92,
    privacy: 68,
    icon: CloudCog,
  },
  {
    id: 'ollama',
    title: 'Ollama 3.2',
    subtitle: 'Local inference engine',
    performance: 78,
    privacy: 92,
    icon: Terminal,
  },
  {
    id: 'hybrid',
    title: 'Hybrid Secure',
    subtitle: 'Balanced privacy + speed',
    performance: 84,
    privacy: 82,
    icon: ShieldAlert,
  },
];

const accentPresets = [
  { name: 'DevBlue', color: '#58a6ff' },
  { name: 'OpsEmerald', color: '#3fb950' },
  { name: 'CyberRose', color: '#f85149' },
  { name: 'SecurityGold', color: '#d29922' },
  { name: 'NightSlate', color: '#94a3b8' },
];

const automationSettings = [
  { key: 'autoSave', label: 'Auto-save workflows', subtitle: 'Save configuration changes automatically on success.' },
  { key: 'automation', label: 'Automated script hardening', subtitle: 'Apply security hardening to generated scripts.' },
  { key: 'notifications', label: 'Real-time alerts', subtitle: 'Get in-app notifications for policy and audit changes.' },
];

const securitySettings = [
  { key: 'secureMode', label: 'Hardened security mode', subtitle: 'Enforce strict execution policies for workflows.' },
  { key: 'debugMode', label: 'Debug mode', subtitle: 'Enable verbose diagnostics for advanced troubleshooting.' },
  { key: 'verboseLogs', label: 'Structured logs', subtitle: 'Store detailed logs for each automation run.' },
];

const ToggleSwitch = ({ label, subtitle, active, onToggle }) => (
  <div className="flex flex-col gap-3 rounded-3xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-5 transition hover:border-sky-500/40 hover:shadow-[0_8px_30px_rgba(56,189,248,0.12)]">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold text-black dark:text-white">{label}</p>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{subtitle}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-12 w-20 items-center rounded-full p-1 transition-colors ${
          active ? 'bg-sky-500/20 shadow-[0_0_0_4px_rgba(56,189,248,0.08)]' : 'bg-slate-200 dark:bg-slate-800/80 border border-black/10 dark:border-white/10'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="block h-10 w-10 rounded-full bg-white shadow-md"
          animate={{ x: active ? 36 : 0 }}
        />
      </button>
    </div>
    <div className="flex items-center justify-between text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
      <span className={active ? 'text-sky-300' : 'text-slate-500'}>On</span>
      <span className={!active ? 'text-rose-300' : 'text-slate-500'}>Off</span>
    </div>
  </div>
);

const StatusItem = ({ label, value, accent }) => (
  <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-5 py-4">
    <p className="text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-slate-500">{label}</p>
    <p className={`mt-3 text-lg font-black ${accent || 'text-black dark:text-white'}`}>{value}</p>
  </div>
);

const Settings = () => {
  const { theme, accent, settings, updateTheme, updateAccent, saveSettings } = useTheme();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [importError, setImportError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const handleSaveSettings = useCallback(() => {
    setLoading(true);
    setImportError('');
    saveSettings(settings);
    setTimeout(() => {
      setLoading(false);
      setToast('Settings saved successfully');
    }, 700);
  }, [settings, saveSettings]);

  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSaveSettings();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSaveSettings]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useCallback(
    (text) => (!debouncedSearch ? true : text.toLowerCase().includes(debouncedSearch)),
    [debouncedSearch]
  );

  const visibleThemeCards = themeCards.filter((item) => filtered(item.label) || filtered(item.description));
  const visibleEngineOptions = engineOptions.filter((item) => filtered(item.title) || filtered(item.subtitle));
  const visibleAutomationSettings = automationSettings.filter((item) => filtered(item.label) || filtered(item.subtitle));
  const visibleSecuritySettings = securitySettings.filter((item) => filtered(item.label) || filtered(item.subtitle));

  const setSetting = (key, value) => {
    if (key === 'theme') {
      updateTheme(value);
    } else if (key === 'accent') {
      updateAccent(value);
    } else {
      saveSettings({ [key]: value });
    }
  };

  const handleReset = () => {
    saveSettings(defaultSettings);
    setToast('Settings reset to defaults');
  };

  const handleExport = () => {
    const data = JSON.stringify(settings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unifix-settings.json';
    a.click();
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      const json = JSON.parse(text);
      saveSettings({ ...defaultSettings, ...json });
      setImportError('');
      setToast('Config imported successfully');
    } catch {
      setImportError('Invalid config file. Please upload a valid JSON export.');
    }
  };

  const activeEngine = engineOptions.find((item) => item.id === settings.aiModel) || engineOptions[0];

  return (
    <div className="space-y-8 pb-16 fade-in">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-4xl font-black text-black dark:text-bright tracking-tight">Settings</h1>
          <p className="text-slate-600 dark:text-muted text-lg mt-2">A modern control panel for UI, AI, automation, and security policies.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">Press <span className="font-semibold text-black dark:text-white">Ctrl/Cmd + S</span> to save</div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-3xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} /> {loading ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <main className="col-span-12 xl:col-span-8 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-6 shadow-[0_40px_120px_rgba(15,23,42,0.25)] backdrop-blur-xl"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-slate-500">Global control</p>
                <h2 className="text-2xl font-black text-black dark:text-white mt-2">Control panel overview</h2>
              </div>
              <div className="relative max-w-sm">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search settings..."
                  className="w-full rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-950/80 px-4 py-3 text-sm text-black dark:text-white outline-none focus:border-sky-500/40"
                />
                <Search className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-950/80 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.35)]"
          >
            <SectionHeader title="Appearance" description="Personalize the workspace aesthetic and accent tones." />
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {visibleThemeCards.length ? (
                visibleThemeCards.map((item) => (
                  <motion.button
                    key={item.id}
                    type="button"
                    whileHover={{ y: -3 }}
                    onClick={() => setSetting('theme', item.id)}
                    className={`group rounded-[28px] border p-5 text-left transition ${
                        theme === item.id
                        ? 'border-sky-500 bg-sky-500/10 shadow-[0_30px_100px_rgba(56,189,248,0.12)]'
                        : 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:border-slate-300/20 hover:bg-black/10 dark:hover:bg-white/10'
                    }`}
                  >
                    <div className={`h-36 rounded-3xl bg-gradient-to-br ${item.accent} shadow-inner`} />
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-black dark:text-white">{item.label}</h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{item.description}</p>
                      </div>
                      {theme === item.id && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
                          <CheckCircle2 size={14} /> Active
                        </span>
                      )}
                    </div>
                  </motion.button>
                ))
              ) : (
                <div className="col-span-full rounded-3xl border border-dashed border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
                  No matching appearance options found.
                </div>
              )}

              <motion.div whileHover={{ y: -3 }} className="rounded-[28px] border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-6 transition hover:border-sky-500/40 hover:shadow-[0_20px_60px_rgba(56,189,248,0.12)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-black dark:text-white">Accent color</h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Set the primary highlight color across the interface.</p>
                  </div>
                  <div className="h-12 w-12 rounded-3xl border border-black/10 dark:border-white/10" style={{ background: accent }} />
                </div>
                <div className="mt-6 grid gap-3">
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => setSetting('accent', e.target.value)}
                    className="h-14 w-full cursor-pointer rounded-3xl border border-black/10 dark:border-white/10 bg-slate-100 dark:bg-slate-900/80 p-1"
                  />
                  <div className="grid grid-cols-5 gap-3">
                    {accentPresets.map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setSetting('accent', preset.color)}
                        className={`h-12 w-full rounded-3xl border-2 transition ${
                          accent === preset.color ? 'border-black dark:border-white' : 'border-transparent hover:border-black/20 dark:hover:border-white/20'
                        }`}
                        style={{ background: preset.color }}
                        title={preset.name}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-950/80 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.35)]"
          >
            <SectionHeader title="AI Engine" description="Select the intelligence engine that matches your performance and privacy needs." />
            <div className="mt-8 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {visibleEngineOptions.length ? (
                  visibleEngineOptions.map((option) => {
                    const ActiveIcon = option.icon;
                    const active = settings.aiModel === option.id;
                    return (
                      <motion.button
                        key={option.id}
                        whileHover={{ y: -3 }}
                        type="button"
                        onClick={() => setSetting('aiModel', option.id)}
                        className={`group rounded-[28px] border p-5 text-left transition ${
                          active ? 'border-sky-500 bg-sky-500/10 shadow-[0_30px_100px_rgba(56,189,248,0.12)]' : 'border-white/10 bg-white/5 hover:border-slate-300/20 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="grid h-12 w-12 place-items-center rounded-3xl bg-slate-900/80 text-sky-300">
                              <ActiveIcon size={20} />
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-white">{option.title}</h3>
                              <p className="text-sm text-slate-400">{option.subtitle}</p>
                            </div>
                          </div>
                          {active && <CheckCircle2 size={18} className="text-sky-300" />}
                        </div>
                        <div className="mt-5 grid gap-3 rounded-3xl border border-white/10 bg-black/10 p-4">
                          <ProgressRow label="Performance" value={option.performance} accent="sky" />
                          <ProgressRow label="Privacy" value={option.privacy} accent="emerald" />
                        </div>
                      </motion.button>
                    );
                  })
                ) : (
                  <div className="col-span-full rounded-3xl border border-dashed border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
                    No matching engine options found.
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-black/10 dark:border-white/10 bg-white dark:bg-slate-950/80 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.35)]"
          >
            <SectionHeader title="Automation" description="Streamline routine tasks and keep your workspace in sync." />
            <div className="mt-8 grid gap-5">
              {visibleAutomationSettings.length ? (
                visibleAutomationSettings.map((item) => (
                  <ToggleSwitch
                    key={item.key}
                    label={item.label}
                    subtitle={item.subtitle}
                    active={settings[item.key]}
                    onToggle={() => setSetting(item.key, !settings[item.key])}
                  />
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-8 text-center text-sm text-slate-600 dark:text-slate-400">
                  No matching automation settings found.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-white/10 bg-slate-950/80 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.35)]"
          >
            <SectionHeader title="Security" description="Configure threat protection, secrets, and runtime safeguards." />
            <div className="mt-8 grid gap-5">
              {visibleSecuritySettings.length ? (
                visibleSecuritySettings.map((item) => (
                  <ToggleSwitch
                    key={item.key}
                    label={item.label}
                    subtitle={item.subtitle}
                    active={settings[item.key]}
                    onToggle={() => setSetting(item.key, !settings[item.key])}
                  />
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-sm text-slate-400">
                  No matching security settings found.
                </div>
              )}
            </div>
            <div className="mt-6 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={() => setAdvancedOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-3xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:border-sky-500/30 transition"
              >
                <ChevronDown className={`transition ${advancedOpen ? 'rotate-180' : ''}`} /> Advanced settings
              </button>
              <AnimatePresence initial={false}>
                {advancedOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-6 grid gap-4">
                      <ToggleSwitch
                        label="API keys manager"
                        subtitle="Enable secure key storage and usage controls."
                        active={settings.apiKeysEnabled}
                        onToggle={() => setSetting('apiKeysEnabled', !settings.apiKeysEnabled)}
                      />
                      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                        <p className="font-semibold text-white">Log retention</p>
                        <p className="mt-2 text-sm text-slate-400">Automatically archive logs after 30 days for compliance.</p>
                        <div className="mt-4 flex items-center gap-3">
                          <button className="rounded-3xl bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-200">Auto archive</button>
                          <button className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">Manual review</button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </main>

        <aside className="col-span-12 xl:col-span-4 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-white/10 bg-slate-950/80 p-6 shadow-[0_40px_120px_rgba(15,23,42,0.35)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">System status</p>
                <h2 className="text-2xl font-black text-white mt-2">Runtime insights</h2>
              </div>
              <div className="rounded-3xl bg-white/5 px-3 py-2 text-xs text-slate-200 uppercase tracking-[0.24em]">Live</div>
            </div>
            <div className="mt-6 grid gap-4">
              <StatusItem label="Active model" value={activeEngine.title} accent="text-sky-300" />
              <StatusItem label="Security mode" value={settings.secureMode ? 'Hardened' : 'Standard'} accent={settings.secureMode ? 'text-emerald-400' : 'text-slate-100'} />
              <StatusItem label="Last sync" value={new Date().toLocaleTimeString()} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-white/10 bg-slate-950/80 p-6 shadow-[0_40px_120px_rgba(15,23,42,0.35)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Quick actions</p>
                <h2 className="text-2xl font-black text-white mt-2">Control shortcuts</h2>
              </div>
              <Wand2 size={24} className="text-sky-300" />
            </div>
            <div className="mt-6 space-y-4">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex w-full items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-sky-500/30"
              >
                <span>Reset settings</span>
                <RefreshCcw size={18} />
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex w-full items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-sky-500/30"
              >
                <span>Export config</span>
                <Download size={18} />
              </button>
              <label className="inline-flex w-full cursor-pointer items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-sky-500/30">
                <span>Import config</span>
                <Upload size={18} />
                <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
              </label>
              {importError && <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{importError}</div>}
            </div>
          </motion.div>
        </aside>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 right-6 z-50 rounded-3xl border border-white/10 bg-slate-950/95 px-5 py-4 shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 text-sm text-slate-200">
              <CheckCircle2 className="text-emerald-400" size={18} />
              <span>{toast}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const themeCards = [
  { id: 'dark', label: 'Dark mode', description: 'Low-light cockpit for focus and resilience.', accent: 'from-slate-900 to-slate-800' },
  { id: 'light', label: 'Light mode', description: 'Bright interface for daytime monitoring.', accent: 'from-white to-slate-100' },
];

const SectionHeader = ({ title, description }) => (
  <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-5">
    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
      <SettingsIcon size={18} />
      <p className="text-sm uppercase tracking-[0.3em]">{title}</p>
    </div>
    <p className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-300">{description}</p>
  </div>
);

const ProgressRow = ({ label, value, accent }) => {
  const accentColor = accent === 'sky' ? '#38bdf8' : accent === 'emerald' ? '#34d399' : accent === 'fuchsia' ? '#f472b6' : '#94a3b8';
  return (
    <div>
      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: accentColor }} />
      </div>
    </div>
  );
};

export default Settings;
