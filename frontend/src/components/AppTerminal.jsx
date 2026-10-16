import { AlertTriangle, Play, RotateCcw, SquareTerminal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

const LEVEL_COLORS = {
  info: '\x1b[36m',
  error: '\x1b[31m',
  success: '\x1b[32m',
  warn: '\x1b[33m',
};

const RESET = '\x1b[0m';

const AppTerminal = ({
  scriptPath,
  scriptName,
  disabled,
  onRun,
  onStop,
  onRestart,
  session,
  status,
  lastError,
  runtimeArgs,
  setRuntimeArgs,
  streamEvents = [],
  onTerminalInput,
  onTerminalResize,
}) => {
  const terminalMountRef = useRef(null);
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const activeRunIdRef = useRef(null);
  const [ready, setReady] = useState(false);
  const renderedEventCountRef = useRef(0);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.35,
      scrollback: 5000,
      theme: {
        background: '#04070d',
        foreground: '#d7e3f4',
        cursor: '#7dd3fc',
        selectionBackground: '#1e293b',
        black: '#0f172a',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#f472b6',
        cyan: '#22d3ee',
        white: '#e2e8f0',
        brightBlack: '#475569',
        brightRed: '#fb7185',
        brightGreen: '#86efac',
        brightYellow: '#fcd34d',
        brightBlue: '#93c5fd',
        brightMagenta: '#f9a8d4',
        brightCyan: '#67e8f9',
        brightWhite: '#f8fafc',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalMountRef.current);
    fitAddon.fit();

    term.writeln('\x1b[36mFixOn terminal ready.\x1b[0m');
    term.writeln('\x1b[90mRun a script to start streaming output here.\x1b[0m');

    const disposeData = term.onData((data) => {
      if (activeRunIdRef.current && window.electronAPI?.sendTerminalInput) {
        window.electronAPI.sendTerminalInput(activeRunIdRef.current, data);
        return;
      }
      if (typeof onTerminalInput === 'function') {
        onTerminalInput(data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      if (typeof onTerminalResize === 'function') {
        onTerminalResize({ cols: term.cols, rows: term.rows });
      }
    });

    resizeObserver.observe(terminalMountRef.current);
    terminalRef.current = term;
    fitAddonRef.current = fitAddon;
    setReady(true);

    return () => {
      resizeObserver.disconnect();
      disposeData.dispose();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      activeRunIdRef.current = null;
      setReady(false);
    };
  }, [onTerminalInput, onTerminalResize]);

  useEffect(() => {
    activeRunIdRef.current = session?.runId || null;
  }, [session?.runId]);

  useEffect(() => {
    if (!window.electronAPI?.onTerminalEvent || !terminalRef.current) {
      return undefined;
    }

    const unsubscribe = window.electronAPI.onTerminalEvent((event) => {
      if (!terminalRef.current) return;
      if (activeRunIdRef.current && event.runId !== activeRunIdRef.current && event.type !== 'started') return;

      const color = LEVEL_COLORS[event.level] || '';
      if (event.type === 'stdout' || event.type === 'stderr') {
        terminalRef.current.write(`${color}${event.data}${RESET}`);
        return;
      }

      const message = event.data || '';
      terminalRef.current.writeln(`${color}${message}${RESET}`);
    });

    return unsubscribe;
  }, [session?.runId]);

  useEffect(() => {
    if (!terminalRef.current || !Array.isArray(streamEvents)) return;
    const nextEvents = streamEvents.slice(renderedEventCountRef.current);
    if (!nextEvents.length) return;

    nextEvents.forEach((event) => {
      const color = LEVEL_COLORS[event.level] || '';
      const data = event.data || event.stderr || event.stdout || event.message || '';
      const line = typeof data === 'string' ? data : JSON.stringify(data);
      if (event.type === 'stdout' || event.type === 'stderr' || event.type === 'log') {
        terminalRef.current.write(`${color}${line}${RESET}${line.endsWith('\n') ? '' : '\r\n'}`);
        return;
      }

      terminalRef.current.writeln(`${color}${line}${RESET}`);
    });

    renderedEventCountRef.current = streamEvents.length;
  }, [streamEvents]);

  useEffect(() => {
    if (!terminalRef.current || !session?.runId) return;

    terminalRef.current.clear();
    terminalRef.current.writeln(`\x1b[36mAttached to session ${session.runId}\x1b[0m`);
    terminalRef.current.writeln(`\x1b[90mScript: ${scriptName}\x1b[0m`);
  }, [session?.runId, scriptName]);

  useEffect(() => {
    if (!session?.runId && terminalRef.current) {
      renderedEventCountRef.current = 0;
    }
  }, [session?.runId]);

  const handleRun = () => {
    if (terminalRef.current) {
      terminalRef.current.clear();
      terminalRef.current.writeln(`\x1b[36mStarting ${scriptName}...\x1b[0m`);
    }
    onRun();
  };

  const canRestart = Boolean(session?.runId) && !['starting', 'stopping', 'restarting'].includes(status);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 overflow-hidden shadow-[0_40px_120px_rgba(15,23,42,0.35)] backdrop-blur-xl">
      <div className="flex flex-col gap-3 border-b border-white/10 bg-black/20 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <SquareTerminal size={16} />
            <span>Interactive Terminal</span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {scriptPath || 'Select a file to execute'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRun}
            disabled={disabled || !scriptPath}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            <Play size={16} />
            Run Script
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={!session?.runId || status !== 'running'}
            className="inline-flex items-center gap-2 rounded-2xl bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200 transition-all hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <AlertTriangle size={16} />
            Stop
          </button>
          <button
            type="button"
            onClick={() => window.electronAPI?.openNativeTerminal(scriptPath)}
            disabled={!scriptPath}
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 transition-all hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
          >
            <SquareTerminal size={16} />
            Native Terminal
          </button>
          <button
            type="button"
            onClick={onRestart}
            disabled={!canRestart}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition-all hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600"
          >
            <RotateCcw size={16} />
            Restart
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-b border-white/10 bg-black/10 px-5 py-3 lg:flex-row lg:items-center">
        <div className="flex flex-1 items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Arguments:</span>
          <input
            type="text"
            value={runtimeArgs}
            onChange={(e) => setRuntimeArgs(e.target.value)}
            disabled={status === 'running' || status === 'starting'}
            placeholder="--port 8080 --dev..."
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-sky-500/30 focus:bg-white/10"
          />
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-slate-500" style={{
              backgroundColor: status === 'running' ? '#10b981' : status === 'error' || status === 'failed' ? '#ef4444' : '#64748b'
            }} />
            <span className="font-semibold text-slate-400 capitalize">{status}</span>
          </div>
          {lastError ? (
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle size={14} />
              <span className="truncate max-w-[200px]">{lastError}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="h-[340px] w-full bg-[#04070d]">
        <div ref={terminalMountRef} className="h-full w-full px-2 py-2" />
      </div>

      {!ready ? (
        <div className="border-t border-white/10 px-5 py-3 text-xs text-slate-500">
          Initializing terminal renderer...
        </div>
      ) : null}
    </div>
  );
};

export default AppTerminal;
