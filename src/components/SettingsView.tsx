import React, { useState, useEffect } from 'react';
import { Wifi, Database, Settings as SettingsIcon, FileUp, Globe, RefreshCcw, Info, User, Phone, Save, ShieldAlert, Cpu, Lock, Zap, CreditCard, ChevronRight, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function SettingsView() {
  const [wifiStatus, setWifiStatus] = useState<'disconnected' | 'scanning' | 'handshake' | 'connected'>('disconnected');
  const [syncStatus, setSyncStatus] = useState('Idle');
  const [profile, setProfile] = useState<any>(null);
  const [originalProfile, setOriginalProfile] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [foundModules, setFoundModules] = useState<{name: string, signal: number, id: string, type: 'module' | 'router'}[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<any>(null);
  const [connectingPassword, setConnectingPassword] = useState('');
  const [hasPermissions, setHasPermissions] = useState(false);
  const [aiSensitivity, setAiSensitivity] = useState(85);
  const [activeCategory, setActiveCategory] = useState<'profile' | 'hardware' | 'network' | 'billing'>('profile');

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (result.state === 'granted') setHasPermissions(true);
      } catch (e) {
        console.warn("Permissions API not fully supported", e);
      }
    };
    checkPermissions();

    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          setProfile(userDoc.data());
          setOriginalProfile(userDoc.data());
        }
      } catch (e) {
        console.error("Profile fetch failed:", e);
      }
    };
    fetchProfile();
  }, []);

  const handleTextChange = (value: string, field: string, subfield?: string) => {
    setIsDirty(true);
    setShowSuccess(false);
    const errorKey = subfield ? `${field}.${subfield}` : field;
    if (errors[errorKey]) {
      const newErrors = { ...errors };
      delete newErrors[errorKey];
      setErrors(newErrors);
    }

    if (subfield) {
      setProfile({
        ...profile,
        [field]: { ...profile[field], [subfield]: value }
      });
    } else {
      setProfile({ ...profile, [field]: value });
    }
  };

  const validateInputs = () => {
    if (!profile) return false;
    const phoneRegex = /^\d{10,15}$/;
    const nameRegex = /^[a-zA-Z\s]+$/;
    const newErrors: {[key: string]: string} = {};
    
    if (!profile.name || profile.name.trim() === "" || !nameRegex.test(profile.name)) newErrors.name = "Invalid Name";
    if (!profile.phone || profile.phone.trim() === "" || !phoneRegex.test(profile.phone)) newErrors.phone = "Invalid Phone";
    if (!profile.emergencyContact1?.name || !nameRegex.test(profile.emergencyContact1.name)) newErrors['emergencyContact1.name'] = "Required";
    if (!profile.emergencyContact1?.phone || !phoneRegex.test(profile.emergencyContact1.phone)) newErrors['emergencyContact1.phone'] = "Required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveProfile = async () => {
    if (!auth.currentUser || !profile) return;
    if (!validateInputs()) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { ...profile });
      setOriginalProfile(profile);
      setIsDirty(false);
      setShowSuccess(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const startDiscovery = () => {
    setWifiStatus('scanning');
    setFoundModules([]);
    setTimeout(() => {
      setFoundModules([
        { name: 'Aegis-Helmet-V1-092', signal: -45, id: 'MAC_AE:09:2F:88', type: 'module' },
        { name: 'Home_Fiber_5G', signal: -62, id: 'MAC_RT:88:AA:CC', type: 'router' },
        { name: 'Aegis-Helmet-V1-118', signal: -68, id: 'MAC_AE:11:8A:BC', type: 'module' }
      ]);
    }, 2000);
  };

  const confirmConnection = () => {
    setWifiStatus('handshake');
    setTimeout(() => setWifiStatus('connected'), 2000);
  };

  return (
    <div className="pt-32 pb-12 px-8 max-w-[1600px] mx-auto min-h-screen">
      <div className="flex flex-col lg:flex-row gap-12">
        
        {/* SIDE NAV - SYSTEM CATEGORIES */}
        <div className="lg:w-80 space-y-4">
           <div>
              <h1 className="text-4xl font-display font-black tracking-tighter mb-2">SYSTEM CONFIG</h1>
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em]">Hardware ID: AE-992-X-KRYPTON</p>
           </div>

           <div className="space-y-2 pt-8">
              {[
                { id: 'profile', label: 'Identity & Contacts', icon: User },
                { id: 'hardware', label: 'Hardware Modules', icon: Cpu },
                { id: 'network', label: 'Network & Cloud', icon: Globe },
                { id: 'billing', label: 'Executive Tiers', icon: CreditCard }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`w-full p-4 rounded-2xl flex items-center justify-between group transition-all ${activeCategory === cat.id ? 'bg-cyber-blue text-black shadow-[0_0_20px_#00D1FF]' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                >
                  <div className="flex items-center gap-4">
                    <cat.icon className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-widest">{cat.label}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${activeCategory === cat.id ? 'translate-x-1' : 'opacity-0'}`} />
                </button>
              ))}
           </div>

           {activeCategory === 'hardware' && wifiStatus === 'connected' && (
              <div className="glass-panel p-6 border-cyber-green/20 mt-8">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 rounded-full bg-cyber-green animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-cyber-green tracking-widest">Link Optimized</span>
                 </div>
                 <div className="space-y-4">
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-cyber-green w-3/4" />
                    </div>
                    <p className="text-[9px] text-white/40 leading-relaxed uppercase tracking-widest">Signal Integrity Optimized. AI Latency: 12ms</p>
                 </div>
              </div>
           )}
        </div>

        {/* MAIN CONFIGURATION AREA */}
        <div className="flex-1">
           <AnimatePresence mode="wait">
             {activeCategory === 'profile' && (
                <motion.div 
                  key="profile" 
                  initial={{ opacity: 0, x: 20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                   <div className="glass-panel p-8 border-white/5">
                      <div className="flex items-center gap-4 mb-8">
                         <div className="p-4 bg-cyber-blue/10 rounded-2xl border border-cyber-blue/20">
                            <User className="w-8 h-8 text-cyber-blue" />
                         </div>
                         <div>
                            <h2 className="text-xl font-display font-black tracking-tight">CITIZEN PROFILE</h2>
                            <p className="text-[9px] font-mono text-white/30 uppercase tracking-[0.3em]">Central Registry Node: {auth.currentUser?.uid.slice(0, 8)}</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         {[
                           { label: 'Platform Handle', field: 'name', type: 'text', icon: User },
                           { label: 'Mobile Comms', field: 'phone', type: 'tel', icon: Phone },
                         ].map((inp) => (
                           <div key={inp.field} className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                                <inp.icon className="w-3 h-3" /> {inp.label}
                              </label>
                              <input 
                                value={profile?.[inp.field] || ''}
                                onChange={(e) => handleTextChange(e.target.value, inp.field)}
                                className={`w-full bg-white/5 border p-4 rounded-xl text-sm font-bold focus:outline-none focus:border-cyber-blue transition-all ${errors[inp.field] ? 'border-cyber-red' : 'border-white/10'}`}
                              />
                           </div>
                         ))}
                      </div>

                      <div className="mt-12 space-y-6">
                         <h3 className="text-sm font-black uppercase tracking-[0.4em] text-cyber-orange">Emergency Guardians</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {[1, 2].map((num) => (
                               <div key={num} className="glass-panel p-6 border-white/5 bg-white/[0.02]">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-4 flex items-center gap-2">
                                     <ShieldAlert className="w-3 h-3" /> Node-0{num} Dispatch
                                  </p>
                                  <div className="space-y-4">
                                     <input 
                                        placeholder="Guardian Identity"
                                        value={profile?.[`emergencyContact${num}`]?.name || ''}
                                        onChange={(e) => handleTextChange(e.target.value, `emergencyContact${num}`, 'name')}
                                        className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-xs font-bold"
                                     />
                                     <input 
                                        placeholder="Comms Access (Phone)"
                                        value={profile?.[`emergencyContact${num}`]?.phone || ''}
                                        onChange={(e) => handleTextChange(e.target.value, `emergencyContact${num}`, 'phone')}
                                        className="w-full bg-black/40 border border-white/10 p-3 rounded-lg text-xs font-bold"
                                     />
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>

                      {isDirty && (
                         <div className="mt-12 flex justify-end">
                            <button 
                              onClick={saveProfile}
                              className="px-12 py-4 bg-cyber-blue text-black font-display font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-[0_0_30px_#00D1FF] hover:scale-105 transition-all flex items-center gap-3"
                            >
                               {isSaving ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                               Commit Identification
                            </button>
                         </div>
                      )}

                      {showSuccess && !isDirty && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 flex justify-end">
                           <div className="px-6 py-3 bg-cyber-green/10 border border-cyber-green/20 text-cyber-green rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                              <Zap className="w-4 h-4" /> Credentials Optimized
                           </div>
                        </motion.div>
                      )}
                   </div>
                </motion.div>
             )}

             {activeCategory === 'hardware' && (
                <motion.div key="hardware" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                   <div className="glass-panel p-8 border-white/5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-5">
                         <Cpu className="w-64 h-64" />
                      </div>
                      
                      <div className="flex flex-col md:flex-row justify-between gap-8 mb-12">
                         <div>
                            <h2 className="text-2xl font-display font-black tracking-tight text-white">HARDWARE FABRIC</h2>
                            <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em]">Active Sentry Nodes Pairing</p>
                         </div>
                         <button 
                           onClick={startDiscovery}
                           className="px-8 py-3 bg-white/5 border border-white/10 hover:bg-cyber-blue hover:text-black hover:border-cyber-blue rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                         >
                            Probe System Layers
                         </button>
                      </div>

                      {wifiStatus === 'scanning' && (
                         <div className="space-y-6">
                            <div className="flex items-center gap-4 text-cyber-blue">
                               <RefreshCcw className="w-4 h-4 animate-spin" />
                               <span className="text-[10px] font-black tracking-widest uppercase">Initializing Neural Handshake...</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                               {foundModules.map(m => (
                                 <div key={m.id} onClick={() => confirmConnection()} className="p-6 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:border-cyber-blue/40 hover:bg-cyber-blue/5 transition-all group">
                                    <div className="flex items-center justify-between mb-4">
                                       <div className="flex items-center gap-3 font-display font-black tracking-tight text-lg group-hover:neon-text-blue transition-all">
                                          <Cpu className="w-5 h-5 opacity-40" /> {m.name}
                                       </div>
                                       <Zap className="w-4 h-4 text-cyber-blue" />
                                    </div>
                                    <p className="text-[9px] font-mono text-white/20 uppercase">SEC_ID: {m.id}</p>
                                 </div>
                               ))}
                            </div>
                         </div>
                      )}

                      {wifiStatus === 'connected' && (
                         <div className="bg-cyber-green/5 border border-cyber-green/20 rounded-3xl p-10 flex flex-col items-center gap-8">
                            <div className="w-24 h-24 rounded-full border-4 border-cyber-green flex items-center justify-center shadow-[0_0_40px_rgba(0,255,157,0.3)]">
                               <RefreshCcw className="w-10 h-10 text-cyber-green animate-spin-slow" />
                            </div>
                            <div className="text-center">
                               <h3 className="text-2xl font-display font-black tracking-widest uppercase text-cyber-green mb-2">LOCKED ON SIGNAL</h3>
                               <p className="text-[10px] font-mono text-cyber-green/40 uppercase tracking-[0.4em]">BRIDGE ACTIVE: 192.168.4.1</p>
                            </div>
                            <button onClick={() => setWifiStatus('disconnected')} className="px-8 py-2 text-[10px] font-black uppercase text-white/20 hover:text-cyber-red transition-all">Disconnect Node</button>
                         </div>
                      )}

                      {(!wifiStatus || wifiStatus === 'disconnected') && (
                         <div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                            <p className="text-white/20 font-black tracking-widest uppercase text-lg">No Active Modules Detected</p>
                         </div>
                      )}
                   </div>

                   <div className="glass-panel p-8 border-white/5">
                      <h3 className="text-sm font-black uppercase tracking-[0.4em] mb-8 text-cyber-purple">AI Neural Sensitivity</h3>
                      <div className="space-y-8">
                         <div className="space-y-4">
                            <div className="flex justify-between items-center px-2">
                               <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Inference Confidence</span>
                               <span className="text-lg font-display font-black text-cyber-blue">{aiSensitivity}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="50" max="99" 
                              value={aiSensitivity}
                              onChange={(e) => setAiSensitivity(parseInt(e.target.value))}
                              className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyber-blue"
                            />
                            <div className="flex justify-between text-[8px] font-mono uppercase text-white/20 tracking-widest">
                               <span>Fast (Loose)</span>
                               <span>Precise (Targeted)</span>
                            </div>
                         </div>
                      </div>
                   </div>
                </motion.div>
             )}

             {activeCategory === 'billing' && (
                <motion.div key="billing" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="glass-panel p-10 border-white/5 bg-white/[0.01] flex flex-col justify-between">
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-8">Current Allocation</p>
                            <h3 className="text-5xl font-display font-black tracking-tight mb-2">FREE</h3>
                            <p className="text-xs text-white/40 leading-relaxed uppercase tracking-widest">Basic Helmet Detection & SOS Alerts Active.</p>
                         </div>
                         <div className="pt-8 text-[10px] font-black text-white/20 uppercase tracking-widest">Enterprise Access Restricted</div>
                      </div>

                      <div className="glass-panel p-10 border-cyber-purple/40 bg-cyber-purple/5 relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-6">
                            <Zap className="w-12 h-12 text-cyber-purple animate-pulse" />
                         </div>
                         <div>
                            <div className="flex items-center gap-3 mb-8">
                               <span className="px-3 py-1 bg-cyber-purple text-black text-[9px] font-black uppercase tracking-widest rounded-full">RECOMMENDED</span>
                            </div>
                            <h3 className="text-5xl font-display font-black tracking-tight mb-2 text-cyber-purple neon-text-purple">ELITE</h3>
                            <div className="space-y-4 mt-8">
                               {[
                                 'Real-time ALPR Processing',
                                 'Cloud Violation Archiving',
                                 'Zero-Latency RTSP Stream',
                                 'Direct RTO Hotlink Dispatch'
                               ].map(f => (
                                 <div key={f} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/60">
                                    <CheckCircle className="w-4 h-4 text-cyber-purple" /> {f}
                                 </div>
                               ))}
                            </div>
                         </div>
                         <button className="w-full py-5 bg-cyber-purple text-white font-display font-black text-xs uppercase tracking-[0.3em] rounded-2xl mt-12 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(123,45,255,0.4)]">
                            Upgrade Protocol
                         </button>
                      </div>
                   </div>
                </motion.div>
             )}
           </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
