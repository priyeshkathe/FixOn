import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [introLines, setIntroLines] = useState(['', '', '']);
  const [introComplete, setIntroComplete] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [progressLines, setProgressLines] = useState([]);
  const [touched, setTouched] = useState({ email: false, password: false });

  const isEmailValid = emailPattern.test(formData.email);
  const isPasswordValid = formData.password.length >= 8;
  const formValid = isEmailValid && isPasswordValid;

  useEffect(() => {
    const blink = setInterval(() => setCursorVisible((prev) => !prev), 500);
    return () => clearInterval(blink);
  }, []);

  useEffect(() => {
    const lines = [
      'Initializing secure node...',
      'Establishing encrypted channel...',
      'Awaiting operator credentials...',
    ];
    let activeLine = 0;
    let index = 0;
    const animate = async () => {
      for (activeLine = 0; activeLine < lines.length; activeLine += 1) {
        index = 0;
        while (index <= lines[activeLine].length) {
          setIntroLines((prev) => {
            const next = [...prev];
            next[activeLine] = lines[activeLine].slice(0, index);
            return next;
          });
          await sleep(40);
          index += 1;
        }
        await sleep(450);
      }
      setIntroComplete(true);
    };
    animate();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setError('');

    if (!formValid) {
      setError('Please fix the highlighted fields before connecting.');
      return;
    }

    setLoading(true);
    setProgressLines([]);

    const phases = [
      'Verifying identity...',
      'Checking zero-trust policy...',
      'Applying session keys...',
    ];

    for (const line of phases) {
      await sleep(650);
      setProgressLines((prev) => [...prev, `> ${line}`]);
    }

    try {
      let systemContext = {};
      if (window.electronAPI && window.electronAPI.getSystemContext) {
        systemContext = await window.electronAPI.getSystemContext();
      } else {
        // Fallback for browser
        systemContext = {
          os: navigator.platform,
          userAgent: navigator.userAgent
        };
      }
      await login(formData.email, formData.password, systemContext);
      setProgressLines((prev) => [...prev, '> Access granted ✅']);
      await sleep(600);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Authentication failed. Verify credentials and try again.');
      setProgressLines((prev) => [...prev, '> Access denied ❌']);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !loading) {
      handleSubmit(event);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02040b] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.22),transparent_15%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.18),transparent_20%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(4,8,18,0.96),rgba(8,12,28,0.98))]" />
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=800 height=800 viewBox=0 0 800 800 xmlns=http://www.w3.org/2000/svg%3E%3Cpath d=\'M0 0h800v800H0z\' fill=\'none\'/%3E%3Cpath d=\'M0 20h800M0 40h800M0 60h800M20 0v800M40 0v800M60 0v800\' stroke=%27rgba(255,255,255,0.04)%27 stroke-width=1/%3E%3C/svg%3E')] opacity-20" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_40px_120px_rgba(15,23,42,0.45)] backdrop-blur-xl"
        >
          <div className="absolute inset-x-10 top-0 h-40 rounded-[28px] bg-gradient-to-br from-sky-500/20 via-violet-500/10 to-transparent blur-3xl" />
          <div className="absolute -left-16 top-12 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute -right-16 top-20 h-36 w-36 rounded-full bg-violet-500/10 blur-3xl" />

          <div className="relative z-10 space-y-8">
            <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-slate-300">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#ff5f56] shadow-[0_0_15px_rgba(255,95,86,0.25)]" />
                <span className="h-3 w-3 rounded-full bg-[#ffbd2e] shadow-[0_0_15px_rgba(255,189,46,0.25)]" />
                <span className="h-3 w-3 rounded-full bg-[#27c93f] shadow-[0_0_15px_rgba(39,201,63,0.25)]" />
              </div>
              <div className="text-sm uppercase tracking-[0.24em] text-slate-400">secure-node@fixiq</div>
              <div className="text-xs uppercase tracking-[0.3em] text-emerald-300">SSH console</div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/75 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
              <div className="mb-6 text-sm font-mono leading-7 text-emerald-200">
                <p>&gt; {introLines[0]}{currentLineCursor(introComplete, cursorVisible)}</p>
                <p>&gt; {introLines[1]}{currentLineCursor(introComplete, cursorVisible)}</p>
                <p>&gt; {introLines[2]}{introComplete ? '' : cursorVisible ? '_' : ' '}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-2xl border border-slate-700/70 bg-slate-950/90 p-4 font-mono text-sm text-emerald-200 shadow-inner shadow-slate-950/40">
                  <div className="mb-4 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-slate-500">
                    <div>operator@node:~$</div>
                    <div className="text-slate-500">enter email</div>
                  </div>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                    onKeyDown={handleKeyDown}
                    placeholder="operator@secure.node"
                    className={inputClass(touched.email ? isEmailValid : null)}
                  />
                  {touched.email && !isEmailValid && <p className="mt-3 text-xs text-rose-300">Please enter a valid email.</p>}
                </div>

                <div className="rounded-2xl border border-slate-700/70 bg-slate-950/90 p-4 font-mono text-sm text-emerald-200 shadow-inner shadow-slate-950/40">
                  <div className="mb-4 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-slate-500">
                    <div>operator@node:~$</div>
                    <div className="text-slate-500">enter access_key</div>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                      onKeyDown={handleKeyDown}
                      placeholder="********"
                      className={inputClass(touched.password ? isPasswordValid : null)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {touched.password && !isPasswordValid && <p className="mt-3 text-xs text-rose-300">Access key must be at least 8 characters.</p>}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-400">
                  <label className="inline-flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-white/15 bg-slate-900 text-sky-400 focus:ring-sky-400/60"
                    />
                    Remember me
                  </label>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.3em] text-sky-300">
                    {loading ? 'Connecting...' : 'Press Enter to connect'}
                  </div>
                </div>
              </form>

              <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/90 p-4 font-mono text-sm leading-7 text-emerald-200 shadow-inner shadow-slate-950/40">
                {progressLines.map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
                {error && <p className="mt-3 text-rose-300">&gt; {error}</p>}
              </div>
              <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
                <p>New operator?</p>
                <Link to="/register" className="font-semibold text-sky-300 transition hover:text-white">
                  Create a secure node account
                </Link>
              </div>
            </div>

            <aside className="rounded-[28px] border border-white/10 bg-slate-950/80 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.15)] backdrop-blur-xl">
              <div className="flex items-center gap-3 rounded-3xl bg-slate-900/80 p-4">
                <Shield size={20} className="text-sky-300" />
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Security overview</p>
                  <p className="text-sm font-semibold text-white">Encrypted gateway locked</p>
                </div>
              </div>
              <div className="grid gap-4 mt-4">
                {[
                  { icon: ShieldCheck, title: 'Encrypted session', subtitle: 'AES-256 encrypted transport' },
                  { icon: Sparkles, title: 'Zero-trust access', subtitle: 'Verified operator identity' },
                  { icon: CheckCircle2, title: 'Node integrity', subtitle: 'Tamper-resistant gateway' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-4">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-500/10 text-sky-300">
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{item.title}</p>
                        <p className="text-sm text-slate-400">{item.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

const currentLineCursor = (complete, visible) => {
  if (complete) return visible ? '_' : ' ';
  return '';
};

const inputClass = (valid) =>
  `w-full rounded-2xl border bg-black/20 px-4 py-3 text-sm font-mono text-emerald-200 outline-none transition-all placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 ${valid === null ? 'border-white/10' : valid ? 'border-emerald-400/40 ring-1 ring-emerald-400/15' : 'border-rose-400/50 text-rose-200'
  }`;

export default Login;
