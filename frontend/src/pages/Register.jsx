import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Shield, Sparkles, Terminal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleOptions = [
  { id: 'user', label: 'Standard User', description: 'Minimal privileges for everyday operations.' },
  { id: 'admin', label: 'Admin (Lvl 4)', description: 'Full control with enterprise oversight.' },
];

const initialFormState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'user',
  terms: false,
};

const validationRules = {
  name: {
    required: 'Name is required.',
    min: { length: 3, message: 'Use at least 3 characters.' },
  },
  email: {
    required: 'Email is required.',
    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address.' },
  },
  password: {
    required: 'Password is required.',
    min: { length: 8, message: 'Password must be at least 8 characters.' },
    uppercase: { value: /[A-Z]/, message: 'Include at least one uppercase letter.' },
    number: { value: /\d/, message: 'Include at least one number.' },
    special: { value: /[^A-Za-z0-9]/, message: 'Include at least one special character.' },
  },
};

const linePrompts = [
  { id: 'name', label: 'enter name', icon: Terminal },
  { id: 'email', label: 'enter email', icon: Mail },
  { id: 'password', label: 'create secure password', icon: Shield },
  { id: 'confirmPassword', label: 'confirm password', icon: Shield },
  { id: 'role', label: 'assign role', icon: Sparkles },
  { id: 'terms', label: 'accept terms & conditions', icon: Sparkles },
];

