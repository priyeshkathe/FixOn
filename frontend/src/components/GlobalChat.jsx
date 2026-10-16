import { AnimatePresence, motion } from 'framer-motion';
import { Bot, ChevronDown, ChevronUp, CircleDot, Clipboard, Code2, Paperclip, Play, RefreshCcw, Send, Sparkles, User, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { requestApi } from '../lib/api';
import { useTheme } from '../context/ThemeContext';

const promptSuggestions = [
  'Secure my server',
  'Optimize Docker setup',
  'Scan for vulnerabilities',
];

const modelOptions = [
  { id: 'gemini', label: 'Gemini', description: 'Cloud AI, high throughput' },
  { id: 'ollama', label: 'Ollama', description: 'Local inference, privacy first' },
];

const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const extractCodeBlocks = (text) => {
  const blocks = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    blocks.push({ type: 'code', lang: match[1] || 'bash', content: match[2] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    blocks.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return blocks;
};

const GlobalChat = ({ isOpen, onClose, onInsertCode }) => {
  const { settings } = useTheme();
  const [messages, setMessages] = useState([
    {
      id: 'assistant-0',
      role: 'assistant',
      content: 'Hello! I am FixOn AI. Ask me anything about your environment or scripts.',
      time: formatTime(new Date()),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(settings.aiModel || 'ollama');
  const [toast, setToast] = useState('');
  const [history, setHistory] = useState([]);
  const listRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);

  const hasConversation = messages.length > 1;

  useEffect(() => {
    if (!isOpen) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (settings.aiModel && settings.aiModel !== model) {
      setModel(settings.aiModel);
    }
  }, [model, settings.aiModel]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      time: formatTime(new Date()),
    };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      time: formatTime(new Date()),
      pending: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await requestApi({
        method: 'post',
        url: '/ai/chat',
        data: {
          model,
          messages: [...messages, userMessage],
        },
      });
      const responseText = res.data.reply || 'I could not generate a response. Please try again.';
      setMessages((prev) => prev.map((msg) => (msg.id === assistantId ? { ...msg, content: responseText, pending: false } : msg)));
      setHistory((prev) => [
        { id: assistantId, title: trimmed, model, time: new Date().toLocaleString() },
        ...prev.slice(0, 8),
      ]);
    } catch {
      setMessages((prev) => prev.map((msg) => (msg.id === assistantId ? { ...msg, content: 'Sorry, I could not reach the assistant. Check your connection.', pending: false } : msg)));
    } finally {
      setLoading(false);
    }
  };

  const handlePromptClick = (prompt) => {
    setInput(prompt);
    setToast('Prompt loaded');
  };

  const handleCopy = async (content) => {
    await navigator.clipboard.writeText(content);
    setToast('Copied to clipboard');
  };

  const handleInsert = (code) => {
    if (onInsertCode) {
      onInsertCode(code);
      setToast('Inserted into editor');
    } else {
      setInput(code);
      setToast('Code ready to paste into editor');
    }
  };

  const handleRun = (code) => {
    setToast('Ready to run this script in your workspace');
    if (!onInsertCode) setInput(code);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'assistant-0',
        role: 'assistant',
        content: 'Chat cleared. Ask anything about your system or automation.',
        time: formatTime(new Date()),
      },
    ]);
    setToast('Chat cleared');
  };

  const emptyState = (
    <div className="flex h-full flex-col items-center justify-center gap-5 rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400">
      <div className="h-20 w-20 rounded-3xl bg-slate-900/80 grid place-items-center text-sky-300 shadow-[0_20px_80px_rgba(56,189,248,0.12)]">
        <Sparkles size={28} />
      </div>
      <h2 className="text-xl font-black text-white">Ask anything about your system...</h2>
      <p className="max-w-xs text-sm leading-6 text-slate-400">Get instant guidance on security, deployments, scripts, and automation workflows.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {promptSuggestions.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handlePromptClick(prompt)}
            className="rounded-3xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-200 transition hover:border-sky-500/30 hover:bg-slate-900/95"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );

  const renderedMessages = messages.map((message) => {
    const blocks = extractCodeBlocks(message.content);
    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`relative max-w-[85%] rounded-3xl border px-4 py-4 shadow-lg transition-all ${
          message.role === 'user'
            ? 'bg-sky-500/15 border-sky-500/20 text-white hover:shadow-[0_24px_80px_rgba(56,189,248,0.18)]'
            : 'bg-slate-900/85 border-white/5 text-slate-200 hover:bg-slate-900/95'
        }`}>
          <div className="flex items-start gap-3">
            <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 text-slate-200">
              {message.role === 'user' ? <User size={18} /> : <Bot size={18} />}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3 pb-3">
                <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">
                  {message.role === 'user' ? 'You' : 'FixOn AI'}
                </span>
                <span className="text-[10px] text-slate-500">{message.time}</span>
              </div>
              <div className="space-y-3 text-sm leading-7">
                {blocks.map((block, index) =>
                  block.type === 'text' ? (
                    <p key={index} className="whitespace-pre-wrap text-slate-200">{block.content}</p>
                  ) : (
                    <div key={index} className="rounded-3xl border border-white/10 bg-slate-950/90 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                        <span>{block.lang || 'bash'}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(block.content)}
                            className="rounded-2xl bg-white/5 px-3 py-1 text-[11px] text-slate-200 transition hover:bg-white/10"
                          >
                            <Clipboard size={12} className="inline-block" /> Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsert(block.content)}
                            className="rounded-2xl bg-white/5 px-3 py-1 text-[11px] text-slate-200 transition hover:bg-white/10"
                          >
                            <Code2 size={12} className="inline-block" /> Insert
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRun(block.content)}
                            className="rounded-2xl bg-sky-500/10 px-3 py-1 text-[11px] text-sky-200 transition hover:bg-sky-500/20"
                          >
                            <Play size={12} className="inline-block" /> Run
                          </button>
                        </div>
                      </div>
                      <pre className="max-h-[240px] overflow-x-auto rounded-3xl bg-slate-950 px-3 py-3 text-[13px] leading-6 text-slate-200">
                        {block.content}
                      </pre>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
          {message.pending && (
            <div className="absolute -bottom-3 right-4 flex items-center gap-1 text-[10px] uppercase tracking-[0.22em] text-sky-300">
              Typing
              <div className="flex gap-1">
                {[0, 1, 2].map((dot) => (
                  <motion.span
                    key={dot}
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.15 }}
                    className="h-1.5 w-1.5 rounded-full bg-sky-300"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6"
        >
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xl" onClick={onClose} />
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            className="relative z-20 grid h-[92vh] w-full max-w-4xl grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_420px] overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)]"
          >
            <div className="flex flex-col bg-slate-950/90">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-900/90 px-6 py-4 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-3xl bg-sky-500/15 text-sky-300">
                    <Bot size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">FixOn AI Assistant</h2>
                    <p className="text-sm text-slate-400">Ask about script security, automation, or system optimization.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> Online
                  </div>
                  <button onClick={clearChat} className="rounded-3xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 transition hover:border-sky-500/30 hover:bg-white/10">
                    <RefreshCcw size={14} /> Clear chat
                  </button>
                  <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-3xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900/90 px-6 py-3">
                <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-300">
                  Model: <span className="font-semibold text-white">{modelOptions.find((option) => option.id === model)?.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {modelOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setModel(option.id)}
                      className={`rounded-3xl px-4 py-2 text-sm font-semibold transition ${
                        model === option.id ? 'bg-sky-500 text-slate-950 shadow-[0_12px_40px_rgba(56,189,248,0.25)]' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <div ref={listRef} className="h-full overflow-y-auto px-6 py-6 space-y-4 custom-scrollbar">
                  {hasConversation ? renderedMessages : emptyState}
                </div>
              </div>

              <div className="border-t border-white/10 bg-slate-900/90 p-5 backdrop-blur-xl">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                  <Paperclip size={14} /> Attach file
                  <Code2 size={14} /> Code mode
                </div>
                <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-3 py-3">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type your prompt here..."
                    className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={sendMessage}
                    disabled={loading}
                    className={`inline-flex h-12 items-center justify-center rounded-3xl px-5 text-sm font-semibold transition ${
                      loading ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20 hover:brightness-110'
                    }`}
                  >
                    {loading ? <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-950" /> Sending</span> : <><Send size={18} /> Send</>}
                  </button>
                </div>
              </div>
            </div>

            <aside className="hidden lg:flex flex-col border-l border-white/10 bg-slate-950/95 p-6">
              <div className="flex items-center justify-between gap-3 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Conversation history</p>
                  <h3 className="text-lg font-black text-white mt-2">Recent sessions</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistory((prev) => !prev)}
                  className="rounded-3xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
                >
                  {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    {history.length ? history.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setMessages((prev) => [...prev, { id: `user-history-${Date.now()}`, role: 'user', content: item.title, time: formatTime(new Date()) }]);
                          setToast('Loaded previous prompt');
                        }}
                        className="w-full rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-left text-sm text-slate-200 transition hover:border-sky-500/30 hover:bg-white/10"
                      >
                        <p className="font-semibold text-white truncate">{item.title}</p>
                        <p className="mt-2 text-xs text-slate-500">{item.time} · {item.model}</p>
                      </button>
                    )) : (
                      <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                        Start a conversation to save recent sessions.
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                <div className="flex items-center gap-3 text-slate-400">
                  <CircleDot size={16} /> Live agent
                </div>
                <p className="mt-3 leading-6">Your AI assistant keeps context and can help with script security, deployments, and runtime diagnostics.</p>
              </div>
            </aside>
          </motion.div>

          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-8 right-8 z-50 rounded-3xl border border-white/10 bg-slate-950/95 px-5 py-3 text-sm text-slate-200 shadow-[0_20px_80px_rgba(0,0,0,0.4)]"
              >
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalChat;
