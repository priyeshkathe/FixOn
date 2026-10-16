import { AnimatePresence, motion } from 'framer-motion';
import { Beaker, Command, FileCode, Layers, Search, Settings, ShieldAlert, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CommandPalette = ({ isOpen, onClose }) => {
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

    const items = [
        { id: 'dash', label: 'Monitor Dashboard', icon: <Zap size={16} />, path: '/' },
        { id: 'lab', label: 'AI Script Lab', icon: <Beaker size={16} />, path: '/ai-lab' },
        { id: 'blue', label: 'Project Blueprints', icon: <Layers size={16} />, path: '/blueprints' },
        { id: 'repo', label: 'Script Repository', icon: <FileCode size={16} />, path: '/repo' },
        { id: 'audit', label: 'Security Audit', icon: <ShieldAlert size={16} />, path: '/audit' },
        { id: 'sett', label: 'System Settings', icon: <Settings size={16} />, path: '/settings' },
    ];

    const filtered = items.filter(i =>
        i.label.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-start justify-center pt-[15vh] px-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: -20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: -20 }}
                        className="w-full max-w-2xl bg-[#0d1117] border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-4 p-6 border-b border-white/5">
                            <Search className="text-muted" size={20} />
                            <input
                                autoFocus
                                placeholder="Type a command or search..."
                                className="bg-transparent border-none focus:ring-0 text-bright text-lg flex-1 outline-none"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/10 rounded-lg">
                                <span className="text-[10px] font-black text-muted uppercase">ESC</span>
                            </div>
                        </div>

                        <div className="p-4 max-h-[400px] overflow-y-auto">
                            <div className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-4 px-2">Navigation</div>
                            <div className="space-y-1">
                                {filtered.map(item => (
                                    <button
                                        key={item.id}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 group transition-all text-left border border-transparent hover:border-white/5"
                                        onClick={() => {
                                            navigate(item.path);
                                            onClose();
                                        }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-white/5 rounded-xl group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                                {item.icon}
                                            </div>
                                            <span className="font-bold text-muted group-hover:text-bright transition-colors text-sm">{item.label}</span>
                                        </div>
                                        <ArrowRight size={14} className="text-primary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                    </button>
                                ))}
                                {filtered.length === 0 && (
                                    <div className="text-center py-10 opacity-20">
                                        <Command size={48} className="mx-auto mb-4" />
                                        <p className="text-xs uppercase font-black tracking-widest">No results found</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-black/20 border-t border-white/5 flex justify-between items-center">
                            <div className="flex gap-4">
                                <div className="flex items-center gap-1.5 opacity-50">
                                    <span className="p-1 bg-white/10 rounded text-[9px] font-bold">↑↓</span>
                                    <span className="text-[9px] font-black uppercase tracking-widest">Navigate</span>
                                </div>
                                <div className="flex items-center gap-1.5 opacity-50">
                                    <span className="p-1 bg-white/10 rounded text-[9px] font-bold">ENTER</span>
                                    <span className="text-[9px] font-black uppercase tracking-widest">Execute</span>
                                </div>
                            </div>
                            <div className="text-[9px] font-black text-primary uppercase tracking-widest">FixOn Global Palette</div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const ArrowRight = ({ size, className }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M5 12h14m-7-7 7 7-7 7" />
    </svg>
);

export default CommandPalette;