const getPasswordStrength = (password) => {
  if (!password) return { label: 'Weak', score: 0, color: 'bg-rose-500' };
  const score = [/[A-Z]/, /\d/, /[^A-Za-z0-9]/].reduce((acc, regex) => (regex.test(password) ? acc + 1 : acc), 0);
  if (password.length >= 12 && score === 3) return { label: 'Strong', score: 3, color: 'bg-emerald-400' };
  if (password.length >= 8 && score >= 2) return { label: 'Medium', score: 2, color: 'bg-amber-300' };
  return { label: 'Weak', score: 1, color: 'bg-rose-500' };
};

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState('');
  const [activePrompt, setActivePrompt] = useState('name');
  const [progressStep, setProgressStep] = useState('waiting');

  useEffect(() => {
    const draft = window.localStorage.getItem('unifix_register_draft');
    if (draft) {
      setFormData((prev) => ({ ...prev, ...JSON.parse(draft) }));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('unifix_register_draft', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const passwordStrength = useMemo(() => getPasswordStrength(formData.password), [formData.password]);

  const validateField = (name, value) => {
    const rules = validationRules[name];
    if (!rules) return '';

    if (rules.required && !value.trim()) return rules.required;
    if (rules.min && value.length < rules.min.length) return rules.min.message;
    if (rules.pattern && !rules.pattern.value.test(value)) return rules.pattern.message;
    if (rules.uppercase && !rules.uppercase.value.test(value)) return rules.uppercase.message;
    if (rules.number && !rules.number.value.test(value)) return rules.number.message;
    if (rules.special && !rules.special.value.test(value)) return rules.special.message;
    return '';
  };

  const validateForm = () => {
    const nextErrors = {};
    nextErrors.name = validateField('name', formData.name);
    nextErrors.email = validateField('email', formData.email);
    nextErrors.password = validateField('password', formData.password);

    if (formData.password && formData.confirmPassword !== formData.password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your password.';
    }
    if (!formData.terms) {
      nextErrors.terms = 'You must accept the terms and conditions.';
    }

    const filtered = Object.fromEntries(Object.entries(nextErrors).filter(([, value]) => value));
    setErrors(filtered);
    return Object.keys(filtered).length === 0;
  };

  const advancePrompt = (nextId) => {
    setActivePrompt(nextId);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrors({});
    if (!validateForm()) {
      setToast('Please fix validation errors before continuing.');
      return;
    }

    setLoading(true);
    setProgressStep('initializing');
    setToast('Initializing account creation...');

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      
      let systemContext = {};
      if (window.electronAPI && window.electronAPI.getSystemContext) {
        systemContext = await window.electronAPI.getSystemContext();
      } else {
        systemContext = {
          os: navigator.platform,
          userAgent: navigator.userAgent
        };
      }

      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        systemContext
      });
      setProgressStep('securing');
      setToast('Account created successfully ✅');
      window.localStorage.removeItem('unifix_register_draft');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      const message = err?.response?.data?.message || err.message || 'Registration failed.';
      setErrors({ form: message });
      setToast('Unable to complete registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyboardSubmit = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'enter') {
      handleSubmit(event);
    }
  };

  const handleKeyPress = (event, fieldId, nextId) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const trimmed = formData[fieldId]?.trim() || '';
    if (!trimmed && fieldId !== 'terms') {
      setErrors((prev) => ({ ...prev, [fieldId]: validateField(fieldId, trimmed) || 'This field is required.' }));
      return;
    }
    if (fieldId === 'password' && passwordStrength.label === 'Weak') {
      setErrors((prev) => ({ ...prev, password: 'Choose a stronger password.' }));
      return;
    }
    advancePrompt(nextId);
  };

  const renderPromptLine = ({ id, label, icon: PromptIcon }) => {
    const isActive = activePrompt === id;
    return (
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={`flex items-center gap-3 rounded-3xl border px-4 py-4 text-sm transition ${isActive ? 'border-sky-400/40 bg-slate-900/80 shadow-[0_10px_40px_rgba(56,189,248,0.12)]' : 'border-white/10 bg-white/5'}`}
      >
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950/80 text-sky-300">
          <PromptIcon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{`> ${label}`}</p>
          <p className="mt-2 text-sm text-slate-300">{id === 'role' ? roleOptions.find((option) => option.id === formData.role)?.label : id === 'terms' ? (formData.terms ? 'Accepted' : 'Pending acceptance') : formData[id] || 'waiting...'}</p>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 py-16 px-4 sm:px-6 lg:px-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.36em] text-sky-400/70">Nexus account onboarding</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Initialize Account</h1>
            <p className="mt-3 max-w-2xl text-slate-400">Complete the secure registration sequence to access the terminal and automation workspace.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 px-5 py-4 text-sm text-slate-300">
            Already registered? <Link to="/login" className="font-semibold text-sky-300 hover:text-white">Access Terminal</Link>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-[1.25fr_0.9fr]">
          <motion.section
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-[32px] border border-white/10 bg-slate-950/90 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.35)]"
          >
            <div className="space-y-6">
              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Terminal flow</p>
                    <h2 className="mt-2 text-2xl font-black text-white">Secure account sequence</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-3xl bg-sky-500/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-sky-200">
                    <Sparkles size={16} /> futuristic
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                {linePrompts.map((prompt) => renderPromptLine(prompt))}
              </div>

              <AnimatePresence>
                {errors.form && (
                  <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="rounded-3xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
                  >
                    {errors.form}
                  </motion.div>
                )}

                {toast && (
                  <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
                  >
                    {toast}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <form onSubmit={handleSubmit} onKeyDown={handleKeyboardSubmit} className="mt-8 space-y-6">
              <div className="grid gap-5">
                <div className="space-y-3">
                  <label htmlFor="name" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                    <span className="text-sky-300">&gt;</span> enter name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, 'name', 'email')}
                    placeholder="Command operator identity"
                    className={`w-full rounded-3xl border px-4 py-4 text-sm text-white outline-none transition ${errors.name ? 'border-rose-500 bg-rose-500/5 focus:border-rose-400' : 'border-white/10 bg-slate-900/80 focus:border-sky-400'}`}
                  />
                  {errors.name && <p className="text-sm text-rose-300">{errors.name}</p>}
                </div>

                <div className="space-y-3">
                  <label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                    <span className="text-sky-300">&gt;</span> enter email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, 'email', 'password')}
                    placeholder="operator@fixiq.local"
                    className={`w-full rounded-3xl border px-4 py-4 text-sm text-white outline-none transition ${errors.email ? 'border-rose-500 bg-rose-500/5 focus:border-rose-400' : 'border-white/10 bg-slate-900/80 focus:border-sky-400'}`}
                  />
                  {errors.email && <p className="text-sm text-rose-300">{errors.email}</p>}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="password" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                      <span className="text-sky-300">&gt;</span> create secure password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:border-sky-400"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, 'password', 'confirmPassword')}
                    placeholder="Str0ngP@ssw0rd!"
                    className={`w-full rounded-3xl border px-4 py-4 text-sm text-white outline-none transition ${errors.password ? 'border-rose-500 bg-rose-500/5 focus:border-rose-400' : 'border-white/10 bg-slate-900/80 focus:border-sky-400'}`}
                  />
                  <div className="flex items-center justify-between text-sm text-slate-500">
                    <p className="capitalize">{passwordStrength.label} strength</p>
                    <p>{formData.password.length ? `${formData.password.length} chars` : '0 chars'}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${passwordStrength.color}`} style={{ width: `${(passwordStrength.score / 3) * 100}%` }} />
                  </div>
                  {errors.password && <p className="text-sm text-rose-300">{errors.password}</p>}
                </div>

                <div className="space-y-3">
                  <label htmlFor="confirmPassword" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                    <span className="text-sky-300">&gt;</span> confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, 'confirmPassword', 'role')}
                    placeholder="Re-enter your password"
                    className={`w-full rounded-3xl border px-4 py-4 text-sm text-white outline-none transition ${errors.confirmPassword ? 'border-rose-500 bg-rose-500/5 focus:border-rose-400' : 'border-white/10 bg-slate-900/80 focus:border-sky-400'}`}
                  />
                  {errors.confirmPassword && <p className="text-sm text-rose-300">{errors.confirmPassword}</p>}
                </div>

                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                    <span className="text-sky-300">&gt;</span> assign role
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {roleOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          handleChange('role', option.id);
                          advancePrompt('terms');
                        }}
                        className={`rounded-3xl border px-5 py-4 text-left transition ${formData.role === option.id ? 'border-sky-400 bg-sky-500/10 shadow-[0_20px_60px_rgba(56,189,248,0.12)]' : 'border-white/10 bg-white/5 hover:border-sky-400/30'}`}
                      >
                        <p className="font-semibold text-white">{option.label}</p>
                        <p className="mt-2 text-sm text-slate-400">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4">
                  <label className="inline-flex items-center gap-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={formData.terms}
                      onChange={(e) => handleChange('terms', e.target.checked)}
                      className="h-4 w-4 rounded border-white/20 bg-slate-900 text-sky-400 focus:ring-sky-300"
                    />
                    <span>I agree to the <span className="text-sky-300 underline decoration-dashed">Terms & Conditions</span>.</span>
                  </label>
                  {errors.terms && <p className="text-sm text-rose-300">{errors.terms}</p>}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group inline-flex w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-sky-500 to-cyan-400 px-6 py-4 text-sm font-black uppercase tracking-[0.24em] text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-slate-950"></span>
                    Initializing secure account...
                  </>
                ) : (
                  <>Create Secure Account</>
                )}
              </button>
            </form>
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-[32px] border border-white/10 bg-slate-950/90 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.35)]"
          >
            <div className="space-y-6">
              <div className="rounded-[28px] border border-white/10 bg-slate-900/80 p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Progress</p>
                <h2 className="mt-2 text-2xl font-black text-white">Setup diagnostics</h2>
              </div>

              <div className="grid gap-4">
                <StatusBlock label="Creating identity" active={progressStep !== 'waiting'} completed={progressStep !== 'waiting'} />
                <StatusBlock label="Assigning role" active={progressStep === 'initializing' || progressStep === 'securing'} completed={progressStep === 'securing' || progressStep === 'done'} />
                <StatusBlock label="Securing credentials" active={progressStep === 'securing' || progressStep === 'done'} completed={progressStep === 'done'} />
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
                <p className="font-semibold text-white">Command shortcuts</p>
                <ul className="mt-4 space-y-3 text-slate-400">
                  <li><span className="text-sky-300">Enter</span> → Move to next field</li>
                  <li><span className="text-sky-300">Ctrl/Cmd + Enter</span> → Submit registration</li>
                  <li><span className="text-sky-300">Access Terminal</span> → Login route</li>
                </ul>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </div>
  );
};

const StatusBlock = ({ label, active, completed }) => (
  <div className={`rounded-3xl border px-5 py-4 transition ${completed ? 'border-emerald-400/20 bg-emerald-500/10' : active ? 'border-sky-400/20 bg-sky-500/10' : 'border-white/10 bg-white/5'}`}>
    <div className="flex items-center justify-between gap-3">
      <p className="font-semibold text-white">{label}</p>
      <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.24em] ${completed ? 'bg-emerald-400/10 text-emerald-200' : active ? 'bg-sky-400/10 text-sky-200' : 'bg-white/10 text-slate-400'}`}>
        {completed ? 'Done' : active ? 'Active' : 'Pending'}
      </span>
    </div>
  </div>
);

export default Register;
