import { motion } from 'framer-motion';
import { ArrowUpRight, BarChart3, Clock3, Cpu, Database, Shield, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Wand2, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { requestApi } from '../lib/api';

const initialTimeline = Array.from({ length: 12 }, (_, idx) => ({
  time: `${idx * 5}m`,
  value: 26 + Math.round(Math.sin(idx / 2) * 6 + idx * 1.5),
}));

const statusStyles = {
  Running: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
  Completed: "bg-sky-500/10 text-sky-300 border border-sky-500/20",
  Failed: "bg-rose-500/10 text-rose-300 border border-rose-500/20",
};

const StatCard = ({ title, value, icon, gradient, chartData, trendText, badge, badgeClass }) => {
  const { theme } = useTheme();
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.04 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-2xl p-[1px] bg-gradient-to-br from-white/10 via-white/5 to-transparent shadow-[0_40px_120px_rgba(15,23,42,0.25)] transition-transform duration-300 hover:shadow-[0_45px_140px_rgba(56,189,248,0.16)]"
    >
      <div className="absolute inset-0 rounded-2xl bg-white/5 backdrop-blur-lg" />
      <div className={`relative flex h-full flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-slate-950/70 p-8 shadow-inner shadow-black/10 ${theme === "light" ? "bg-white/70 border-black/10" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br ${gradient} text-white shadow-lg shadow-slate-950/40 transition duration-300 group-hover:scale-105`}>
          {icon}
        </div>
        {badge ? (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${badgeClass}`}>
            {badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-3">
        <p className={`text-sm font-medium uppercase tracking-[0.24em] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>{title}</p>
        <p className={`text-4xl font-semibold tracking-tight ${theme === "dark" ? "text-white" : "text-black"}`}>{value}</p>
      </div>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <span className="text-slate-400">{trendText}</span>
        </div>
        <div className="h-14 w-full rounded-2xl bg-slate-950/80 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`sparkline-${title.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.85)" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.35)" stopOpacity={0.35} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
                fill={`url(#sparkline-${title.replace(/\s+/g, "-")})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </motion.button>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [stats, setStats] = useState({ cpu: 34, memory: 58, storage: 67, uptime: 46, timestamp: null });
  const [timeline, setTimeline] = useState(initialTimeline);
  const [scriptCount, setScriptCount] = useState(0);

  const dataCards = useMemo(
    () => [
      {
        title: "CPU Usage",
        value: `${stats.cpu}%`,
        subtitle: "Live compute load",
        icon: <Cpu size={24} className="text-cyan-300" />,
        trend: "+8%",
        trendIcon: <TrendingUp size={16} className="text-emerald-300" />,
        series: timeline,
      },
      {
        title: "Memory",
        value: `${stats.memory}%`,
        subtitle: "Active RAM",
        icon: <Database size={24} className="text-violet-300" />,
        trend: "-4%",
        trendIcon: <TrendingDown size={16} className="text-rose-300" />,
        series: timeline.map((entry) => ({ ...entry, value: Math.max(12, Math.min(100, entry.value + 18)) })),
      },
      {
        title: "Storage",
        value: `${stats.storage}%`,
        subtitle: "Used capacity",
        icon: <BarChart3 size={24} className="text-amber-300" />,
        trend: "+3%",
        trendIcon: <TrendingUp size={16} className="text-emerald-300" />,
        series: timeline.map((entry) => ({ ...entry, value: Math.max(12, Math.min(100, entry.value + 24)) })),
      },
    ],
    [stats, timeline]
  );

  const statWidgets = [
    {
      title: "Saved Scripts",
      value: `${scriptCount}`,
      icon: <Wand2 size={20} />,
      gradient: "from-blue-500 to-cyan-400",
      chartData: [
        { value: Math.max(scriptCount - 2, 0) },
        { value: Math.max(scriptCount - 1, 0) },
        { value: scriptCount },
        { value: scriptCount },
        { value: scriptCount },
        { value: scriptCount },
      ],
      trendText: "Loaded from active workspace",
      badge: null,
      badgeClass: "bg-sky-500/15 text-sky-300",
    },
    {
      title: "CPU Load",
      value: `${stats.cpu}%`,
      icon: <Shield size={20} />,
      gradient: "from-emerald-500 to-lime-400",
      chartData: [
        { value: Math.max(stats.cpu - 8, 0) },
        { value: Math.max(stats.cpu - 4, 0) },
        { value: stats.cpu },
        { value: stats.cpu },
        { value: stats.cpu },
        { value: stats.cpu },
      ],
      trendText: "Live system metric",
      badge: "Live",
      badgeClass: "bg-emerald-500/15 text-emerald-300",
    },
    {
      title: "Memory",
      value: `${stats.memory}%`,
      icon: <Sparkles size={20} />,
      gradient: "from-violet-500 to-fuchsia-500",
      chartData: [
        { value: Math.max(stats.memory - 8, 0) },
        { value: Math.max(stats.memory - 4, 0) },
        { value: stats.memory },
        { value: stats.memory },
        { value: stats.memory },
        { value: stats.memory },
      ],
      trendText: "Active RAM usage",
      badge: null,
      badgeClass: "bg-violet-500/15 text-violet-300",
    },
    {
      title: "Uptime",
      value: `${stats.uptime}h`,
      icon: <Clock3 size={20} />,
      gradient: "from-fuchsia-500 to-pink-500",
      chartData: [
        { value: 42 },
        { value: 44 },
        { value: 46 },
        { value: 46 },
        { value: 46 },
        { value: 46 },
      ],
      trendText: "Stable",
      badge: null,
      badgeClass: "bg-pink-500/15 text-pink-300",
    },
  ];

  const telemetryData = [
    { name: "CPU", value: stats.cpu, fill: "#38bdf8" },
    { name: "Memory", value: stats.memory, fill: "#a855f7" },
    { name: "Storage", value: stats.storage, fill: "#f59e0b" },
  ];

  const workflowItems = [
    { id: 1, title: 'System stats API', status: stats.timestamp ? 'Completed' : 'Running', time: stats.timestamp ? new Date(stats.timestamp).toLocaleTimeString() : 'Awaiting data', icon: <Zap size={18} />, label: stats.timestamp ? 'Connected' : 'Loading' },
    { id: 2, title: 'Saved script inventory', status: 'Completed', time: `${scriptCount} file(s)`, icon: <ShieldCheck size={18} />, label: 'Indexed' },
    { id: 3, title: 'Storage telemetry', status: 'Completed', time: `${stats.storage}% used`, icon: <Database size={18} />, label: 'Live' },
    { id: 4, title: 'CPU observer', status: 'Completed', time: `${stats.cpu}% load`, icon: <Cpu size={18} />, label: 'Live' },
  ];

  const fetchScriptCount = async () => {
    try {
      if (window.electronAPI) {
        const scripts = await window.electronAPI.listScripts();
        setScriptCount(scripts.length);
        return;
      }

      const response = await requestApi({ method: 'get', url: '/scripts' });
      setScriptCount(Array.isArray(response.data) ? response.data.length : 0);
    } catch (error) {
      console.error('Unable to fetch script count:', error);
      setScriptCount(0);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await requestApi({ method: 'get', url: '/system/stats' });
      const payload = res.data;
      setStats({
        cpu: payload.cpu,
        memory: payload.memory,
        storage: payload.storage,
        uptime: payload.uptime,
        timestamp: payload.timestamp || null,
      });
      setTimeline((prev) => [...prev.slice(1), { time: `${prev.length * 5}m`, value: payload.cpu }]);
    } catch (error) {
      console.error('Unable to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchScriptCount();
    const timer = setInterval(fetchStats, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className={`min-h-screen ${theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-white text-black"}`}>
      <div className="relative overflow-hidden pb-16">
        <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.16),transparent_25%),radial-gradient(circle_at_80%_20%,rgba(168,85,247,0.14),transparent_20%)] pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-6 pt-10 lg:px-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`col-span-1 lg:col-span-8 relative overflow-hidden rounded-[2rem] border bg-slate-900/80 p-8 shadow-[0_60px_120px_rgba(15,23,42,0.55)] backdrop-blur-xl ${theme === "dark" ? "border-white/10" : "border-black/10 bg-white/80"}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br opacity-80 ${theme === "dark" ? "from-slate-950 via-slate-900 to-slate-950" : "from-white via-slate-50 to-white"}`} />
              <div className="absolute left-1/2 top-0 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-transparent blur-3xl" />
              <div className="relative space-y-8">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-3 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200 shadow-[0_20px_60px_rgba(52,211,153,0.12)]">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-300 animate-pulse shadow-[0_0_18px_rgba(52,211,153,0.35)]" />
                    Live operations stable
                  </div>
                  <div className="space-y-4">
                    <h1 className={`text-4xl font-semibold tracking-tight sm:text-5xl ${theme === "dark" ? "text-white" : "text-black"}`}>
                      A premium SaaS dashboard built for modern DevOps teams.
                    </h1>
                    <p className={`max-w-2xl text-lg leading-8 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                      Insightful system monitoring with elegant gradients, glassmorphism, animated micro-interactions, and a breathable dashboard structure.
                    </p>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => navigate('/ai-lab')}
                      className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-sky-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-sky-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl"
                    >
                      Launch Insights
                    </button>
                    <button
                      type="button"
                      onClick={fetchStats}
                      className={`inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-all duration-300 hover:bg-white/10 hover:border-slate-200/20 ${theme === "dark" ? "border-white/10 bg-white/5 text-slate-100" : "border-black/10 bg-black/5 text-black"}`}
                    >
                      Refresh metrics
                    </button>
                  </div>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                  {statWidgets.map((stat) => (
                    <StatCard
                      key={stat.title}
                      title={stat.title}
                      value={stat.value}
                      icon={stat.icon}
                      gradient={stat.gradient}
                      chartData={stat.chartData}
                      trendText={stat.trendText}
                      badge={stat.badge}
                      badgeClass={stat.badgeClass}
                    />
                  ))}
                </div>
              </div>
            </motion.section>

            <aside className="col-span-1 lg:col-span-4 grid gap-6">
              {dataCards.map((card) => (
                <motion.div
                  key={card.title}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`h-full overflow-hidden rounded-[2rem] border p-6 shadow-[0_30px_60px_rgba(15,23,42,0.18)] ${theme === "dark" ? "border-white/10 bg-slate-900/90" : "border-black/10 bg-white/90"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-3xl p-3 shadow-inner shadow-black/10 ${theme === "dark" ? "bg-white/5 text-white" : "bg-black/5 text-black"}`}>
                        {card.icon}
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>{card.title}</p>
                        <p className={`mt-2 text-3xl font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>{card.value}</p>
                      </div>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${theme === "dark" ? "bg-white/5 text-slate-200" : "bg-black/5 text-slate-800"}`}>
                      {card.trendIcon}
                      {card.trend}
                    </div>
                  </div>
                  <div className="mt-6 h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={card.series} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`spark-${card.title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffffff" stopOpacity={0.34} />
                            <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#fff" strokeWidth={2} fill={`url(#spark-${card.title.replace(/\s+/g, '-')})`} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className={`mt-5 text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>{card.subtitle}</p>
                </motion.div>
              ))}
            </aside>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="col-span-1 lg:col-span-8 flex flex-col gap-8"
            >
              <div className={`rounded-[2rem] border p-8 shadow-[0_40px_80px_rgba(15,23,42,0.25)] ${theme === "dark" ? "border-white/10 bg-slate-900/90" : "border-black/10 bg-white/90"}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className={`text-sm uppercase tracking-[0.24em] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Performance</p>
                    <h2 className={`mt-3 text-2xl font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>Resource utilization</h2>
                  </div>
                  <div className={`rounded-full px-4 py-2 text-sm ${theme === "dark" ? "bg-slate-950/80 text-slate-300" : "bg-slate-100/80 text-slate-700"}`}>Last 60 minutes</div>
                </div>
                <div className={`mt-8 h-[280px] rounded-[1.75rem] p-4 ${theme === "dark" ? "bg-slate-950/70" : "bg-slate-100/70"}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline} margin={{ top: 12, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="mainGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15,23,42,0.95)',
                          border: '1px solid rgba(148,163,184,0.16)',
                          borderRadius: '20px',
                          color: '#fff',
                          boxShadow: '0 20px 60px rgba(15,23,42,0.25)',
                        }}
                        labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#60a5fa" strokeWidth={3} fill="url(#mainGradient)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
                  className={`rounded-[2rem] border p-6 shadow-[0_30px_60px_rgba(15,23,42,0.18)] ${theme === "dark" ? "border-white/10 bg-slate-900/90" : "border-black/10 bg-white/90"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-slate-950/40">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4.172 4.172a4 4 0 105.656 5.656l4.172-4.172m0-5.656a4 4 0 015.656 0l4.172 4.172a4 4 0 01-5.656 5.656l-4.172-4.172" />
                      </svg>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-emerald-300">↑ 2.4%</p>
                    </div>
                  </div>
                  <p className={`mt-4 text-sm font-medium uppercase tracking-[0.2em] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Network</p>
                  <p className={`mt-3 text-3xl font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>1.2 GB</p>
                  <p className={`mt-2 text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Data transfer</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.15, ease: 'easeOut' }}
                  className={`rounded-[2rem] border p-6 shadow-[0_30px_60px_rgba(15,23,42,0.18)] ${theme === "dark" ? "border-white/10 bg-slate-900/90" : "border-black/10 bg-white/90"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-slate-950/40">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-emerald-300">↑ 1.8%</p>
                    </div>
                  </div>
                  <p className={`mt-4 text-sm font-medium uppercase tracking-[0.2em] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Disk I/O</p>
                  <p className={`mt-3 text-3xl font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>245 MB/s</p>
                  <p className={`mt-2 text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Read/Write speed</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2, ease: 'easeOut' }}
                  className={`rounded-[2rem] border p-6 shadow-[0_30px_60px_rgba(15,23,42,0.18)] ${theme === "dark" ? "border-white/10 bg-slate-900/90" : "border-black/10 bg-white/90"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-500 to-lime-400 text-white shadow-lg shadow-slate-950/40">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-emerald-300">↑ 5.2%</p>
                    </div>
                  </div>
                  <p className={`mt-4 text-sm font-medium uppercase tracking-[0.2em] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>API Requests</p>
                  <p className={`mt-3 text-3xl font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>28.4K</p>
                  <p className={`mt-2 text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Per minute</p>
                </motion.div>
              </div>
            </motion.section>

            <aside className="col-span-1 lg:col-span-4 grid gap-6">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                className={`h-full overflow-hidden rounded-[2rem] p-6 shadow-2xl ${theme === "dark" ? "bg-gradient-to-br from-slate-900 via-blue-950 to-violet-950 shadow-violet-500/20" : "bg-gradient-to-br from-white via-blue-50 to-violet-50 shadow-violet-500/10"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-sm uppercase tracking-[0.22em] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>AI Quick Tip</p>
                    <h3 className={`mt-4 text-2xl font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>Harden scripts with AI</h3>
                  </div>
                  <div className={`flex h-14 w-14 items-center justify-center rounded-3xl shadow-lg ${theme === "dark" ? "bg-white/10 text-slate-100 shadow-slate-950/20" : "bg-black/10 text-slate-900 shadow-slate-50/20"}`}>
                    <Wand2 size={24} />
                  </div>
                </div>
                <p className={`mt-6 leading-7 ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}>
                  Use the AI Lab to generate smarter scripts, review injection patterns, and keep your automation secure with modern guardrails.
                </p>
                <button
                  onClick={() => navigate('/ai-lab')}
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 ${theme === "dark" ? "bg-white/10 text-white hover:bg-white/15" : "bg-black/10 text-black hover:bg-black/15"}`}
                >
                  Explore AI Lab
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
                className={`h-full overflow-hidden rounded-[2rem] border p-6 shadow-[0_30px_70px_rgba(15,23,42,0.2)] ${theme === "dark" ? "border-white/10 bg-slate-900/90" : "border-black/10 bg-white/90"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className={`text-sm uppercase tracking-[0.22em] ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>Hardware Telemetry</p>
                    <h3 className={`mt-3 text-xl font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>System health</h3>
                  </div>
                  <div className={`rounded-3xl px-4 py-2 text-xs uppercase tracking-[0.2em] ${theme === "dark" ? "bg-slate-950/80 text-slate-300" : "bg-slate-100/80 text-slate-700"}`}>Live</div>
                </div>
                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="30%" outerRadius="90%" data={telemetryData} startAngle={180} endAngle={-180}>
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15,23,42,0.95)',
                          border: '1px solid rgba(148,163,184,0.16)',
                          borderRadius: '16px',
                          color: '#fff',
                        }}
                        labelStyle={{ color: '#94a3b8' }}
                      />
                      <RadialBar minAngle={15} background clockWise dataKey="value" cornerRadius={12} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div className={`mt-6 space-y-4 text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-600"}`}>
                  {telemetryData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-4">
                      <span>{item.name}</span>
                      <span className={`font-semibold ${theme === "dark" ? "text-white" : "text-black"}`}>{item.value}%</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </aside>
          </div>

          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
            className="mt-8 rounded-[2rem] border border-white/10 bg-slate-900/90 p-8 shadow-[0_40px_80px_rgba(15,23,42,0.2)]"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Active workflows</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Workflow operations</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/repo')}
                className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-slate-100 transition-all duration-300 hover:bg-white/10"
              >
                View all workflows
              </button>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {workflowItems.map((item) => (
                <motion.button
                  key={item.id}
                  type="button"
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => navigate('/audit')}
                  className="group h-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/80 p-5 text-left shadow-[0_24px_60px_rgba(15,23,42,0.18)] transition-all duration-300 hover:border-slate-300/20 hover:bg-slate-900/95"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-900/80 text-cyan-300 shadow-lg shadow-cyan-500/10">
                        {item.icon}
                      </span>
                      <div>
                        <p className="text-lg font-semibold text-white">{item.title}</p>
                        <p className="mt-2 text-sm text-slate-400">{item.label}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${statusStyles[item.status]}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
                    <span>{item.time}</span>
                    <ArrowUpRight className="text-slate-400 transition-colors group-hover:text-sky-300" />
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;
