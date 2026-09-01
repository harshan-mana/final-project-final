import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Search, MapPin, CheckCircle, Clock, AlertCircle, Database, Plus, Trash2, ShieldAlert, Phone, ShieldCheck, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AuthorityView() {
  const [violations, setViolations] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [view, setView] = useState<'Violations' | 'Vehicles' | 'Analytics'>('Violations');
  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'violations'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setViolations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'violations');
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'violations', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `violations/${id}`);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(10));
    return onSnapshot(q, (snapshot) => {
      setAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'vehicles'), limit(50));
    return onSnapshot(q, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  const [activeTab, setActiveTab] = useState<'violations' | 'registry' | 'intelligence'>('violations');

  return (
    <div className="pt-32 pb-12 px-8 max-w-[1700px] mx-auto space-y-8">
      {/* GLOBAL HUD STATUS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
         {[
           { label: 'Network Sentry', value: 'Active', icon: ShieldCheck, color: 'text-cyber-blue' },
           { label: 'Unresolved Criticals', value: violations.filter(v => v.status === 'Pending').length, icon: AlertCircle, color: 'text-cyber-orange' },
           { label: 'Registry Nodes', value: vehicles.length, icon: Database, color: 'text-cyber-green' },
           { label: 'SOS Response Link', value: '0.8ms', icon: Zap, color: 'text-cyber-purple' }
         ].map((stat, i) => (
           <div key={i} className="glass-panel p-6 border-white/5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                 <stat.icon className="w-12 h-12" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-2">{stat.label}</p>
              <p className={`text-4xl font-display font-black tracking-tighter ${stat.color}`}>{stat.value}</p>
           </div>
         ))}
      </div>

      {/* EMERGENCY PRIORITY STRIP */}
      {alerts.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-cyber-red/5 border border-cyber-red/20 rounded-3xl p-8 relative overflow-hidden"
        >
           <div className="absolute top-0 left-0 w-2 h-full bg-cyber-red animate-pulse" />
           <div className="flex flex-col lg:flex-row gap-8 items-start lg:items-center">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-cyber-red flex items-center justify-center shadow-[0_0_20px_rgba(255,59,59,0.5)]">
                    <ShieldAlert className="w-7 h-7 text-white animate-pulse" />
                 </div>
                 <div>
                    <h2 className="text-xl font-display font-black tracking-tight">SOS COMMAND FEED</h2>
                    <p className="text-[8px] font-mono text-cyber-red/60 uppercase tracking-[0.4em]">Real-time Satellite Uplink Active</p>
                 </div>
              </div>
              
              <div className="flex-1 w-full overflow-x-auto pb-2 scrollbar-hide">
                 <div className="flex gap-4">
                   {alerts.map(a => (
                     <div key={a.id} className="min-w-[300px] bg-black/60 border border-cyber-red/10 p-5 rounded-2xl hover:border-cyber-red/40 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                           <span className="text-xs font-black uppercase tracking-tight">{a.userName}</span>
                           <span className="text-[8px] font-mono p-1 bg-cyber-red/20 text-cyber-red rounded uppercase tracking-widest">{a.actionType}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/40 mb-3">
                           <Phone className="w-3 h-3" /> {a.userPhone}
                        </div>
                        <a 
                          href={a.googleMapsUrl} 
                          target="_blank" 
                          className="w-full py-2 bg-cyber-red text-white text-[9px] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
                        >
                          <MapPin className="w-3 h-3" /> Target Geo-Location
                        </a>
                     </div>
                   ))}
                 </div>
              </div>
           </div>
        </motion.div>
      )}

      {/* MAIN DATA MODULE */}
      <div className="glass-panel min-h-[600px] border-white/5 flex flex-col">
          <div className="p-8 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
             <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5">
                {[
                  { id: 'violations', label: 'Safety Violations', icon: AlertCircle },
                  { id: 'registry', label: 'Traffic Registry', icon: Database },
                  { id: 'intelligence', label: 'Predictive Intel', icon: Activity }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-cyber-blue text-black shadow-[0_0_20px_#00D1FF]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
             </div>

             {activeTab === 'violations' && (
               <div className="flex gap-2">
                 {['All', 'TRIPLE_RIDING', 'ACCIDENT', 'FAKE_PLATE'].map(f => (
                   <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${filter === f ? 'bg-white text-black' : 'border-white/10 text-white/40 hover:border-white/20'}`}
                   >
                     {f}
                   </button>
                 ))}
               </div>
             )}
          </div>

          <div className="p-8 flex-1">
             {activeTab === 'violations' && (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  {violations.filter(v => filter === 'All' || v.type === filter).map(v => (
                    <div key={v.id} className="glass-panel overflow-hidden border-white/10 group hover:border-cyber-blue/30 transition-all flex flex-col">
                       <div className="aspect-square relative bg-white/5 overflow-hidden">
                          {v.photoUrl && <img src={v.photoUrl} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#050816] to-transparent opacity-60" />
                          <div className="absolute top-4 left-4 flex flex-col gap-2">
                             <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest ${v.status === 'Resolved' ? 'bg-cyber-green text-black' : 'bg-cyber-orange text-white'}`}>{v.status}</span>
                             <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[8px] font-black uppercase tracking-widest text-cyber-blue border border-cyber-blue/20">{v.type}</span>
                          </div>
                          <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                             <div className="w-full h-1 bg-cyber-blue/30 rounded-full overflow-hidden">
                                <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 2, repeat: Infinity }} className="w-full h-full bg-cyber-blue" />
                             </div>
                          </div>
                       </div>
                       
                       <div className="p-6 flex-1 flex flex-col justify-between">
                          <div className="mb-4">
                             <h3 className="text-2xl font-display font-black tracking-tighter text-white group-hover:neon-text-blue transition-all">{v.vehicleNumber}</h3>
                             <p className="text-[10px] text-white/30 font-mono mt-1">{v.timestamp?.toDate().toLocaleString().toUpperCase()}</p>
                          </div>
                          <p className="text-[9px] text-white/50 leading-relaxed uppercase tracking-wider mb-6 italic">"{v.description}"</p>
                          <div className="grid grid-cols-2 gap-3">
                             <button onClick={() => updateStatus(v.id, 'Resolved')} className="py-2.5 bg-cyber-blue/10 border border-cyber-blue/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-cyber-blue hover:bg-cyber-blue hover:text-black transition-all">Endorse</button>
                             <button onClick={() => updateStatus(v.id, 'Spam')} className="py-2.5 bg-white/5 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white hover:bg-white/10 transition-all">Discard</button>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
             )}

             {activeTab === 'registry' && (
                <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                      <thead>
                         <tr className="border-b border-white/10">
                            {['Vector ID', 'Proprietor', 'Registry Status', 'Platform', 'Operations'].map(h => (
                               <th key={h} className="pb-6 text-[9px] font-black uppercase tracking-[0.3em] text-white/20">{h}</th>
                            ))}
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                         {vehicles.map(veh => (
                            <tr key={veh.id} className="group hover:bg-white/5 transition-all">
                               <td className="py-5 font-display font-black text-white text-lg group-hover:text-cyber-blue transition-colors">{veh.registrationNumber}</td>
                               <td className="py-5 text-xs font-bold text-white/60">{veh.ownerName || 'CENTRAL_NODE'}</td>
                               <td className="py-5">
                                  <span className="px-2 py-1 bg-cyber-green/10 text-cyber-green border border-cyber-green/20 text-[9px] font-black uppercase tracking-widest rounded-md">{veh.status}</span>
                               </td>
                               <td className="py-5 text-[10px] font-mono text-white/30 uppercase">{veh.vehicleType}</td>
                               <td className="py-5">
                                  <button className="p-2 text-white/20 hover:text-cyber-red transition-colors"><Trash2 className="w-4 h-4" /></button>
                               </td>
                            </tr>
                         ))}
                      </tbody>
                   </table>
                </div>
             )}

             {activeTab === 'intelligence' && (
                <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-white/5 rounded-[2rem]">
                   <Activity className="w-16 h-16 text-cyber-blue/20 mb-6" />
                   <h3 className="text-xl font-display font-black tracking-widest uppercase mb-2">Neural Prediction Engine</h3>
                   <p className="text-[9px] font-mono text-white/20 uppercase tracking-[0.3em]">AI Model Aegis-V4 analyzing sector patterns... [REDACTED]</p>
                </div>
             )}
          </div>
      </div>
    </div>
  );
}
