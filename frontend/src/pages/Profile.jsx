import { motion } from 'framer-motion';
import { BadgeCheck, Calendar, Mail, Shield, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
    const { user } = useAuth();

    if (!user) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <p className="text-muted animate-pulse font-bold uppercase tracking-widest">Awaiting authentication...</p>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-10">
            <header className="flex justify-between items-end">
                <div>
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl font-bold text-bright tracking-tight"
                    >
                        Operator Profile
                    </motion.h1>
                    <p className="text-muted mt-2 text-lg">Detailed credentials and system clearances.</p>
                </div>
                <div className="flex gap-2">
                    <span className="badge badge-primary flex items-center gap-1">
                        <BadgeCheck size={12} /> Verified Identity
                    </span>
                </div>
            </header>

            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-1">
                    <div className="card glass flex flex-col items-center p-8 text-center space-y-6">
                        <div className="w-32 h-32 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center font-black text-4xl text-primary shadow-2xl shadow-primary/20">
                            {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-bright uppercase">{user.name}</h3>
                            <p className="text-primary font-bold text-xs uppercase tracking-[0.3em] mt-1">Lvl {user.level} {user.role}</p>
                        </div>
                        <div className="w-full pt-6 border-t border-white/5 space-y-4">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted">
                                <span>Status</span>
                                <span className="text-success">Active Session</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted">
                                <span>Member Since</span>
                                <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2 space-y-6">
                    <div className="card glass p-8 space-y-8">
                        <h3 className="text-sm font-black uppercase tracking-widest text-muted border-b border-white/5 pb-4">
                            Core Credentials
                        </h3>

                        <div className="grid gap-6">
                            <DetailItem icon={<User size={18} />} label="Full Name" value={user.name} />
                            <DetailItem icon={<Mail size={18} />} label="Email Address" value={user.email} />
                            <DetailItem icon={<Shield size={18} />} label="Security Tier" value={`Level ${user.level} Authorization`} />
                            <DetailItem icon={<Calendar size={18} />} label="Account Created" value={new Date(user.createdAt).toLocaleString()} />
                        </div>
                    </div>

                    <div className="card bg-primary/5 border-primary/20 p-8">
                        <h3 className="text-md font-bold text-bright mb-4">Nexus Elite Privileges</h3>
                        <ul className="space-y-3">
                            <PrivilegeItem label="Advanced AI Orchestration" active={user.role === 'admin'} />
                            <PrivilegeItem label="System-wide Telemetry Override" active={user.role === 'admin'} />
                            <PrivilegeItem label="Custom Workflow Deployment" active={true} />
                            <PrivilegeItem label="Global Script Repository Access" active={true} />
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DetailItem = ({ icon, label, value }) => (
    <div className="flex items-center gap-6 group">
        <div className="p-3 bg-white/5 rounded-xl text-muted group-hover:text-primary transition-colors">
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-black uppercase text-muted tracking-widest">{label}</p>
            <p className="text-bright font-medium mt-0.5">{value}</p>
        </div>
    </div>
);

const PrivilegeItem = ({ label, active }) => (
    <li className="flex items-center gap-3">
        <div className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-primary' : 'bg-white/10'}`} />
        <span className={`text-xs ${active ? 'text-bright font-bold' : 'text-muted line-through opacity-50'}`}>{label}</span>
    </li>
);

export default Profile;
