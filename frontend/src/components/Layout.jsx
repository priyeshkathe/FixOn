import { AnimatePresence, motion } from 'framer-motion';
import { Beaker, ChevronLeft, ChevronRight, FileCode, Layers, LayoutDashboard, LogOut, MessageSquare, Settings, ShieldAlert, User as UserIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import CommandPalette from './CommandPalette';
import GlobalChat from './GlobalChat';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsPaletteOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navSections = [
        {
            title: 'Main',
            items: [
                { path: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
                { path: '/ai-lab', icon: <Beaker size={20} />, label: 'AI Lab' },
                { path: '/blueprints', icon: <Layers size={20} />, label: 'Blueprints' },
            ],
        },
        {
            title: 'Tools',
            items: [
                { path: '/repo', icon: <FileCode size={20} />, label: 'Repository' },
                { path: '/audit', icon: <ShieldAlert size={20} />, label: 'Audit' },
            ],
        },
        {
            title: 'System',
            items: [{ path: '/settings', icon: <Settings size={20} />, label: 'Settings' }],
        },
    ];

    return (
        <div className="flex h-screen bg-main text-main font-inter selection:bg-primary/30 overflow-hidden">
            {/* Sidebar */}
            <aside className={`flex flex-col z-50 overflow-hidden border-r transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'} ${theme === "dark" ? 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-white/10' : 'bg-gradient-to-b from-white via-slate-50 to-slate-100 border-black/10'}`}> 
                <div className="relative px-6 pt-8 pb-6">
                    <div className="flex items-center justify-between gap-3">
                        <div className={`flex items-center gap-3 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                            <div className={`grid h-12 w-12 place-items-center rounded-3xl ${theme === "dark" ? 'bg-slate-900/80 text-sky-300 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.12)]' : 'bg-white/80 text-sky-600 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.3)]'}`}>
                                FQ
                            </div>
                            <div>
                                <motion.h1
                                    initial={{ opacity: 0, y: -8 }}
                                    animate={{ opacity: isCollapsed ? 0 : 1, y: isCollapsed ? -8 : 0 }}
                                    className={`text-2xl font-black tracking-tighter uppercase ${theme === "dark" ? 'text-white' : 'text-black'}`}
                                >
                                    <span className="text-sky-300">Fix</span>iQ
                                </motion.h1>
                                <span className={`text-[10px] uppercase tracking-[0.24em] ${theme === "dark" ? 'text-slate-500' : 'text-slate-600'}`}>Nexus Elite</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsCollapsed((prev) => !prev)}
                            className={`grid h-10 w-10 place-items-center rounded-3xl border transition-all ${theme === "dark" ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-slate-800 hover:text-sky-300' : 'border-black/10 bg-black/5 text-slate-700 hover:bg-slate-200 hover:text-sky-600'}`}
                            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        >
                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </button>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto px-2 pb-6 custom-scrollbar">
                    {navSections.map((section) => (
                        <div key={section.title} className="mb-6">
                            <div className={`px-4 pb-3 text-[10px] tracking-[0.3em] uppercase ${theme === "dark" ? 'text-slate-500' : 'text-slate-600'} ${isCollapsed ? 'hidden' : 'block'}`}>
                                {section.title}
                            </div>
                            <div className="space-y-2">
                                {section.items.map((item) => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        title={isCollapsed ? item.label : undefined}
                                        className={({ isActive }) =>
                                            `group flex items-center gap-4 rounded-3xl px-4 py-3 text-sm font-semibold transition-all ${
                                                isActive
                                                    ? 'bg-blue-500/10 text-sky-300 shadow-[0_24px_60px_rgba(56,189,248,0.16)]'
                                                    : `${theme === "dark" ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-700 hover:bg-black/10 hover:text-black'} hover:shadow-[0_12px_40px_rgba(56,189,248,0.12)]`
                                            } ${isCollapsed ? 'justify-center' : ''}`
                                        }
                                    >
                                        <span className="relative z-10 transition-colors duration-300 group-hover:text-sky-300">
                                            {item.icon}
                                        </span>
                                        <AnimatePresence>
                                            {!isCollapsed && (
                                                <motion.span
                                                    initial={{ opacity: 0, x: -6 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -6 }}
                                                    className="text-sm"
                                                >
                                                    {item.label}
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className={`sticky bottom-0 px-4 pb-4 pt-3 ${theme === "dark" ? 'bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent' : 'bg-gradient-to-t from-white via-white/90 to-transparent'}`}>
                    {user ? (
                        <NavLink
                            to="/profile"
                            className={`group flex items-center gap-3 rounded-3xl border px-4 py-4 transition-all ${isCollapsed ? 'justify-center' : 'hover:border-sky-500/30 hover:bg-white/10 hover:-translate-y-0.5'} ${theme === "dark" ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}
                            title={isCollapsed ? user.name : undefined}
                        >
                            <div className="grid h-11 w-11 place-items-center rounded-3xl bg-sky-500/10 text-sky-300 text-sm font-black">
                                {user.name.split(' ').map((n) => n[0]).join('')}
                            </div>
                            {!isCollapsed && (
                                <div className="flex-1 overflow-hidden">
                                    <p className={`text-sm font-semibold truncate ${theme === "dark" ? 'text-white' : 'text-black'}`}>{user.name}</p>
                                    <p className={`text-[10px] uppercase tracking-[0.24em] ${theme === "dark" ? 'text-slate-500' : 'text-slate-600'}`}>Lvl {user.level} · {user.role}</p>
                                </div>
                            )}
                        </NavLink>
                    ) : (
                        <NavLink
                            to="/login"
                            className={`group flex items-center justify-center gap-3 rounded-3xl border px-4 py-4 text-sm font-semibold transition-all hover:border-sky-500/30 hover:bg-blue-500/10 hover:text-white ${theme === "dark" ? 'border-white/10 bg-slate-900/80 text-slate-300' : 'border-black/10 bg-white/80 text-slate-700'}`}
                        >
                            <UserIcon size={18} />
                            {!isCollapsed && <span>Sign In</span>}
                        </NavLink>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <header className={`h-16 flex items-center justify-between px-10 z-20 border-b bg-main/50 backdrop-blur-xl ${theme === "dark" ? 'border-white/5' : 'border-black/10'}`}>
                    <div className="flex items-center gap-4">
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={location.pathname}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`text-[10px] font-black uppercase tracking-[0.2em] ${theme === "dark" ? 'text-muted' : 'text-slate-600'}`}
                            >
                                {location.pathname === '/' ? 'Operational Overview' : location.pathname.split('/').pop()?.replace('-', ' ')}
                            </motion.span>
                        </AnimatePresence>
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setIsPaletteOpen(true)}
                            className={`p-2.5 rounded-xl transition-all flex items-center gap-2 group shadow-lg ${theme === "dark" ? 'bg-white/10 hover:bg-white/20 border-white/10 text-muted hover:text-bright' : 'bg-black/10 hover:bg-black/20 border-black/10 text-slate-600 hover:text-black'}`}
                            title="Command Palette (Cmd+K)"
                        >
                            <span className="text-[10px] font-black uppercase tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity">CMD+K</span>
                        </button>
                        <button
                            onClick={() => setIsChatOpen(!isChatOpen)}
                            className={`p-2 rounded-xl transition-all ${isChatOpen ? 'bg-primary text-white' : `${theme === "dark" ? 'text-muted hover:text-bright hover:bg-white/5' : 'text-slate-600 hover:text-black hover:bg-black/5'}`}`}
                        >
                            <MessageSquare size={18} />
                        </button>
                        <div className={`h-4 w-px ${theme === "dark" ? 'bg-white/10' : 'bg-black/10'}`} />

                        {user && (
                            <button
                                onClick={handleLogout}
                                className={`p-2 rounded-xl transition-all ${theme === "dark" ? 'text-muted hover:text-error hover:bg-error/5' : 'text-slate-600 hover:text-red-600 hover:bg-red-50'}`}
                                title="Sign Out"
                            >
                                <LogOut size={18} />
                            </button>
                        )}
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto px-10 pt-10 pb-12 custom-scrollbar">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, scale: 0.995 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="max-w-7xl mx-auto h-full"
                    >
                        {children}
                    </motion.div>
                </div>
            </main>

            <GlobalChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />

            <style>{`
                .bg-main { background-color: var(--bg-main); }
                .bg-sidebar { background-color: var(--bg-sidebar); }
                .text-main { color: var(--text-main); }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
            `}</style>
        </div>
    );
};

export default Layout;
