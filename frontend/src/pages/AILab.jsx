import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, ChevronRight, Clock, Cpu, Download, Eye, EyeOff, Pause, Play, RefreshCw, Shield, Sparkles, Terminal, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getSocketBaseUrl, requestApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import AppTerminal from '../components/AppTerminal';

const AILab = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [plan, setPlan] = useState([]);
  const [executionStatus, setExecutionStatus] = useState('idle');
  const [executionError, setExecutionError] = useState(null);
  const [showDryRun, setShowDryRun] = useState(false);
  const [savedArtifact, setSavedArtifact] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [safety, setSafety] = useState(null);
  const [intent, setIntent] = useState(null);
  const [streamEvents, setStreamEvents] = useState([]);
  const [approvalState, setApprovalState] = useState('idle');
  const [recoveryPlan, setRecoveryPlan] = useState(null);
  const [retryMode, setRetryMode] = useState('plan');
  const [dashboardSessions, setDashboardSessions] = useState([]);
  const [terminalSessions, setTerminalSessions] = useState([]);
  const [webTerminalSession, setWebTerminalSession] = useState(null);
  const [webTerminalStatus, setWebTerminalStatus] = useState('idle');
  const [webTerminalError, setWebTerminalError] = useState('');
  const [terminalStreamEvents, setTerminalStreamEvents] = useState([]);
  const [useElevated, setUseElevated] = useState(false);
  const socketRef = useRef(null);

  const parseDependencyBlock = useCallback((message = '') => {
    const text = String(message || '');
    if (!/brew uninstall blocked|Homebrew blocked uninstall/i.test(text)) return null;
    const dependents = [...text.matchAll(/DEPENDENT:\s*([^\s,]+)/g)].map((match) => match[1]).filter(Boolean);
    const formulaMatch = text.match(/uninstall for\s+([a-z0-9@+._-]+)/i) || text.match(/Refusing to uninstall .*?\/([a-z0-9@+._-]+)\/?/i);
    return {
      formula: formulaMatch?.[1] || null,
      dependents,
      message: text,
    };
  }, []);

  useEffect(() => {
    const savedHistory = localStorage.getItem('unifix_ai_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  const addToHistory = (text) => {
    const newItem = { id: Date.now(), text, time: new Date().toLocaleString() };
    const newHistory = [newItem, ...history].slice(0, 8);
    setHistory(newHistory);
    localStorage.setItem('unifix_ai_history', JSON.stringify(newHistory));
  };

  const fetchDashboardSessions = useCallback(async () => {
    try {
      const res = await requestApi({ method: 'get', url: '/ai/sessions' });
      setDashboardSessions(res.data.sessions || []);
    } catch (error) {
      console.error('Failed to load session dashboard', error);
    }
  }, []);

  const refreshTerminalSessions = useCallback(() => {
    socketRef.current?.emit('terminal:list', {}, (response) => {
      if (response?.success) {
        setTerminalSessions(response.sessions || []);
      }
    });
  }, []);

  const mapSessionStatus = (status = 'idle') => {
    if (status === 'awaiting_approval') return 'ready';
    if (status === 'awaiting_recovery_approval') return 'paused';
    if (status === 'completed') return 'success';
    return status;
  };

  const applySessionUpdate = useCallback((session) => {
      if (!session) return;
      setSessionData(session);
      const mappedStatus = mapSessionStatus(session.status);
      const failureMessage = session.lastFailure?.result?.stderr || session.lastFailure?.result?.stdout || '';
      const dependencyBlock = session.status === 'failed' ? parseDependencyBlock(failureMessage) : null;
      setExecutionStatus(dependencyBlock ? 'blocked' : mappedStatus);
      setPreview(session.preview || preview);
      setPlan(session.plan?.steps || []);
      setStreamEvents(session.executionLog || []);
      if (session.status === 'awaiting_recovery_approval') {
        setRecoveryPlan(session.recoveryPlan || null);
        setApprovalState('recovery');
      }
      if (session.status === 'awaiting_approval') {
        setApprovalState('pending');
      }
      setRetryMode(session.retryMode || 'plan');
      if (session.status === 'failed' && session.lastFailure) {
        setExecutionError(session.lastFailure.result?.stderr || session.lastFailure.result?.stdout || 'Execution failed');
      }
      if (session.status === 'completed' || session.status === 'failed' || session.status === 'rejected' || session.status === 'cancelled') {
        socketRef.current?.emit('ai:unsubscribe', { sessionId: session.id });
      }
  }, [preview]);

  useEffect(() => {
    const token = localStorage.getItem('unifix_token');
    if (!token) return undefined;

    const socket = io(getSocketBaseUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      refreshTerminalSessions();
      fetchDashboardSessions();
      if (sessionId) {
        socket.emit('ai:subscribe', { sessionId });
      }
    });

    socket.on('ai:session_snapshot', ({ session }) => {
      applySessionUpdate(session);
      fetchDashboardSessions();
    });

    socket.on('ai:session_event', ({ type, session, event }) => {
      if (type === 'session_log' && event) {
        setSessionData((prev) => {
          const base = session || prev;
          if (!base) return prev;
          const merged = {
            ...base,
            executionLog: session?.executionLog || [...(prev?.executionLog || []), event],
          };
          applySessionUpdate(merged);
          return merged;
        });
      } else if (session) {
        applySessionUpdate(session);
      }
      fetchDashboardSessions();
    });

    socket.on('terminal:data', ({ sessionId: incomingId, data }) => {
      if (incomingId !== webTerminalSession?.id) return;
      setTerminalStreamEvents((prev) => [...prev, { type: 'stdout', level: 'info', data }]);
    });

    socket.on('terminal:exit', ({ sessionId: incomingId, exitCode, signal }) => {
      if (incomingId !== webTerminalSession?.id) return;
      setTerminalStreamEvents((prev) => [...prev, { type: 'log', level: exitCode === 0 ? 'success' : 'error', data: `Terminal exited with code ${exitCode ?? 'unknown'}${signal ? ` (signal ${signal})` : ''}` }]);
      setWebTerminalStatus(exitCode === 0 ? 'completed' : 'failed');
      setWebTerminalSession(null);
      refreshTerminalSessions();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [applySessionUpdate, fetchDashboardSessions, refreshTerminalSessions, sessionId, webTerminalSession?.id]);

  const resetExecutionView = useCallback(() => {
    setPlan([]);
    setExecutionError(null);
    setSavedArtifact(null);
    setSessionId('');
    setSessionData(null);
    setPreview(null);
    setSafety(null);
    setIntent(null);
    setRecoveryPlan(null);
    setStreamEvents([]);
    setApprovalState('idle');
    setTerminalStreamEvents([]);
  }, []);

  const generatePlanForPrompt = useCallback(async (nextPrompt) => {
    if (!nextPrompt.trim()) return;
    setLoading(true);
    setExecutionStatus('generating');
    resetExecutionView();

    try {
      const res = await requestApi({ method: 'post', url: '/ai/plan-execution', data: { prompt: nextPrompt, systemContext: user?.systemContext } });
      if (res.data.success) {
        setPlan(res.data.plan?.steps || []);
        setPreview(res.data.preview);
        setSafety(res.data.safety);
        setIntent(res.data.intent);
        setSessionId(res.data.sessionId);
        setSavedArtifact(res.data.artifact?.savedArtifact || null);
        setExecutionStatus('ready');
        setApprovalState('pending');
        addToHistory(nextPrompt);
        fetchDashboardSessions();
      } else {
        setExecutionStatus('failed');
        setExecutionError(res.data.error || 'Plan generation failed');
      }
    } catch (error) {
      const errorDetail = error.response?.data?.error || error.message || 'Unknown network error';
      setExecutionStatus('failed');
      setExecutionError(`Engine Error: ${errorDetail}`);
    } finally {
      setLoading(false);
    }
  }, [fetchDashboardSessions, resetExecutionView]);

  const handleGeneratePlan = async () => {
    await generatePlanForPrompt(prompt);
  };


  const approveExecution = async (recovery = false) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await requestApi({ method: 'post', url: '/ai/approve-execution', data: { sessionId, approved: true, elevated: useElevated } });
      setSessionData(res.data.session || null);
      setExecutionStatus(res.data.success ? 'running' : 'failed');
      setApprovalState(recovery ? 'recovery-approved' : 'approved');
      socketRef.current?.emit('ai:subscribe', { sessionId });
    } catch (error) {
      setExecutionError(error?.response?.data?.error || error.message);
      setExecutionStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const rejectExecution = () => {
    setApprovalState('rejected');
    setExecutionStatus('idle');
    socketRef.current?.emit('ai:unsubscribe', { sessionId });
  };

  const cancelExecution = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await requestApi({ method: 'post', url: '/ai/cancel-execution', data: { sessionId } });
      setSessionData(res.data.session || null);
      setExecutionStatus('cancelled');
      setApprovalState('cancelled');
      fetchDashboardSessions();
    } catch (error) {
      setExecutionError(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const requestRecovery = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await requestApi({ method: 'post', url: '/ai/recover-execution', data: { sessionId } });
      setRecoveryPlan(res.data.recoveryPlan);
      setSafety(res.data.safety);
      setApprovalState('recovery');
      setExecutionStatus('paused');
      socketRef.current?.emit('ai:subscribe', { sessionId });
    } catch (error) {
      setExecutionError(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  };

  const retryExecution = async (mode = 'plan', options = {}) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await requestApi({ method: 'post', url: '/ai/retry-execution', data: { sessionId, mode, forceBrewUninstall: Boolean(options.forceBrewUninstall) } });
      setSessionData(res.data.session || null);
      setPlan(res.data.plan?.steps || []);
      setPreview(res.data.preview || null);
      setApprovalState('pending');
      setExecutionStatus('ready');
      setExecutionError(null);
      setStreamEvents([]);
      setRetryMode(mode);
      socketRef.current?.emit('ai:subscribe', { sessionId });
    } catch (error) {
      setExecutionError(error?.response?.data?.error || error.message);
      setExecutionStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const dependencyBlock = useMemo(() => parseDependencyBlock(executionError), [executionError, parseDependencyBlock]);

  useEffect(() => {
    if (dependencyBlock && executionStatus === 'running') {
      setExecutionStatus('blocked');
    }
  }, [dependencyBlock, executionStatus]);

  const handleUninstallDependentFirst = useCallback(async () => {
    const dependent = dependencyBlock?.dependents?.[0];
    if (!dependent) return;
    const nextPrompt = `uninstall ${dependent}`;
    setPrompt(nextPrompt);
    await generatePlanForPrompt(nextPrompt);
  }, [dependencyBlock, generatePlanForPrompt]);

  const handleForceUninstall = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      await requestApi({ method: 'post', url: '/ai/retry-execution', data: { sessionId, mode: 'plan', forceBrewUninstall: true } });
      const approveRes = await requestApi({
        method: 'post',
        url: '/ai/approve-execution',
        data: { sessionId, approved: true, elevated: useElevated, forceBrewUninstall: true },
      });
      setSessionData(approveRes.data.session || null);
      setExecutionStatus(approveRes.data.success ? 'running' : 'failed');
      setApprovalState('approved');
      setExecutionError(null);
      socketRef.current?.emit('ai:subscribe', { sessionId });
    } catch (error) {
      setExecutionError(error?.response?.data?.error || error.message);
      setExecutionStatus('failed');
    } finally {
      setLoading(false);
    }
  }, [sessionId, useElevated]);

  const createWebTerminalSession = () => {
    setWebTerminalError('');
    setTerminalStreamEvents([]);
    setWebTerminalStatus('starting');
    socketRef.current?.emit('terminal:create', { cwd: user?.systemContext?.homeDir || undefined }, (response) => {
      if (!response?.success) {
        setWebTerminalStatus('error');
        setWebTerminalError(response?.error || 'Failed to create web terminal session');
        return;
      }
      setWebTerminalSession(response.session);
      setWebTerminalStatus('running');
      refreshTerminalSessions();
    });
  };

  const stopWebTerminalSession = () => {
    if (!webTerminalSession?.id) return;
    socketRef.current?.emit('terminal:stop', { sessionId: webTerminalSession.id }, () => {
      setWebTerminalStatus('stopped');
      setWebTerminalSession(null);
      refreshTerminalSessions();
    });
  };

  const sendWebTerminalInput = (input) => {
    if (!webTerminalSession?.id) return;
    socketRef.current?.emit('terminal:input', { sessionId: webTerminalSession.id, input });
  };

  const resizeWebTerminal = ({ cols, rows }) => {
    if (!webTerminalSession?.id) return;
    socketRef.current?.emit('terminal:resize', { sessionId: webTerminalSession.id, cols, rows });
  };

  const currentStepIndex = useMemo(() => {
    if (!sessionData?.executionLog?.length || !plan.length) return -1;
    const latestStarted = [...sessionData.executionLog].reverse().find((entry) => entry.type === 'step_started');
    if (!latestStarted) return -1;
    return plan.findIndex((step) => step.id === latestStarted.stepId);
  }, [sessionData, plan]);

  const stepLogs = useMemo(() => {
    const output = {};
    if (!sessionData?.executionLog) return output;

    sessionData.executionLog.forEach((entry) => {
      if (entry.type === 'step_started') {
        const idx = plan.findIndex((step) => step.id === entry.stepId);
        if (idx >= 0) output[idx] = { status: 'running', title: entry.title };
      }
      if (entry.type === 'step_finished') {
        const idx = plan.findIndex((step) => step.id === entry.stepId);
        if (idx >= 0) {
          output[idx] = {
            status: entry.success ? 'success' : 'failed',
            output: entry.stdout,
            error: entry.stderr,
          };
        }
      }
    });

    return output;
  }, [sessionData, plan]);

  const promptSuggestions = [
    { icon: '🚀', text: 'MERN Stack Dashboard', prompt: 'Create a professional MERN stack dashboard with Vite and Express in separate folders.' },
    { icon: '🐹', text: 'Go API Service', prompt: 'Install Go and setup a REST API using the Gin framework.' },
    { icon: '🐍', text: 'Python Data Tool', prompt: 'Setup a Python environment and install pandas, requests, and beautifulsoup4.' },
    { icon: '🚢', text: 'Dockerize Project', prompt: 'Write a Dockerfile and docker-compose.yml for an existing local node application.' },
  ];

  const primaryTerminalVisible = Boolean(preview || streamEvents.length > 0);
  const showWebTerminal = !primaryTerminalVisible;
  const adminRecommended = useMemo(() => {
    const warningText = [
      ...(safety?.warnings || []),
      preview?.description || '',
      intent?.description || '',
    ].join(' ').toLowerCase();
    return ['sudo', 'admin', 'administrator', 'root', 'privilege'].some((keyword) => warningText.includes(keyword));
  }, [intent?.description, preview?.description, safety?.warnings]);

  useEffect(() => {
    if (adminRecommended) {
      setUseElevated(true);
    }
  }, [adminRecommended]);

  return (
    <main className="min-h-screen bg-[#020617] text-slate-100 selection:bg-sky-500/30 font-sans relative overflow-hidden">
      {/* Animated Abstract Background Shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-sky-500/10 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], rotate: [0, -90, 0], opacity: [0.1, 0.15, 0.1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-violet-600/10 blur-[150px]"
        />
        <motion.div
          animate={{ y: [0, -50, 0], opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 left-[20%] w-[40vw] h-[40vw] rounded-full bg-emerald-500/10 blur-[100px]"
        />
      </div>

      <div className="relative pb-24 z-10">
        <div className="absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(circle_at_50%_-10%,rgba(56,189,248,0.15),transparent_70%),radial-gradient(circle_at_80%_20%,rgba(139,92,246,0.08),transparent_50%)] pointer-events-none" />
        
        <div className="relative mx-auto max-w-7xl px-8 pt-12 lg:px-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 flex items-end justify-between"
          >
            <div>
              <div className="flex items-center gap-3 text-sky-400 mb-3">
                <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                  <Cpu size={18} />
                </div>
                <motion.span 
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-[11px] font-black uppercase tracking-[0.3em] text-sky-400/80"
                >
                  Deterministic Engine V4
                </motion.span>
              </div>
              <motion.h1 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-6xl font-extrabold tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
              >
                AI Control <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-violet-400 to-fuchsia-400 animate-gradient-x">Lab</span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-4 text-xl text-slate-300/80 font-medium tracking-tight"
              >
                Atomic execution pipeline with zero-hallucination safeguards
              </motion.p>
            </div>
            
              <div className={`flex items-center gap-4 rounded-2xl border px-6 py-3 transition-all duration-700 backdrop-blur-md shadow-2xl ${
                executionStatus === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 shadow-emerald-500/10' :
                executionStatus === 'failed' ? 'border-red-500/30 bg-red-500/10 shadow-red-500/10' :
                'border-white/10 bg-white/5 shadow-black/20'
              }`}>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Engine Status</span>
                  <span className={`text-xs font-bold uppercase tracking-widest ${
                    executionStatus === 'success' ? 'text-emerald-400' :
                    executionStatus === 'failed' ? 'text-red-400' :
                    executionStatus === 'running' ? 'text-sky-400' :
                    'text-slate-300'
                  }`}>
                    {executionStatus === 'idle' ? 'Ready' : executionStatus}
                  </span>
                </div>
                <div className={`h-10 w-[1px] ${executionStatus === 'idle' ? 'bg-white/10' : 'bg-current opacity-20'}`} />
                <div className={`relative flex h-3 w-3 items-center justify-center`}>
                  <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
                    executionStatus === 'running' ? 'bg-sky-400' : 
                    executionStatus === 'success' ? 'bg-emerald-400' : 
                    executionStatus === 'failed' ? 'bg-red-400' : 
                    'hidden'
                  }`} />
                  <div className={`h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor] ${
                    executionStatus === 'running' ? 'bg-sky-400 shadow-sky-400/50' : 
                    executionStatus === 'success' ? 'bg-emerald-400 shadow-emerald-400/50' : 
                    executionStatus === 'failed' ? 'bg-red-400 shadow-red-400/50' : 
                    'bg-slate-600'
                  }`} />
                </div>
              </div>
            </motion.div>

            {/* Error Message Display */}
            <AnimatePresence>
              {executionError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-8"
                >
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3 backdrop-blur-md">
                    <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-red-300 mb-1">Engine System Error</h4>
                      <p className="text-sm text-red-200/80 font-medium">{executionError}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Artifact Recovery / Saved Info */}
            <AnimatePresence>
              {savedArtifact && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-8"
                >
                  <div className="rounded-2xl border border-sky-400/20 bg-sky-400/5 p-4 flex items-center justify-between backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                        <Download size={16} />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-sky-400/70 mb-0.5">Persistence Tier</h4>
                        <p className="text-xs text-slate-300 font-bold">Artifact Generated: <span className="text-sky-300">{savedArtifact}</span></p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/repo')}
                      className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                    >
                      <Eye size={14} className="text-slate-400 group-hover:text-white" />
                      <span className="text-xs font-bold text-slate-300 group-hover:text-white">View in Repository</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            {/* Input & Runner Section */}
            <div className="lg:col-span-8 space-y-10">
              {/* Premium Input Container */}
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, type: "spring", bounce: 0.4 }}
                className="group relative z-20"
              >
                <motion.div 
                  animate={{ 
                    background: [
                      "linear-gradient(to right, rgba(56,189,248,0.3), rgba(139,92,246,0.3))", 
                      "linear-gradient(to right, rgba(139,92,246,0.3), rgba(236,72,153,0.3))",
                      "linear-gradient(to right, rgba(56,189,248,0.3), rgba(139,92,246,0.3))"
                    ] 
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute -inset-1 rounded-[34px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-700" 
                />
                <div className="relative rounded-[32px] border border-white/20 bg-[#0f172a]/90 p-1.5 backdrop-blur-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                  <div className="rounded-[28px] bg-slate-900/60 p-8 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div className="flex items-start gap-6">
                      <motion.div 
                        whileHover={{ rotate: 180, scale: 1.1 }}
                        transition={{ duration: 0.5, type: "spring" }}
                        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-500 to-violet-600 shadow-[0_0_30px_rgba(56,189,248,0.4)] text-white relative overflow-hidden"
                      >
                        <div className="absolute inset-0 bg-white/20 blur-md transform -skew-x-12 translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
                        <Sparkles size={32} className="relative z-10" />
                      </motion.div>
                      <div className="flex-1">
                        <textarea
                          value={prompt}
                          onChange={(e) => setPrompt(e.target.value)}
                          placeholder="What would you like to build today?"
                          className="w-full resize-none border-none bg-transparent pt-2 text-xl font-medium text-slate-100 placeholder-slate-600 outline-none focus:ring-0"
                          rows={3}
                          disabled={executionStatus === 'running' || executionStatus === 'generating'}
                        />
                        <div className="mt-8 flex items-center justify-between">
                          <div className="flex gap-3">
                            {[
                              (() => {
                                const os = user?.systemContext?.os;
                                if (os === 'win32' || os === 'windows') return 'Windows';
                                if (os === 'darwin' || os === 'macos') return 'macOS';
                                if (os === 'linux') return 'Linux';
                                return os || 'macOS';
                              })(), 
                              user?.systemContext?.arch || 'ARM64', 
                              user?.systemContext?.packageManagers?.[0] || 'brew'
                            ].map(tag => (
                              <span key={tag} className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] border border-white/5 bg-white/5 px-2.5 py-1.5 rounded-lg">{tag}</span>
                            ))}
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleGeneratePlan}
                            disabled={loading || !prompt.trim() || executionStatus === 'running'}
                            className="flex items-center gap-3 rounded-xl bg-sky-500 px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-sky-500/20 transition-all hover:bg-sky-400 disabled:opacity-30"
                          >
                            {executionStatus === 'generating' ? <RefreshCw className="animate-spin" size={18} /> : <Terminal size={18} />}
                            Generate Plan
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {!plan.length && (
                <div className="grid grid-cols-2 gap-5">
                  {promptSuggestions.map((s, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 + 0.3, duration: 0.5 }}
                      whileHover={{ 
                        y: -8, 
                        scale: 1.02,
                        boxShadow: "0 20px 40px -10px rgba(56, 189, 248, 0.2)",
                        borderColor: "rgba(56, 189, 248, 0.5)",
                        backgroundColor: "rgba(15, 23, 42, 0.9)"
                      }}
                      onClick={() => setPrompt(s.prompt)}
                      className="relative overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 p-8 text-left transition-all backdrop-blur-xl group"
                    >
                      <div className="absolute top-0 right-0 p-32 bg-sky-500/5 rounded-full blur-[50px] group-hover:bg-sky-500/20 transition-colors duration-700" />
                      <div className="relative z-10 flex items-center justify-between mb-5">
                        <span className="text-4xl filter grayscale-[50%] group-hover:grayscale-0 group-hover:scale-110 transition-all duration-500">{s.icon}</span>
                        <motion.div whileHover={{ x: 5 }}>
                          <ChevronRight className="text-slate-600 group-hover:text-sky-400 transition-colors" size={20} />
                        </motion.div>
                      </div>
                      <h4 className="relative z-10 text-sm font-black text-white mb-3 uppercase tracking-widest group-hover:text-sky-300 transition-colors">{s.text}</h4>
                      <p className="relative z-10 text-xs text-slate-400 line-clamp-2 leading-relaxed font-medium">{s.prompt}</p>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Execution Pipeline */}
              <AnimatePresence>
                {plan.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap items-center gap-4">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.8)]" />
                          Instruction Pipeline
                        </h3>
                        <button 
                          onClick={() => setShowDryRun(!showDryRun)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all ${
                            showDryRun ? 'bg-sky-500/20 border-sky-500/40 text-sky-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {showDryRun ? <EyeOff size={12} /> : <Eye size={12} />}
                          {showDryRun ? 'Hide Mappings' : 'Show Mappings'}
                        </button>
                      </div>
                      <div className="flex flex-col gap-3 lg:items-end">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => setUseElevated((prev) => !prev)}
                            disabled={loading || executionStatus === 'running'}
                            title="Request admin-aware execution review for commands that may need elevated privileges"
                            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40 ${
                              useElevated
                                ? 'border-amber-500/50 bg-amber-500/15 text-amber-200 shadow-lg shadow-amber-500/10'
                                : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                            }`}
                          >
                            <Shield size={14} />
                            {useElevated ? 'Admin On' : 'Admin Off'}
                          </button>
                          {adminRecommended && !useElevated ? (
                            <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                              Admin Recommended
                            </span>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-3">
                        {approvalState === 'pending' ? (
                          <>
                            <button onClick={() => approveExecution(false)} disabled={loading} className="flex min-w-[220px] items-center justify-center gap-2 rounded-xl bg-sky-500 px-7 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-sky-500/20 hover:bg-sky-400 disabled:opacity-30 transition-all">
                              <Play size={14} /> Approve & Execute
                            </button>
                            <button onClick={rejectExecution} className="flex min-w-[140px] items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-rose-300 hover:bg-rose-500/20 transition-all">
                              <Pause size={14} /> Reject
                            </button>
                          </>
                        ) : approvalState === 'recovery' ? (
                          <div className="flex flex-wrap gap-3">
                            <button onClick={() => approveExecution(true)} disabled={loading} className="flex min-w-[220px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-7 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-30 transition-all">
                              <RefreshCw size={14} /> Approve Recovery
                            </button>
                            <button onClick={() => retryExecution('plan')} disabled={loading} className="flex min-w-[170px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-all">
                              <Play size={14} /> Retry Original
                            </button>
                          </div>
                        ) : executionStatus === 'failed' ? (
                          <div className="flex flex-wrap gap-3">
                            <button onClick={requestRecovery} disabled={loading || !sessionId} className="flex min-w-[220px] items-center justify-center gap-2 rounded-xl bg-rose-500 px-7 py-3 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-rose-500/20 hover:bg-rose-400 disabled:opacity-30 transition-all">
                              <RefreshCw size={14} /> Generate Recovery
                            </button>
                            <button onClick={() => retryExecution('plan')} disabled={loading || !sessionId} className="flex min-w-[170px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-300 hover:bg-white/10 transition-all">
                              <Play size={14} /> Retry Plan
                            </button>
                          </div>
                        ) : executionStatus === 'running' ? (
                          <button onClick={cancelExecution} disabled={loading || !sessionId} className="flex min-w-[180px] items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-rose-300 hover:bg-rose-500/20 transition-all">
                            <Pause size={14} /> Cancel Session
                          </button>
                        ) : (
                          <button disabled className="flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-slate-700 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-300 opacity-60 transition-all">
                            <Play size={14} /> {executionStatus === 'success' ? 'Completed' : executionStatus === 'cancelled' ? 'Cancelled' : 'Preview Ready'}
                          </button>
                        )}
                        </div>
                      </div>
                    </div>

                    {preview ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Intent</span>
                          <span className="rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-sky-300">{intent?.type || 'unknown'}</span>
                          <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${
                            preview.riskLevel === 'high' ? 'border-red-500/30 bg-red-500/10 text-red-300' :
                            preview.riskLevel === 'medium' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' :
                            'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          }`}>{preview.riskLevel} risk</span>
                          <span className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">{preview.requiresApproval ? 'Approval Required' : 'Auto Approved'}</span>
                          <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${useElevated ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-white/10 bg-black/20 text-slate-400'}`}>{useElevated ? 'Admin On' : 'Admin Off'}</span>
                          {sessionData?.retryCount ? (
                            <span className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-violet-300">Retry #{sessionData.retryCount} ({retryMode})</span>
                          ) : null}
                        </div>
                        <p className="text-sm text-slate-300 mb-4">{preview.description}</p>
                        {preview.affectedPaths?.length ? (
                          <div className="mb-4">
                            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                              <Shield size={12} /> Affected Paths
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {preview.affectedPaths.map((entry) => (
                                <span key={entry} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[11px] font-mono text-slate-300">{entry}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {safety?.warnings?.length ? (
                          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                            {safety.warnings.join(' | ')}
                          </div>
                        ) : null}
                        {recoveryPlan ? (
                          <div className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300 mb-2">Recovery Plan</div>
                            <div className="text-sm text-rose-100">{recoveryPlan.description}</div>
                          </div>
                        ) : null}
                        {sessionData?.latestResult?.cancelled ? (
                          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                            Execution was cancelled before completion.
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="space-y-5">
                      {plan.map((step, idx) => {
                        const log = stepLogs[idx];
                        const isActive = idx === currentStepIndex;
                        const isSuccess = log?.status === 'success';
                        const isFailed = log?.status === 'failed' || log?.status === 'timeout';
                        const isRunning = log?.status === 'running';

                        return (
                          <motion.div
                            key={idx}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: idx * 0.1 }}
                            className={`group relative overflow-hidden rounded-[24px] border transition-all duration-700 ${
                              isActive ? 'border-sky-400/50 bg-gradient-to-r from-sky-500/[0.08] to-violet-500/[0.02] shadow-[0_0_50px_rgba(56,189,248,0.15)] scale-[1.02]' :
                              isSuccess ? 'border-emerald-500/30 bg-emerald-500/[0.04]' :
                              isFailed ? 'border-red-500/40 bg-red-500/[0.05] shadow-[0_0_30px_rgba(239,68,68,0.1)]' :
                              'border-white/10 bg-slate-900/40 opacity-60 hover:opacity-100 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-start gap-6 p-6">
                              <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-black border transition-all duration-500 ${
                                isActive ? 'bg-sky-500 text-white border-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.6)] animate-pulse' :
                                isSuccess ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]' :
                                isFailed ? 'bg-red-500/20 text-red-400 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]' :
                                'bg-slate-800 text-slate-400 border-white/10'
                              }`}>
                                {isSuccess ? <CheckCircle2 size={18} /> : isFailed ? <AlertCircle size={18} /> : idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-3">
                                  <h4 className={`text-sm font-black uppercase tracking-widest truncate ${
                                      isActive ? 'text-sky-300' : 
                                      isSuccess ? 'text-emerald-300' : 
                                      isFailed ? 'text-red-300' : 
                                      'text-slate-400'
                                    }`}>
                                      {(step.title || step.action || step.name || 'Unknown').replace(/_/g, ' ')}
                                    </h4>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-tighter">
                                      {isRunning ? 'Processing' : log?.status || ''}
                                    </span>
                                  </div>
                                </div>
                                {step.expectedOutcome ? <p className="mb-4 text-xs text-slate-400">{step.expectedOutcome}</p> : null}

                                {showDryRun && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    className="mb-4 overflow-hidden rounded-xl bg-black/40 border border-white/5"
                                  >
                                    <div className="flex items-center gap-2 bg-white/[0.03] px-4 py-2 border-b border-white/5">
                                      <Terminal size={11} className="text-slate-500" />
                                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Deterministic Mapping</span>
                                    </div>
                                    <pre className="p-4 text-[11px] font-mono text-sky-400/80 overflow-x-auto whitespace-pre-wrap leading-relaxed italic">
                                      {step.command}
                                    </pre>
                                  </motion.div>
                                )}

                                {isFailed && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                  >
                                    <div className="rounded-xl bg-red-500/5 p-4 border border-red-500/10">
                                      <p className="text-[11px] font-mono font-medium text-red-400/90 leading-relaxed whitespace-pre-wrap">
                                        {log.error || log.output}
                                      </p>
                                    </div>
                                    <div className="flex gap-3">
                                      <button 
                                        onClick={requestRecovery}
                                        disabled={loading || !sessionId}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-6 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-red-400 shadow-lg shadow-red-500/20 disabled:opacity-30 transition-all"
                                      >
                                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
                                        Generate Recovery
                                      </button>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            </div>
                            {isRunning && (
                              <motion.div 
                                className="absolute bottom-0 left-0 h-1 bg-sky-500 shadow-[0_0_10px_rgba(56,189,248,0.8)]"
                                initial={{ width: 0 }}
                                animate={{ width: '100%' }}
                                transition={{ duration: 60, ease: 'linear' }}
                              />
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {primaryTerminalVisible ? (
                <AppTerminal
                  scriptPath={savedArtifact ? `/scripts/${savedArtifact}` : ''}
                  scriptName={preview?.title || 'Execution Session'}
                  disabled
                  onRun={() => {}}
                  onStop={() => {}}
                  onRestart={() => {}}
                  session={sessionId ? { runId: sessionId } : null}
                  status={executionStatus}
                  lastError={executionError}
                  runtimeArgs=""
                  setRuntimeArgs={() => {}}
                  streamEvents={streamEvents.map((event) => ({
                    ...event,
                    level: event.success === false ? 'error' : event.type === 'step_finished' && event.success ? 'success' : 'info',
                    data: event.data || event.stdout || event.stderr || event.title || event.type,
                  }))}
                />
              ) : null}

              {showWebTerminal ? (
                <AppTerminal
                  scriptPath={webTerminalSession?.cwd || user?.systemContext?.homeDir || ''}
                  scriptName={webTerminalSession ? `Web PTY ${webTerminalSession.id}` : 'Web Terminal'}
                  disabled={webTerminalStatus === 'running' || loading}
                  onRun={createWebTerminalSession}
                  onStop={stopWebTerminalSession}
                  onRestart={() => {
                    stopWebTerminalSession();
                    setTimeout(() => createWebTerminalSession(), 150);
                  }}
                  session={webTerminalSession ? { runId: webTerminalSession.id } : null}
                  status={webTerminalStatus}
                  lastError={webTerminalError}
                  runtimeArgs=""
                  setRuntimeArgs={() => {}}
                  streamEvents={terminalStreamEvents}
                  onTerminalInput={sendWebTerminalInput}
                  onTerminalResize={resizeWebTerminal}
                />
              ) : null}

              {/* Final Success State */}
              <AnimatePresence>
                {executionStatus === 'success' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-[32px] border border-emerald-500/20 bg-emerald-500/[0.03] p-12 text-center backdrop-blur-2xl shadow-3xl relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-24 bg-emerald-500 rounded-full blur-md opacity-50" />
                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-emerald-500 text-white shadow-3xl shadow-emerald-500/40 mb-8">
                      <CheckCircle2 size={40} />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-3">Transmission Successful</h2>
                    <p className="max-w-md mx-auto text-emerald-200/50 font-medium text-lg mb-10">The deterministic engine has finalized all operations within the hardened workspace.</p>
                    <div className="flex justify-center gap-5">
                      <button onClick={() => { setPlan([]); setExecutionStatus('idle'); setPrompt(''); }} className="rounded-2xl px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all backdrop-blur-md">
                        Reset Environment
                      </button>
                      <button onClick={() => navigate('/repo')} className="rounded-2xl bg-emerald-500 px-10 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-2xl shadow-emerald-500/30 hover:bg-emerald-400 transition-all">
                        Inspect Workspace
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Sidebar - System Stats */}
            <div className="lg:col-span-4 space-y-10">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-[30px] border border-white/5 bg-[#0f172a]/60 p-8 backdrop-blur-3xl shadow-2xl"
              >
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8 flex items-center gap-3">
                  <Terminal size={14} className="text-sky-500" /> System Registry
                </h3>
                <div className="space-y-6">
                  {[
                    { label: 'OS Context', val: user?.systemContext?.os || 'macOS', color: 'text-emerald-400 font-bold' },
                    { label: 'Target Arch', val: user?.systemContext?.arch || 'ARM64', color: 'text-sky-400 font-mono' },
                    { label: 'Pkg Manager', val: user?.systemContext?.packageManagers?.[0] || 'brew', color: 'text-slate-300' },
                    { label: 'AI Engine', val: 'V4 JSON Compiler', color: 'text-slate-300' }
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</span>
                      <span className={`text-[11px] ${stat.color}`}>{stat.val}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-10 pt-10 border-t border-white/5">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Resource Distribution</h4>
                    <div className="flex gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800/50 overflow-hidden flex shadow-inner">
                    <div className="h-full bg-emerald-500 w-[60%] shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
                    <div className="h-full bg-amber-500 w-[30%] shadow-[0_0_10px_rgba(245,158,11,0.3)]" />
                    <div className="h-full bg-red-500 w-[10%] shadow-[0_0_10px_rgba(239,68,68,0.3)]" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-1 text-[8px] font-black uppercase tracking-tighter text-center opacity-50">
                    <span>Safe</span>
                    <span>Resticted</span>
                    <span>Blocked</span>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-[30px] border border-white/5 bg-[#0f172a]/60 p-8 backdrop-blur-3xl shadow-2xl"
              >
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3">
                    <Shield size={14} className="text-violet-400" /> Live Sessions
                  </h3>
                  <button onClick={() => { fetchDashboardSessions(); refreshTerminalSessions(); }} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-white/10">
                    Refresh
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Execution Sessions</div>
                    <div className="space-y-3">
                      {dashboardSessions.slice(0, 6).map((session) => (
                        <div key={session.id} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-white truncate">{session.prompt || session.id}</div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-400">{session.status}</div>
                          </div>
                          <div className="mt-2 text-[10px] text-slate-500">{session.intent?.type || 'execution'}</div>
                        </div>
                      ))}
                      {!dashboardSessions.length ? <div className="text-xs text-slate-500">No execution sessions yet.</div> : null}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <div className="mb-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Web Terminal Sessions</div>
                    <div className="space-y-3">
                      {terminalSessions.slice(0, 6).map((session) => (
                        <div key={session.id} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-bold text-white truncate">{session.shell}</div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-400">{session.id}</div>
                          </div>
                          <div className="mt-2 text-[10px] text-slate-500 truncate">{session.cwd}</div>
                        </div>
                      ))}
                      {!terminalSessions.length ? <div className="text-xs text-slate-500">No active PTY sessions.</div> : null}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* History Section */}
              <section className="space-y-5">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">Operations History</h3>
                  <button onClick={() => { setHistory([]); localStorage.removeItem('unifix_ai_history'); }} className="text-slate-700 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/5">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="max-h-[500px] overflow-y-auto space-y-4 pr-3 scrollbar-thin scrollbar-thumb-white/5 hover:scrollbar-thumb-white/10 transition-all">
                  {history.map((item, idx) => (
                    <motion.button
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setPrompt(item.text)}
                      className="w-full text-left rounded-2xl border border-white/[0.03] bg-white/[0.02] p-6 group hover:border-sky-500/30 transition-all hover:bg-sky-500/[0.03] shadow-sm hover:shadow-sky-500/10"
                    >
                      <p className="line-clamp-2 text-sm text-slate-500 group-hover:text-slate-200 transition-colors leading-relaxed font-medium">
                        {item.text}
                      </p>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-700 uppercase tracking-widest group-hover:text-slate-500 transition-colors">
                          <Clock size={10} />
                          {item.time}
                        </div>
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-800 group-hover:bg-sky-500 transition-colors" />
                      </div>
                    </motion.button>
                  ))}
                  {history.length === 0 && (
                    <div className="py-24 text-center">
                      <div className="inline-flex h-16 w-16 items-center justify-center rounded-[20px] bg-slate-900 border border-white/5 text-slate-800 mb-6">
                        <Clock size={32} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-700">Registry Empty</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AILab;
