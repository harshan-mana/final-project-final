import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, LayoutDashboard, Settings, User, LogOut, Menu, X, ShieldAlert, Cpu, Activity } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface AegisNavbarProps {
  userRole: string | null;
  onViewChange: (view: 'helmet' | 'authority' | 'profile' | 'settings') => void;
  currentView: string;
}

export default function AegisNavbar({ userRole, onViewChange, currentView }: AegisNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    return onSnapshot(doc(db, 'users', auth.currentUser.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfileIncomplete(!data.phone || !data.emergencyContact1?.phone);
      }
    });
  }, []);

  const navItems = [
    { id: 'helmet', label: 'AI HUD', icon: Shield, roles: ['Driver', 'RTO'] },
    { id: 'authority', label: 'RTO CMD', icon: LayoutDashboard, roles: ['RTO'] },
    { id: 'settings', label: 'System', icon: Settings, roles: ['Driver', 'RTO'] },
  ];

  return (
    <nav className="fixed top-8 left-1/2 -translate-x-1/2 z-[80] w-[95%] max-w-4xl">
      <div className="glass-panel px-6 py-4 border-white/5 flex items-center justify-between relative overflow-hidden group">
        {/* Animated Background Scan Line */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
           <motion.div 
             animate={{ x: ['-100%', '200%'] }} 
             transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
             className="w-20 h-full bg-gradient-to-r from-transparent via-cyber-blue to-transparent skew-x-12"
           />
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="p-2 bg-cyber-blue rounded-xl shadow-[0_0_15px_#00D1FF] group-hover:scale-110 transition-transform">
            <Shield className="w-6 h-6 text-black" />
          </div>
          <div>
            <span className="text-sm font-display font-black tracking-[0.2em] text-white">AEGIS AI</span>
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-pulse" />
               <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">{userRole || 'Verifying...'}</span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 relative z-10">
          {navItems.filter(item => item.roles.includes(userRole || 'Driver')).map((item) => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as any)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all relative overflow-hidden ${
                currentView === item.id 
                  ? 'text-black bg-cyber-blue shadow-[0_0_20px_#00D1FF]' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
              {item.id === 'settings' && profileIncomplete && (
                 <span className="absolute top-1 right-1 w-2 h-2 bg-cyber-red rounded-full animate-ping" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <AnimatePresence>
            {profileIncomplete && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-cyber-red/10 border border-cyber-red/20 rounded-lg"
              >
                <ShieldAlert className="w-3 h-3 text-cyber-red animate-pulse" />
                <span className="text-[8px] font-black text-cyber-red uppercase tracking-widest">Protocol Incomplete</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <button 
            onClick={() => auth.signOut()}
            className="p-3 bg-white/5 rounded-xl border border-white/10 text-white/40 hover:text-cyber-red hover:border-cyber-red/30 transition-all"
            title="Terminate Session"
          >
            <LogOut className="w-5 h-5" />
          </button>
          
          <button className="md:hidden p-2 text-white/40" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden mt-4 glass-panel p-4 border-white/10 space-y-2"
          >
            {navItems.filter(item => item.roles.includes(userRole || 'Driver')).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id as any);
                  setIsMenuOpen(false);
                }}
                className={`w-full p-4 rounded-xl text-left text-[10px] font-black uppercase tracking-widest flex items-center justify-between transition-all ${
                  currentView === item.id ? 'bg-cyber-blue text-black' : 'text-white/40 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </div>
                {item.id === 'settings' && profileIncomplete && (
                   <span className="px-2 py-1 bg-cyber-red text-white text-[8px] rounded-lg animate-pulse">ACTION REQ</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
